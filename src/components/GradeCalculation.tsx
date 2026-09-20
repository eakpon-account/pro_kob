import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  Printer, 
  FileSpreadsheet, 
  Save, 
  RefreshCw, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  BarChart3, 
  ChevronRight, 
  BookOpen, 
  School, 
  Award, 
  Users, 
  Check, 
  X,
  HelpCircle,
  FileText,
  Filter,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { 
  Student, 
  Subject, 
  Assignment, 
  StudentSubjectScore, 
  User, 
  Exam, 
  ExamRecord, 
  SemesterScoreData,
  SubjectGradingRatio
} from '../types';
import { calculateGrade, getGradeLabel, getSubjectRatio } from '../utils/grading';
import { storage } from '../services/storage';
import * as XLSX from 'xlsx';

interface GradeCalculationProps {
  currentUser: User;
  students: Student[];
  subjects: Subject[];
  assignments: Assignment[];
  scores: StudentSubjectScore[];
  onUpdateScores: (newScores: StudentSubjectScore[]) => void;
  onUpdateSubjects?: (newSubjects: Subject[]) => void;
  initialSubjectId?: string;
  initialClassKey?: string;
  onNavigateToSubjects?: () => void;
  onNavigateToRatios?: (subjectId?: string) => void;
}

interface StudentGradeRow {
  student: Student;
  // Raw scores
  rawAssignmentScore: number;
  maxAssignmentScore: number;
  // Scaled / entered scores
  assignmentScore: number;   // คะแนนรวมจากใบงาน (ตามสัดส่วน)
  midtermScore: number;      // คะแนนสอบกลางภาค
  finalScore: number;        // คะแนนสอบปลายภาค
  totalScore: number;        // คะแนนรวมเต็ม 100
  grade: number;             // เกรด 0 - 4
  passed: boolean;
  isModified?: boolean;
  midtermRaw?: number;       // คะแนนดิบจากแบบทดสอบกลางภาค
  finalRaw?: number;         // คะแนนดิบจากแบบทดสอบปลายภาค
  midtermStatus?: string;    // normal | absent | leave | retested
  finalStatus?: string;      // normal | absent | leave | retested
}

export const GradeCalculation: React.FC<GradeCalculationProps> = ({
  currentUser,
  students,
  subjects,
  assignments,
  scores,
  onUpdateScores,
  onUpdateSubjects,
  initialSubjectId,
  initialClassKey,
  onNavigateToSubjects,
  onNavigateToRatios,
}) => {
  // Filter accessible subjects
  const accessibleSubjects = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'executive') return subjects;
    const mySubjects = subjects.filter((s) => s.teacherId === currentUser.id || s.teacherName === currentUser.name);
    return mySubjects.length > 0 ? mySubjects : subjects;
  }, [subjects, currentUser]);

  // Selected Subject State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && accessibleSubjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return accessibleSubjects.length > 0 ? accessibleSubjects[0].id : '';
  });

  useEffect(() => {
    if (initialSubjectId && accessibleSubjects.some((s) => s.id === initialSubjectId)) {
      setSelectedSubjectId(initialSubjectId);
    }
  }, [initialSubjectId, accessibleSubjects]);

  const selectedSubject = useMemo(() => {
    return accessibleSubjects.find((s) => s.id === selectedSubjectId) || accessibleSubjects[0];
  }, [accessibleSubjects, selectedSubjectId]);

  // Available Classes for selected subject
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    if (selectedSubject?.targetClasses && selectedSubject.targetClasses.length > 0) {
      selectedSubject.targetClasses.forEach((c) => {
        if (c && c.trim()) classSet.add(c.trim());
      });
    }
    students.forEach((s) => {
      if (s.classKey && s.classKey.trim()) {
        classSet.add(s.classKey.trim());
      }
    });
    return Array.from(classSet).sort();
  }, [selectedSubject, students]);

  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => {
    if (initialClassKey && availableClasses.includes(initialClassKey)) {
      return initialClassKey;
    }
    return availableClasses.length > 0 ? availableClasses[0] : (storage.getExistingClassrooms()[0] || '1');
  });

  useEffect(() => {
    if (initialClassKey && availableClasses.includes(initialClassKey)) {
      setSelectedClassKey(initialClassKey);
    } else if (availableClasses.length > 0 && !availableClasses.includes(selectedClassKey)) {
      setSelectedClassKey(availableClasses[0]);
    }
  }, [availableClasses, initialClassKey]);

  // ภาคเรียนที่เลือก: 1, 2, หรือ 'combined' (สรุปตลอดปีการศึกษา)
  const [selectedSemester, setSelectedSemester] = useState<1 | 2 | 'combined'>(1);
  const [searchQuery, setSearchQuery] = useState('');

  // สัดส่วนคะแนนรวม 100 (Coursework Weight, Midterm Weight, Final Weight)
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weights, setWeights] = useState({
    coursework: 50, // คะแนนเก็บจากใบงาน (เช่น 50)
    midterm: 20,    // กลางภาค (เช่น 20)
    final: 30,      // ปลายภาค (เช่น 30)
  });

  // Sync weights from subject config if present
  useEffect(() => {
    if (!selectedSubject) return;
    const ratio = getSubjectRatio(selectedSubject, selectedSemester === 2 ? 2 : 1);
    setWeights({
      coursework: ratio.courseworkWeight,
      midterm: ratio.midtermWeight,
      final: ratio.finalExamWeight,
    });
  }, [selectedSubject, selectedSemester]);

  // Temporary weight editing state inside modal
  const [tempWeights, setTempWeights] = useState(weights);
  const tempTotalWeight = tempWeights.coursework + tempWeights.midterm + tempWeights.final;

  // Local student scores override state (studentId -> { assignmentScore, midtermScore, finalScore, isModified })
  const [customScores, setCustomScores] = useState<Record<string, { assignmentScore?: number; midtermScore?: number; finalScore?: number }>>({});
  const [isSaved, setIsSaved] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter students in selected classroom
  const classroomStudents = useMemo(() => {
    return students
      .filter((s) => s.classKey === selectedClassKey)
      .sort((a, b) => a.studentNumber - b.studentNumber);
  }, [students, selectedClassKey]);

  // Load Exam and ExamRecord data
  const [allExams, setAllExams] = useState<Exam[]>(() => storage.getExams());
  const [allExamRecords, setAllExamRecords] = useState<ExamRecord[]>(() => storage.getExamRecords());
  const [selectedMidtermExamId, setSelectedMidtermExamId] = useState<string>('');
  const [selectedFinalExamId, setSelectedFinalExamId] = useState<string>('');

  const reloadExams = () => {
    setAllExams(storage.getExams());
    setAllExamRecords(storage.getExamRecords());
  };

  // Sync exams when subject, semester, or class changes
  useEffect(() => {
    reloadExams();
  }, [selectedSubject?.id, selectedSemester, selectedClassKey]);

  // Sync exams on window focus (e.g., returning from exam score entry tab)
  useEffect(() => {
    const handleFocus = () => reloadExams();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Filter assignments for current subject and semester
  const semesterAssignments = useMemo(() => {
    if (!selectedSubject || selectedSemester === 'combined') return [];
    const semNum = selectedSemester === 2 ? 2 : 1;
    return assignments.filter(
      (a) => a.subjectId === selectedSubject.id && (a.semester === semNum || Number(a.semester) === semNum)
    );
  }, [assignments, selectedSubject, selectedSemester]);

  // Total max possible score of assignments in this semester
  const totalMaxAssignmentScore = useMemo(() => {
    return semesterAssignments.reduce((sum, a) => sum + a.maxScore, 0);
  }, [semesterAssignments]);

  // All available exams for current subject
  const availableExamsForSubject = useMemo(() => {
    if (!selectedSubject) return [];
    const semNum = selectedSemester === 2 ? 2 : 1;
    return allExams.filter(
      (e) => e.subjectId === selectedSubject.id && (selectedSemester === 'combined' || Number(e.semester) === semNum)
    );
  }, [allExams, selectedSubject, selectedSemester]);

  // Find midterm exam (แบบทดสอบกลางภาค) for current subject and semester
  const midtermExam = useMemo(() => {
    if (!selectedSubject || selectedSemester === 'combined') return undefined;
    const semNum = selectedSemester === 2 ? 2 : 1;

    // 1. Explicitly selected by teacher
    if (selectedMidtermExamId) {
      const found = allExams.find((e) => e.id === selectedMidtermExamId);
      if (found) return found;
    }

    // 2. Exact match: subject, semester, and examType === 'midterm'
    const byType = allExams.find(
      (e) => e.subjectId === selectedSubject.id && Number(e.semester) === semNum && e.examType === 'midterm'
    );
    if (byType) return byType;

    // 3. Match by title containing 'กลางภาค' or 'midterm'
    const byTitle = allExams.find(
      (e) =>
        e.subjectId === selectedSubject.id &&
        Number(e.semester) === semNum &&
        (e.title.includes('กลางภาค') || e.title.toLowerCase().includes('midterm'))
    );
    if (byTitle) return byTitle;

    // 4. Any subject exam matching title regardless of semester tag if none found
    return allExams.find(
      (e) =>
        e.subjectId === selectedSubject.id &&
        (e.examType === 'midterm' || e.title.includes('กลางภาค') || e.title.toLowerCase().includes('midterm'))
    );
  }, [allExams, selectedSubject, selectedSemester, selectedMidtermExamId]);

  // Find final exam (แบบทดสอบปลายภาค) for current subject and semester
  const finalExam = useMemo(() => {
    if (!selectedSubject || selectedSemester === 'combined') return undefined;
    const semNum = selectedSemester === 2 ? 2 : 1;

    // 1. Explicitly selected by teacher
    if (selectedFinalExamId) {
      const found = allExams.find((e) => e.id === selectedFinalExamId);
      if (found) return found;
    }

    // 2. Exact match: subject, semester, and examType === 'final'
    const byType = allExams.find(
      (e) => e.subjectId === selectedSubject.id && Number(e.semester) === semNum && e.examType === 'final'
    );
    if (byType) return byType;

    // 3. Match by title containing 'ปลายภาค' or 'final'
    const byTitle = allExams.find(
      (e) =>
        e.subjectId === selectedSubject.id &&
        Number(e.semester) === semNum &&
        (e.title.includes('ปลายภาค') || e.title.toLowerCase().includes('final'))
    );
    if (byTitle) return byTitle;

    // 4. Any subject exam matching title regardless of semester tag if none found
    return allExams.find(
      (e) =>
        e.subjectId === selectedSubject.id &&
        (e.examType === 'final' || e.title.includes('ปลายภาค') || e.title.toLowerCase().includes('final'))
    );
  }, [allExams, selectedSubject, selectedSemester, selectedFinalExamId]);

  // Get exam records for this class
  const midtermRecord = useMemo(() => {
    if (!midtermExam) return undefined;
    const direct = storage.getExamRecord(midtermExam.id, selectedClassKey);
    if (direct) return direct;
    return allExamRecords.find(
      (r) =>
        (r.examId === midtermExam.id || r.id.includes(midtermExam.id)) &&
        (r.classKey === selectedClassKey || r.classKey === selectedClassKey.replace(/[\/\\]/g, '-'))
    );
  }, [allExamRecords, midtermExam, selectedClassKey]);

  const finalRecord = useMemo(() => {
    if (!finalExam) return undefined;
    const direct = storage.getExamRecord(finalExam.id, selectedClassKey);
    if (direct) return direct;
    return allExamRecords.find(
      (r) =>
        (r.examId === finalExam.id || r.id.includes(finalExam.id)) &&
        (r.classKey === selectedClassKey || r.classKey === selectedClassKey.replace(/[\/\\]/g, '-'))
    );
  }, [allExamRecords, finalExam, selectedClassKey]);

  // Scored student count in this class
  const midtermScoredCount = useMemo(() => {
    if (!midtermRecord?.studentScores) return 0;
    return classroomStudents.filter((st) => {
      const sc = midtermRecord.studentScores[st.id];
      return sc && (sc.score !== undefined || sc.status === 'absent' || sc.status === 'leave');
    }).length;
  }, [midtermRecord, classroomStudents]);

  const finalScoredCount = useMemo(() => {
    if (!finalRecord?.studentScores) return 0;
    return classroomStudents.filter((st) => {
      const sc = finalRecord.studentScores[st.id];
      return sc && (sc.score !== undefined || sc.status === 'absent' || sc.status === 'leave');
    }).length;
  }, [finalRecord, classroomStudents]);

  // Active weights: ยึดตามสัดส่วนคะแนนที่กำหนดไว้ในเมนูสัดส่วนคะแนนเป็นหลัก
  const activeWeights = useMemo(() => {
    return {
      coursework: weights.coursework,
      midterm: weights.midterm,
      final: weights.final,
    };
  }, [weights]);

  // Compute Grade Rows for Semester 1 or Semester 2
  const computedRows: StudentGradeRow[] = useMemo(() => {
    if (!selectedSubject) return [];

    return classroomStudents.map((student) => {
      // Find existing StudentSubjectScore for this student
      const scoreObj = scores.find(
        (sc) => sc.studentId === student.id && sc.subjectId === selectedSubject.id
      );

      const semData: SemesterScoreData | undefined =
        selectedSemester === 1
          ? scoreObj?.semester1
          : selectedSemester === 2
          ? scoreObj?.semester2
          : undefined;

      // 1. Raw Assignment Score
      let rawAssignmentScore = 0;
      if (semesterAssignments.length > 0 && semData?.assignmentScores) {
        semesterAssignments.forEach((asg) => {
          const val = semData.assignmentScores[asg.id];
          if (typeof val === 'number' && !isNaN(val)) {
            rawAssignmentScore += Math.max(0, Math.min(val, asg.maxScore));
          }
        });
      } else if (semData?.totalRawAssignments !== undefined) {
        rawAssignmentScore = semData.totalRawAssignments;
      }

      // Scaled Assignment Score (ตามสัดส่วน activeWeights.coursework จาก 100)
      let autoScaledAssignment = 0;
      if (totalMaxAssignmentScore > 0) {
        autoScaledAssignment = Number(((rawAssignmentScore / totalMaxAssignmentScore) * activeWeights.coursework).toFixed(2));
      } else if (semData?.calculatedCoursework !== undefined) {
        autoScaledAssignment = Number(((semData.calculatedCoursework / 100) * activeWeights.coursework).toFixed(2));
      } else {
        autoScaledAssignment = 0;
      }

      // Check if custom override exists
      const studentCustom = customScores[student.id];
      const finalAssignmentScore = studentCustom?.assignmentScore !== undefined
        ? studentCustom.assignmentScore
        : autoScaledAssignment;

      // 2. Midterm Exam Score (ยึดตามคะแนนเต็มของแบบทดสอบกลางภาค)
      let autoMidtermScore = 0;
      let midtermRaw: number | undefined = undefined;
      let midtermStatus: string | undefined = undefined;

      const mScoreObj = midtermRecord?.studentScores?.[student.id];
      if (mScoreObj) {
        midtermStatus = mScoreObj.status;
        if (mScoreObj.status === 'absent') {
          autoMidtermScore = 0;
          midtermRaw = 0;
        } else {
          const effectiveScore = mScoreObj.status === 'retested' && mScoreObj.retestScore !== undefined
            ? mScoreObj.retestScore
            : mScoreObj.score;

          if (effectiveScore !== undefined) {
            midtermRaw = effectiveScore;
            // คำนวณเทียบตามสัดส่วนคะแนน activeWeights.midterm เป็นหลัก (เก็บคะแนนดิบแล้วทำการหารเพื่อได้คะแนนจริงตามสัดส่วน)
            const examRawMax = midtermExam?.rawMaxScore || midtermExam?.maxScore || activeWeights.midterm;
            if (examRawMax > 0 && examRawMax !== activeWeights.midterm) {
              autoMidtermScore = Number(((effectiveScore / examRawMax) * activeWeights.midterm).toFixed(2));
            } else {
              autoMidtermScore = Math.min(activeWeights.midterm, Math.max(0, effectiveScore));
            }
          }
        }
      } else if (semData?.midtermScore !== undefined) {
        autoMidtermScore = Math.min(activeWeights.midterm, Math.max(0, semData.midtermScore));
        midtermRaw = semData.midtermScore;
      }

      const finalMidtermScore = studentCustom?.midtermScore !== undefined
        ? studentCustom.midtermScore
        : autoMidtermScore;

      // 3. Final Exam Score (ยึดตามสัดส่วนปลายภาคที่กำหนดไว้เป็นหลัก โดยเก็บคะแนนดิบแล้วทำการหารเทียบสัดส่วน)
      let autoFinalScore = 0;
      let finalRaw: number | undefined = undefined;
      let finalStatus: string | undefined = undefined;

      const fScoreObj = finalRecord?.studentScores?.[student.id];
      if (fScoreObj) {
        finalStatus = fScoreObj.status;
        if (fScoreObj.status === 'absent') {
          autoFinalScore = 0;
          finalRaw = 0;
        } else {
          const effectiveScore = fScoreObj.status === 'retested' && fScoreObj.retestScore !== undefined
            ? fScoreObj.retestScore
            : fScoreObj.score;

          if (effectiveScore !== undefined) {
            finalRaw = effectiveScore;
            // คำนวณเทียบตามสัดส่วนคะแนน activeWeights.final เป็นหลัก (เก็บคะแนนดิบแล้วทำการหารเพื่อได้คะแนนจริงตามสัดส่วน)
            const examRawMax = finalExam?.rawMaxScore || finalExam?.maxScore || activeWeights.final;
            if (examRawMax > 0 && examRawMax !== activeWeights.final) {
              autoFinalScore = Number(((effectiveScore / examRawMax) * activeWeights.final).toFixed(2));
            } else {
              autoFinalScore = Math.min(activeWeights.final, Math.max(0, effectiveScore));
            }
          }
        }
      } else if (semData?.finalExamScore !== undefined) {
        autoFinalScore = Math.min(activeWeights.final, Math.max(0, semData.finalExamScore));
        finalRaw = semData.finalExamScore;
      }

      const finalFinalScore = studentCustom?.finalScore !== undefined
        ? studentCustom.finalScore
        : autoFinalScore;

      // 4. Total Score (out of 100)
      const calculatedTotal = Number(
        (
          Math.min(activeWeights.coursework, Math.max(0, finalAssignmentScore)) +
          Math.min(activeWeights.midterm, Math.max(0, finalMidtermScore)) +
          Math.min(activeWeights.final, Math.max(0, finalFinalScore))
        ).toFixed(2)
      );
      const totalScore = Math.min(100, Math.max(0, calculatedTotal));

      // 5. Grade (8 standard levels: 0, 1, 1.5, 2, 2.5, 3, 3.5, 4 using 100 as base)
      const grade = calculateGrade(totalScore);
      const passed = grade >= 1;

      const isModified = !!(
        studentCustom &&
        (studentCustom.assignmentScore !== undefined ||
          studentCustom.midtermScore !== undefined ||
          studentCustom.finalScore !== undefined)
      );

      return {
        student,
        rawAssignmentScore: Number(rawAssignmentScore.toFixed(1)),
        maxAssignmentScore: totalMaxAssignmentScore,
        assignmentScore: finalAssignmentScore,
        midtermScore: finalMidtermScore,
        finalScore: finalFinalScore,
        totalScore,
        grade,
        passed,
        isModified,
        midtermRaw,
        finalRaw,
        midtermStatus,
        finalStatus,
      };
    });
  }, [
    classroomStudents,
    selectedSubject,
    scores,
    selectedSemester,
    semesterAssignments,
    totalMaxAssignmentScore,
    activeWeights,
    customScores,
    midtermRecord,
    finalRecord,
    midtermExam,
    finalExam,
  ]);

  // Combined Rows for Full Academic Year (รวม 2 ภาคเรียน: เทอม 1 + เทอม 2 ÷ 2)
  const combinedRows = useMemo(() => {
    if (!selectedSubject || selectedSemester !== 'combined') return [];

    return classroomStudents.map((student) => {
      const scoreObj = scores.find(
        (sc) => sc.studentId === student.id && sc.subjectId === selectedSubject.id
      );

      const s1Total = scoreObj?.semester1?.totalSemesterScore || 0;
      const s2Total = scoreObj?.semester2?.totalSemesterScore || 0;
      const combinedAverage = Number(((s1Total + s2Total) / 2).toFixed(2));
      const grade = calculateGrade(combinedAverage);
      const passed = grade >= 1;

      return {
        student,
        s1Total,
        s2Total,
        combinedAverage,
        grade,
        passed,
      };
    });
  }, [classroomStudents, selectedSubject, selectedSemester, scores]);

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return computedRows;
    const q = searchQuery.toLowerCase().trim();
    return computedRows.filter(
      (r) =>
        `${r.student.firstName} ${r.student.lastName}`.toLowerCase().includes(q) ||
        r.student.studentCode.toLowerCase().includes(q) ||
        String(r.student.studentNumber).includes(q)
    );
  }, [computedRows, searchQuery]);

  // Summary Statistics
  const stats = useMemo(() => {
    if (computedRows.length === 0) {
      return {
        total: 0,
        passedCount: 0,
        failedCount: 0,
        passRate: 0,
        avgTotalScore: 0,
        avgGrade: 0,
        maxScore: 0,
        minScore: 0,
        gradeCounts: { 4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0 } as Record<number, number>,
      };
    }

    const total = computedRows.length;
    let passedCount = 0;
    let sumTotal = 0;
    let sumGrade = 0;
    let maxScore = -Infinity;
    let minScore = Infinity;
    const gradeCounts: Record<number, number> = { 4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0 };

    computedRows.forEach((r) => {
      if (r.passed) passedCount++;
      sumTotal += r.totalScore;
      sumGrade += r.grade;
      if (r.totalScore > maxScore) maxScore = r.totalScore;
      if (r.totalScore < minScore) minScore = r.totalScore;
      gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
    });

    return {
      total,
      passedCount,
      failedCount: total - passedCount,
      passRate: Number(((passedCount / total) * 100).toFixed(1)),
      avgTotalScore: Number((sumTotal / total).toFixed(2)),
      avgGrade: Number((sumGrade / total).toFixed(2)),
      maxScore: maxScore === -Infinity ? 0 : maxScore,
      minScore: minScore === Infinity ? 0 : minScore,
      gradeCounts,
    };
  }, [computedRows]);

  // Handle direct score edit in table
  const handleScoreChange = (
    studentId: string,
    field: 'assignmentScore' | 'midtermScore' | 'finalScore',
    valueStr: string
  ) => {
    let clean = valueStr.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    // คะแนนสอบ ไม่ต้องใส่ 0 นำหน้า: ตัดเลข 0 ที่อยู่ด้านหน้าออก (เช่น "08" -> "8")
    if (clean.length > 1 && clean.startsWith('0') && clean[1] !== '.') {
      clean = clean.replace(/^0+/, '') || '0';
    }

    if (clean === '') {
      setCustomScores((prev) => {
        const current = prev[studentId] || {};
        return {
          ...prev,
          [studentId]: {
            ...current,
            [field]: 0,
          },
        };
      });
      setIsSaved(false);
      return;
    }

    const num = parseFloat(clean);
    if (!isNaN(num)) {
      const maxVal =
        field === 'assignmentScore'
          ? activeWeights.coursework
          : field === 'midtermScore'
          ? activeWeights.midterm
          : activeWeights.final;

      const clamped = Math.max(0, Math.min(maxVal, num));

      setCustomScores((prev) => {
        const current = prev[studentId] || {};
        return {
          ...prev,
          [studentId]: {
            ...current,
            [field]: clamped,
          },
        };
      });
      setIsSaved(false);
    }
  };

  // Quick Preset Weight Application
  const applyPresetWeights = (cw: number, mid: number, fin: number) => {
    setTempWeights({ coursework: cw, midterm: mid, final: fin });
  };

  // Save Weight configuration
  const handleSaveWeights = () => {
    if (tempTotalWeight !== 100) {
      alert(`สัดส่วนคะแนนรวมต้องเท่ากับ 100 คะแนนพอดี (ปัจจุบันรวมได้ ${tempTotalWeight} คะแนน)`);
      return;
    }
    setWeights(tempWeights);
    setShowWeightModal(false);

    // Save ratio back into Subject if requested
    if (selectedSubject) {
      const examW = tempWeights.midterm + tempWeights.final;
      const presetStr = `${tempWeights.coursework}:${examW}` as any;
      const updatedSubject: Subject = {
        ...selectedSubject,
        ...(selectedSemester === 2
          ? {
              ratioSemester2: {
                courseworkWeight: tempWeights.coursework,
                examWeight: examW,
                midtermWeight: tempWeights.midterm,
                finalExamWeight: tempWeights.final,
                totalTargetScore: 100,
                ratioPreset: presetStr,
              },
            }
          : {
              ratioSemester1: {
                courseworkWeight: tempWeights.coursework,
                examWeight: examW,
                midtermWeight: tempWeights.midterm,
                finalExamWeight: tempWeights.final,
                totalTargetScore: 100,
                ratioPreset: presetStr,
              },
            }),
      };
      storage.saveSubject(updatedSubject);
      if (onUpdateSubjects) {
        onUpdateSubjects(storage.getSubjects());
      }
    }
    showToast(`บันทึกสัดส่วน 2 ส่วน: ใบงาน ${tempWeights.coursework} : สอบ ${tempWeights.midterm + tempWeights.final} (รวม 100 คะแนน) เรียบร้อย`);
  };

  // Auto Recalculate & Sync from original raw assignments and exams
  const handleSyncFromSystem = () => {
    reloadExams();
    setCustomScores({});
    setIsSaved(true);
    showToast('ดึงคะแนนจริงจากใบงานและการสอบของระบบเรียบร้อยแล้ว');
  };

  // Quick Create Midterm or Final Exam if none exists
  const handleCreateDefaultExam = (type: 'midterm' | 'final') => {
    if (!selectedSubject) return;
    const semNum = selectedSemester === 2 ? 2 : 1;
    const isMid = type === 'midterm';
    const weightVal = isMid ? weights.midterm : weights.final;
    const title = isMid
      ? `แบบทดสอบกลางภาค ภาคเรียนที่ ${semNum}`
      : `แบบทดสอบปลายภาค ภาคเรียนที่ ${semNum}`;

    const newExam: Exam = {
      id: `exam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: selectedSubject.id,
      semester: semNum as 1 | 2,
      title,
      examType: isMid ? 'midterm' : 'final',
      maxScore: weightVal,
      passingScore: Math.round(weightVal * 0.5),
      targetClasses: selectedSubject.targetClasses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      examDate: new Date().toISOString().split('T')[0],
      description: `สร้างอัตโนมัติสำหรับเชื่อมโยงการตัดเกรด (คะแนนเต็ม ${weightVal} คะแนน)`,
    };

    storage.saveExam(newExam);
    reloadExams();
    if (isMid) {
      setSelectedMidtermExamId(newExam.id);
    } else {
      setSelectedFinalExamId(newExam.id);
    }
    showToast(`สร้าง "${title}" (เต็ม ${weightVal} คะแนน) เรียบร้อยแล้ว`);
  };

  // Sync only exams (reset custom midterm & final overrides to pull latest from exams)
  const handleSyncExamsOnly = () => {
    reloadExams();
    setCustomScores((prev) => {
      const next: Record<string, { assignmentScore?: number; midtermScore?: number; finalScore?: number }> = {};
      Object.keys(prev).forEach((stId) => {
        if (prev[stId]?.assignmentScore !== undefined) {
          next[stId] = { assignmentScore: prev[stId].assignmentScore };
        }
      });
      return next;
    });
    showToast('ดึงคะแนนล่าสุดจากแบบทดสอบกลางภาคและแบบทดสอบปลายภาคเรียบร้อยแล้ว');
  };

  // Save All Calculated Grades to Storage & Cloud
  const handleSaveAllGrades = () => {
    if (!selectedSubject) return;

    const existingScores = storage.getScores();
    const map = new Map<string, StudentSubjectScore>();
    existingScores.forEach((s) => map.set(s.id, s));

    computedRows.forEach((row) => {
      const scoreId = `score-${row.student.id}-${selectedSubject.id}`;
      const existing = map.get(scoreId) || {
        id: scoreId,
        studentId: row.student.id,
        subjectId: selectedSubject.id,
        academicYear: selectedSubject.academicYear || '2568',
        semester1: {
          assignmentScores: {},
          totalRawAssignments: 0,
          maxRawAssignments: 0,
          totalSemesterScore: 0,
          grade: 0,
        },
        semester2: {
          assignmentScores: {},
          totalRawAssignments: 0,
          maxRawAssignments: 0,
          totalSemesterScore: 0,
          grade: 0,
        },
        finalCombined: {
          s1Total: 0,
          s2Total: 0,
          combinedAverageScore: 0,
          finalGrade: 0,
          passed: false,
        },
        updatedAt: new Date().toISOString(),
      };

      const semField = selectedSemester === 2 ? 'semester2' : 'semester1';
      existing[semField] = {
        ...existing[semField],
        midtermScore: row.midtermScore,
        finalExamScore: row.finalScore,
        calculatedCoursework: row.assignmentScore,
        totalSemesterScore: row.totalScore,
        grade: row.grade,
      };

      // Recalculate final combined
      const s1 = existing.semester1?.totalSemesterScore || 0;
      const s2 = existing.semester2?.totalSemesterScore || 0;
      const avg = Number(((s1 + s2) / 2).toFixed(2));
      const finalGrade = calculateGrade(avg);

      existing.finalCombined = {
        s1Total: s1,
        s2Total: s2,
        combinedAverageScore: avg,
        finalGrade,
        passed: finalGrade >= 1,
        remark: finalGrade >= 1 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์ (รอสอบซ่อม)',
      };
      existing.updatedAt = new Date().toISOString();

      map.set(scoreId, existing);
    });

    const updatedScores = Array.from(map.values());
    storage.bulkSaveScores(updatedScores);
    onUpdateScores(updatedScores);

    setIsSaved(true);
    showToast(`บันทึกผลการตัดเกรดภาคเรียนที่ ${selectedSemester} ห้อง ${selectedClassKey} สำเร็จเรียบร้อย`);
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (!selectedSubject) return;

    if (selectedSemester === 'combined') {
      const data = combinedRows.map((r) => ({
        'เลขที่': r.student.studentNumber,
        'รหัสประจำตัว': r.student.studentCode,
        'ชื่อ-นามสกุล': `${r.student.prefix || ''}${r.student.firstName} ${r.student.lastName}`,
        'คะแนนภาคเรียนที่ 1 (เต็ม 100)': r.s1Total,
        'คะแนนภาคเรียนที่ 2 (เต็ม 100)': r.s2Total,
        'คะแนนเฉลี่ยรวม (เต็ม 100)': r.combinedAverage,
        'เกรดรวม': r.grade,
        'ผลการประเมิน': r.passed ? 'ผ่าน' : 'ไม่ผ่าน (สอบซ่อม)',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'สรุปเกรดรวมตลอดปี');
      XLSX.writeFile(wb, `สรุปเกรดรวม_${selectedSubject.code}_${selectedClassKey.replace(/\//g, '-')}.xlsx`);
    } else {
      const data = computedRows.map((r) => ({
        'เลขที่': r.student.studentNumber,
        'รหัสประจำตัว': r.student.studentCode,
        'ชื่อ-นามสกุล': `${r.student.prefix || ''}${r.student.firstName} ${r.student.lastName}`,
        [`คะแนนใบงาน (เต็ม ${activeWeights.coursework})`]: r.assignmentScore,
        [`คะแนนสอบกลางภาค (เต็ม ${activeWeights.midterm})`]: r.midtermScore,
        [`คะแนนสอบปลายภาค (เต็ม ${activeWeights.final})`]: r.finalScore,
        'คะแนนรวม (เต็ม 100)': r.totalScore,
        'เกรด': r.grade,
        'ผลการประเมิน': r.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์ (รอสอบซ่อม)',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `ตัดเกรดเทอม${selectedSemester}`);
      XLSX.writeFile(wb, `ตัดเกรด_${selectedSubject.code}_เทอม${selectedSemester}_${selectedClassKey.replace(/\//g, '-')}.xlsx`);
    }
  };

  // Print Grade Cut Sheet
  const handlePrint = () => {
    window.print();
  };

  if (accessibleSubjects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">ไม่พบข้อมูลรายวิชา</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          ยังไม่มีรายวิชาในระบบ หรือคุณยังไม่ได้รับมอบหมายรายวิชา กรุณาสร้างหรือมอบหมายรายวิชาก่อนใช้งานระบบตัดเกรด
        </p>
        {onNavigateToSubjects && (
          <button
            onClick={onNavigateToSubjects}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <span>ไปที่ระบบจัดการรายวิชา</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-700 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">ระบบตัดเกรด (เกณฑ์ 100 คะแนน)</h2>
                <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  แบ่ง 2 ภาคเรียน
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                รวมคะแนนจากใบงาน คะแนนสอบกลางภาค และคะแนนสอบปลายภาค ตัดเกรด 8 ระดับตามมาตรฐาน 100 คะแนน
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncFromSystem}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ดึงคะแนนล่าสุดจากระบบใบงานและข้อสอบ"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>ดึงคะแนนอัตโนมัติ</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออกรายงานตัดเกรดเป็นไฟล์ Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
              title="พิมพ์ใบสรุปผลการตัดเกรด (ปพ.5)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>พิมพ์ ปพ.5</span>
            </button>

            <button
              onClick={handleSaveAllGrades}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 ring-offset-1'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'บันทึกผลการตัดเกรด' : 'บันทึกคะแนนที่แก้ไข'}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Subject, Classroom, Semester Tabs */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* Subject Dropdown */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              เลือกรายวิชา:
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setCustomScores({});
              }}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {accessibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name} ({s.credits} นก.) [ครู{s.teacherName}]
                </option>
              ))}
            </select>
          </div>

          {/* Classroom Dropdown */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              เลือกห้องเรียน:
            </label>
            <select
              value={selectedClassKey}
              onChange={(e) => {
                setSelectedClassKey(e.target.value);
                setCustomScores({});
              }}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  ห้อง {c} ({students.filter((st) => st.classKey === c).length} คน)
                </option>
              ))}
            </select>
          </div>

          {/* Semester Tabs (แบ่งเป็น 2 ภาคเรียน) */}
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              ภาคเรียนที่ตัดเกรด:
            </label>
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedSemester(1);
                  setCustomScores({});
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  selectedSemester === 1
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 1
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSemester(2);
                  setCustomScores({});
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  selectedSemester === 2
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 2
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSemester('combined');
                  setCustomScores({});
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  selectedSemester === 'combined'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="รวม 2 ภาคเรียนเพื่อสรุปผลตลอดปีการศึกษา"
              >
                รวม 2 ภาคเรียน
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grade Scale Banner (เกณฑ์ 100 คะแนน) */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-950 font-bold">
          <Award className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>เกณฑ์การตัดเกรดมาตรฐาน 100 คะแนน:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-semibold border border-emerald-200">
            80-100: เกรด 4
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-semibold border border-emerald-200">
            75-79: เกรด 3.5
          </span>
          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-semibold border border-teal-200">
            70-74: เกรด 3
          </span>
          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-semibold border border-sky-200">
            65-69: เกรด 2.5
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold border border-amber-200">
            60-64: เกรด 2
          </span>
          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 font-semibold border border-orange-200">
            55-59: เกรด 1.5
          </span>
          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-semibold border border-stone-300">
            50-54: เกรด 1
          </span>
          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold border border-rose-200">
            0-49: เกรด 0 (สอบซ่อม)
          </span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">นักเรียนทั้งหมด</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats.total} <span className="text-xs font-normal text-slate-500">คน</span></p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">คะแนนเฉลี่ย (Mean)</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.avgTotalScore} <span className="text-xs font-normal text-slate-500">/ 100</span></p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">เกรดเฉลี่ย (GPA)</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats.avgGrade.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">ผ่านเกณฑ์ (เกรด ≥ 1)</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{stats.passedCount} <span className="text-xs font-normal text-emerald-600">({stats.passRate}%)</span></p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">ไม่ผ่าน (เกรด 0)</p>
          <p className={`text-xl font-bold mt-1 ${stats.failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {stats.failedCount} <span className="text-xs font-normal text-slate-500">คน</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500">คะแนนสูงสุด / ต่ำสุด</p>
          <p className="text-base font-bold text-slate-800 mt-1.5">
            <span className="text-emerald-600">{stats.maxScore}</span> / <span className="text-rose-500">{stats.minScore}</span>
          </p>
        </div>
      </div>

      {/* Grade Distribution Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span>การกระจายของเกรด (Grade Distribution):</span>
          </span>
          <span className="text-[11px] text-slate-500">
            ได้เกรด 4 ทั้งหมด {stats.gradeCounts[4] || 0} คน ({stats.total > 0 ? ((stats.gradeCounts[4] / stats.total) * 100).toFixed(0) : 0}%)
          </span>
        </div>
        <div className="grid grid-cols-8 gap-2 text-center">
          {[
            { g: 4, label: 'เกรด 4', color: 'bg-emerald-500 text-white' },
            { g: 3.5, label: 'เกรด 3.5', color: 'bg-emerald-400 text-white' },
            { g: 3, label: 'เกรด 3', color: 'bg-teal-500 text-white' },
            { g: 2.5, label: 'เกรด 2.5', color: 'bg-sky-500 text-white' },
            { g: 2, label: 'เกรด 2', color: 'bg-amber-500 text-white' },
            { g: 1.5, label: 'เกรด 1.5', color: 'bg-orange-500 text-white' },
            { g: 1, label: 'เกรด 1', color: 'bg-stone-500 text-white' },
            { g: 0, label: 'เกรด 0', color: 'bg-rose-500 text-white' },
          ].map((item) => (
            <div key={item.g} className="bg-slate-50 rounded-xl p-2 border border-slate-200">
              <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${item.color}`}>
                {item.label}
              </span>
              <p className="text-base font-bold text-slate-800 mt-1">{stats.gradeCounts[item.g] || 0}</p>
              <p className="text-[10px] text-slate-500">
                {stats.total > 0 ? (((stats.gradeCounts[item.g] || 0) / stats.total) * 100).toFixed(0) : 0}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              {selectedSemester === 'combined'
                ? `ตารางสรุปผลการตัดเกรดตลอดปีการศึกษา (รวม 2 ภาคเรียน) - ห้อง ${selectedClassKey}`
                : `ตารางตัดเกรด ภาคเรียนที่ ${selectedSemester} - ห้อง ${selectedClassKey}`}
            </h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {classroomStudents.length} คน
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่, รหัส, ชื่อ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Exam Linkage Panel (เชื่อมโยงคะแนนจากแบบทดสอบกลางภาค และแบบทดสอบปลายภาค) */}
        {selectedSemester !== 'combined' && (
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/60 to-purple-50/50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Midterm Exam Link Box */}
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-blue-200 shadow-2xs">
                <span className="font-bold text-blue-950 flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  คะแนนสอบกลางภาค:
                </span>
                {midtermExam ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={midtermExam.id}
                      onChange={(e) => {
                        setSelectedMidtermExamId(e.target.value);
                        setCustomScores((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((id) => delete next[id]?.midtermScore);
                          return next;
                        });
                      }}
                      className="font-semibold text-blue-800 bg-blue-50/60 border border-blue-200 rounded-lg px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[200px] truncate"
                      title="เลือกแบบทดสอบกลางภาคที่จะนำมาใช้"
                    >
                      {availableExamsForSubject.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} (เต็ม {ex.maxScore})
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-blue-700 font-bold bg-blue-100/90 px-2 py-0.5 rounded-md">
                      เต็ม {activeWeights.midterm} คะแนน
                    </span>
                    <span className="text-[11px] text-blue-600 font-mono">
                      (กรอกแล้ว {midtermScoredCount}/{classroomStudents.length} คน)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-medium">ยังไม่มีแบบทดสอบกลางภาค</span>
                    <button
                      type="button"
                      onClick={() => handleCreateDefaultExam('midterm')}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                    >
                      + สร้างแบบทดสอบกลางภาค ({activeWeights.midterm} คะแนน)
                    </button>
                  </div>
                )}
              </div>

              {/* Final Exam Link Box */}
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-indigo-200 shadow-2xs">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  คะแนนสอบปลายภาค:
                </span>
                {finalExam ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={finalExam.id}
                      onChange={(e) => {
                        setSelectedFinalExamId(e.target.value);
                        setCustomScores((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((id) => delete next[id]?.finalScore);
                          return next;
                        });
                      }}
                      className="font-semibold text-indigo-800 bg-indigo-50/60 border border-indigo-200 rounded-lg px-2 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate"
                      title="เลือกแบบทดสอบปลายภาคที่จะนำมาใช้"
                    >
                      {availableExamsForSubject.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} (เต็ม {ex.maxScore})
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-indigo-700 font-bold bg-indigo-100/90 px-2 py-0.5 rounded-md">
                      เต็ม {activeWeights.final} คะแนน
                    </span>
                    <span className="text-[11px] text-indigo-600 font-mono">
                      (กรอกแล้ว {finalScoredCount}/{classroomStudents.length} คน)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-medium">ยังไม่มีแบบทดสอบปลายภาค</span>
                    <button
                      type="button"
                      onClick={() => handleCreateDefaultExam('final')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                    >
                      + สร้างแบบทดสอบปลายภาค ({activeWeights.final} คะแนน)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sync Exam Scores button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncExamsOnly}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer text-xs"
                title="ดึงคะแนนล่าสุดจากแบบทดสอบกลางภาคและปลายภาคเข้ามาคำนวณตัดเกรด"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                <span>ดึงคะแนนจากแบบทดสอบ</span>
              </button>
            </div>
          </div>
        )}

        {/* The Requested Table */}
        {selectedSemester === 'combined' ? (
          /* Combined 2-Semester Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                  <th className="py-3 px-3 w-24">รหัสประจำตัว</th>
                  <th className="py-3 px-4 min-w-[180px]">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4 text-center bg-blue-50/70 text-blue-900">ภาคเรียนที่ 1 (เต็ม 100)</th>
                  <th className="py-3 px-4 text-center bg-indigo-50/70 text-indigo-900">ภาคเรียนที่ 2 (เต็ม 100)</th>
                  <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-950 font-extrabold">คะแนนรวมเฉลี่ย (100)</th>
                  <th className="py-3 px-4 text-center">เกรดเฉลี่ย</th>
                  <th className="py-3 px-4 text-center">ผลการประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {combinedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      ไม่พบข้อมูลนักเรียนในห้องนี้
                    </td>
                  </tr>
                ) : (
                  combinedRows.map((row) => {
                    const gradeInfo = getGradeLabel(row.grade);
                    return (
                      <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-600">{row.student.studentNumber}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{row.student.studentCode}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {row.student.prefix || ''}{row.student.firstName} {row.student.lastName}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-semibold text-blue-800 bg-blue-50/30">
                          {row.s1Total}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-semibold text-indigo-800 bg-indigo-50/30">
                          {row.s2Total}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-extrabold text-emerald-900 bg-emerald-50/40 text-sm">
                          {row.combinedAverage}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs border ${gradeInfo.bgClass} ${gradeInfo.textClass} ${gradeInfo.borderClass}`}>
                            {row.grade}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {row.passed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ผ่านเกณฑ์</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>ไม่ผ่าน (สอบซ่อม)</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Semester 1 / Semester 2 Table (As requested: รายชื่อ, คะแนนรวมใบงาน, กลางภาค, ปลายภาค, สรุปเกรด) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                  <th className="py-3 px-3 w-24">รหัสประจำตัว</th>
                  <th className="py-3 px-4 min-w-[170px]">ชื่อ - นามสกุล</th>
                  
                  {/* 1. คะแนนเก็บใบงาน/ภาระงาน */}
                  <th className="py-3 px-3 text-center bg-teal-50/80 text-teal-950 min-w-[140px]">
                    <div className="font-extrabold text-teal-950">1. คะแนนเก็บใบงาน/ภาระงาน</div>
                    <div className="text-[10px] font-bold text-teal-700">
                      (เต็ม {activeWeights.coursework} คะแนน)
                    </div>
                  </th>

                  {/* 2.1 คะแนนสอบกลางภาค */}
                  <th className="py-3 px-3 text-center bg-blue-50/80 text-blue-950 min-w-[140px]">
                    <div className="font-extrabold text-blue-950">2.1 สอบกลางภาค</div>
                    <div className="text-[10px] font-bold text-blue-700">
                      (เต็ม {activeWeights.midterm} คะแนน)
                    </div>
                    {midtermExam && (
                      <div
                        className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-normal bg-blue-100/90 text-blue-800 max-w-[130px] truncate"
                        title={`ยึดคะแนนเต็มตาม: ${midtermExam.title} (${midtermExam.maxScore} คะแนน)`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="truncate">{midtermExam.title}</span>
                      </div>
                    )}
                  </th>

                  {/* 2.2 คะแนนสอบปลายภาค */}
                  <th className="py-3 px-3 text-center bg-indigo-50/80 text-indigo-950 min-w-[140px]">
                    <div className="font-extrabold text-indigo-950">2.2 สอบปลายภาค</div>
                    <div className="text-[10px] font-bold text-indigo-700">
                      (เต็ม {activeWeights.final} คะแนน)
                    </div>
                    {finalExam && (
                      <div
                        className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-normal bg-indigo-100/90 text-indigo-800 max-w-[130px] truncate"
                        title={`ยึดคะแนนเต็มตาม: ${finalExam.title} (${finalExam.maxScore} คะแนน)`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <span className="truncate">{finalExam.title}</span>
                      </div>
                    )}
                  </th>

                  {/* คะแนนรวม (เต็ม 100) */}
                  <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-950 font-extrabold min-w-[120px]">
                    <div>คะแนนรวม</div>
                    <div className="text-[10px] font-bold text-emerald-700">
                      (เต็ม 100 คะแนน)
                    </div>
                  </th>

                  {/* สรุปเกรด */}
                  <th className="py-3 px-3 text-center min-w-[100px] bg-slate-100">
                    <div>สรุปเกรด</div>
                    <div className="text-[10px] font-semibold text-slate-500">(0 - 4)</div>
                  </th>

                  {/* ผลการประเมิน */}
                  <th className="py-3 px-3 text-center min-w-[120px]">
                    ผลการประเมิน
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const gradeInfo = getGradeLabel(row.grade);
                    return (
                      <tr
                        key={row.student.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row.isModified ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-slate-600">
                          {row.student.studentNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {row.student.studentCode}
                        </td>
                        <td className="py-2 px-4 font-semibold text-slate-800">
                          {row.student.prefix || ''}{row.student.firstName} {row.student.lastName}
                        </td>

                        {/* คะแนนรวมจากใบงาน */}
                        <td className="py-2.5 px-3 text-center bg-teal-50/20">
                          <span
                            className="font-mono font-bold text-xs text-teal-900"
                            title={`คะแนนดิบรวม: ${row.rawAssignmentScore} / ${row.maxAssignmentScore}`}
                          >
                            {row.assignmentScore !== undefined && row.assignmentScore !== null ? row.assignmentScore : 0}
                          </span>
                        </td>

                        {/* คะแนนสอบกลางภาค */}
                        <td className="py-2.5 px-3 text-center bg-blue-50/20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span
                              className={`font-mono font-bold text-xs ${
                                row.midtermStatus === 'absent' ? 'text-rose-600' : 'text-blue-900'
                              }`}
                              title={
                                row.midtermStatus === 'absent'
                                  ? 'ขาดสอบแบบทดสอบกลางภาค'
                                  : row.midtermRaw !== undefined
                                  ? `คะแนนดิบ: ${row.midtermRaw}/${midtermExam?.rawMaxScore || midtermExam?.maxScore || activeWeights.midterm} (หารเทียบสัดส่วนเต็ม ${activeWeights.midterm})${row.midtermStatus === 'retested' ? ' (สอบแก้ตัว)' : ''}`
                                  : `คะแนนเต็ม ${activeWeights.midterm} คะแนน (ยึดตามแบบทดสอบกลางภาค)`
                              }
                            >
                              {row.midtermScore !== undefined && row.midtermScore !== null ? row.midtermScore : 0}
                            </span>
                            {row.midtermRaw !== undefined && row.midtermStatus !== 'absent' && (
                              <span className="text-[9px] text-blue-600/80 font-mono" title={`คะแนนดิบที่ทำได้ ${row.midtermRaw} คะแนน นำมาหารเทียบสัดส่วนเต็ม ${activeWeights.midterm}`}>
                                ดิบ {row.midtermRaw}
                              </span>
                            )}
                            {row.midtermStatus === 'absent' && (
                              <span className="text-[9px] text-rose-600 font-bold">ขาดสอบ</span>
                            )}
                            {row.midtermStatus === 'retested' && (
                              <span className="text-[9px] text-amber-600 font-bold">สอบแก้ตัว</span>
                            )}
                          </div>
                        </td>

                        {/* คะแนนสอบปลายภาค */}
                        <td className="py-2.5 px-3 text-center bg-indigo-50/20">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span
                              className={`font-mono font-bold text-xs ${
                                row.finalStatus === 'absent' ? 'text-rose-600' : 'text-indigo-900'
                              }`}
                              title={
                                row.finalStatus === 'absent'
                                  ? 'ขาดสอบแบบทดสอบปลายภาค'
                                  : row.finalRaw !== undefined
                                  ? `คะแนนดิบ: ${row.finalRaw}/${finalExam?.rawMaxScore || finalExam?.maxScore || activeWeights.final} (หารเทียบสัดส่วนเต็ม ${activeWeights.final})${row.finalStatus === 'retested' ? ' (สอบแก้ตัว)' : ''}`
                                  : `คะแนนเต็ม ${activeWeights.final} คะแนน (ยึดตามแบบทดสอบปลายภาค)`
                              }
                            >
                              {row.finalScore !== undefined && row.finalScore !== null ? row.finalScore : 0}
                            </span>
                            {row.finalRaw !== undefined && row.finalStatus !== 'absent' && (
                              <span className="text-[9px] text-indigo-600/80 font-mono" title={`คะแนนดิบที่ทำได้ ${row.finalRaw} คะแนน นำมาหารเทียบสัดส่วนเต็ม ${activeWeights.final}`}>
                                ดิบ {row.finalRaw}
                              </span>
                            )}
                            {row.finalStatus === 'absent' && (
                              <span className="text-[9px] text-rose-600 font-bold">ขาดสอบ</span>
                            )}
                            {row.finalStatus === 'retested' && (
                              <span className="text-[9px] text-amber-600 font-bold">สอบแก้ตัว</span>
                            )}
                          </div>
                        </td>

                        {/* คะแนนรวม (เต็ม 100) */}
                        <td className="py-2 px-3 text-center bg-emerald-50/50">
                          <span className="font-mono font-extrabold text-sm text-emerald-900">
                            {row.totalScore.toFixed(1)}
                          </span>
                        </td>

                        {/* สรุปเกรด */}
                        <td className="py-2 px-3 text-center bg-slate-50">
                          <span
                            className={`inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-lg font-black text-xs border ${gradeInfo.bgClass} ${gradeInfo.textClass} ${gradeInfo.borderClass}`}
                          >
                            {row.grade}
                          </span>
                        </td>

                        {/* ผลการประเมิน */}
                        <td className="py-2 px-3 text-center">
                          {row.passed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ผ่านเกณฑ์</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>สอบซ่อม</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Summary Average Row at Bottom */}
              {computedRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-xs text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-4 text-right">
                      ค่าเฉลี่ยประจำห้องเรียน (Mean):
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-teal-900">
                      {(
                        computedRows.reduce((sum, r) => sum + r.assignmentScore, 0) /
                        computedRows.length
                      ).toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-blue-900">
                      {(
                        computedRows.reduce((sum, r) => sum + r.midtermScore, 0) /
                        computedRows.length
                      ).toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-indigo-900">
                      {(
                        computedRows.reduce((sum, r) => sum + r.finalScore, 0) /
                        computedRows.length
                      ).toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-sm text-emerald-900 bg-emerald-100/70">
                      {stats.avgTotalScore}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-slate-800 bg-slate-200">
                      {stats.avgGrade.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-700 font-bold">
                      ผ่าน {stats.passRate}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Modal: Set Weight Ratio (สัดส่วนคะแนนรวม 100) */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">กำหนดสัดส่วนคะแนน (เต็ม 100)</h3>
              </div>
              <button
                onClick={() => setShowWeightModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              กำหนดน้ำหนักคะแนนระหว่างภาคเรียน กลางภาค และปลายภาค เพื่อใช้เป็นเกณฑ์คิดคะแนนรวม 100 คะแนน
            </p>

            {/* Linked Exams Notice */}
            {(midtermExam || finalExam) && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>ยึดคะแนนเต็มตามแบบทดสอบที่เชื่อมโยง:</span>
                </div>
                {midtermExam && (
                  <div className="text-blue-800 text-[11px] pl-5">
                    • แบบทดสอบกลางภาค: <span className="font-semibold">{midtermExam.title}</span> (คะแนนเต็ม {midtermExam.maxScore} คะแนน)
                  </div>
                )}
                {finalExam && (
                  <div className="text-indigo-800 text-[11px] pl-5">
                    • แบบทดสอบปลายภาค: <span className="font-semibold">{finalExam.title}</span> (คะแนนเต็ม {finalExam.maxScore} คะแนน)
                  </div>
                )}
                <div className="text-slate-600 text-[11px] pl-5 pt-0.5">
                  • คะแนนเก็บจากใบงานจะคำนวณปรับให้สอดคล้องเป็น {activeWeights.coursework} คะแนน (รวมทั้งสิ้น 100 คะแนน)
                </div>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">สัดส่วนมาตรฐาน 2 ส่วน (ใบงาน : สอบ):</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { cw: 70, mid: 15, fin: 15, label: '70 : 30' },
                  { cw: 60, mid: 20, fin: 20, label: '60 : 40' },
                  { cw: 50, mid: 20, fin: 30, label: '50 : 50' },
                  { cw: 80, mid: 10, fin: 10, label: '80 : 20' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => applyPresetWeights(item.cw, item.mid, item.fin)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold border text-center transition-colors cursor-pointer ${
                      tempWeights.coursework === item.cw && tempWeights.midterm + tempWeights.final === (100 - item.cw)
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs: 2 Parts */}
            <div className="space-y-3 pt-2">
              {/* Part 1: Coursework */}
              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-950">
                    1. คะแนนเก็บใบงาน/ภาระงาน:
                  </label>
                  <span className="text-[11px] font-bold text-teal-700">
                    {tempWeights.coursework} / 100
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tempWeights.coursework}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      const remainingExam = 100 - val;
                      const currentExam = tempWeights.midterm + tempWeights.final;
                      let newMid = Math.round(remainingExam / 2);
                      let newFin = remainingExam - newMid;
                      if (currentExam > 0) {
                        newMid = Math.round((tempWeights.midterm / currentExam) * remainingExam);
                        newFin = remainingExam - newMid;
                      }
                      setTempWeights({ coursework: val, midterm: newMid, final: newFin });
                    }}
                    className="w-full text-xs font-bold bg-white border border-teal-300 rounded-xl px-3 py-2 text-slate-800"
                  />
                  <span className="text-xs text-teal-800 font-semibold shrink-0">คะแนน</span>
                </div>
                <p className="text-[10px] text-teal-700">เมื่อกำหนดคะแนนเก็บจากใบงานแล้ว คะแนนที่เหลือจะกลายเป็นคะแนนสอบโดยอัตโนมัติ</p>
              </div>

              {/* Part 2: Exams */}
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-950">
                    2. คะแนนสอบ (คงเหลือจากใบงาน):
                  </label>
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    {tempWeights.midterm + tempWeights.final} คะแนน
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      2.1 สอบกลางภาค:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max={100 - tempWeights.coursework}
                        value={tempWeights.midterm}
                        onChange={(e) => {
                          const newMid = Math.max(0, Number(e.target.value) || 0);
                          const remainingExam = 100 - tempWeights.coursework;
                          const newFin = Math.max(0, remainingExam - newMid);
                          setTempWeights({ ...tempWeights, midterm: newMid, final: newFin });
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500">คะแนน</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      2.2 สอบปลายภาค:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max={100 - tempWeights.coursework}
                        value={tempWeights.final}
                        onChange={(e) => {
                          const newFin = Math.max(0, Number(e.target.value) || 0);
                          const remainingExam = 100 - tempWeights.coursework;
                          const newMid = Math.max(0, remainingExam - newFin);
                          setTempWeights({ ...tempWeights, midterm: newMid, final: newFin });
                        }}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500">คะแนน</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Validation */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                tempTotalWeight === 100
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>คะแนนรวมทั้งหมด:</span>
              <span>{tempTotalWeight} / 100 คะแนน {tempTotalWeight === 100 ? '✓' : '(ต้องได้ 100)'}</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWeightModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveWeights}
                disabled={tempTotalWeight !== 100}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                บันทึกสัดส่วนคะแนน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
