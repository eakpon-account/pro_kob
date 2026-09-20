import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Save, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Award, 
  BarChart3, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Calculator,
  Percent,
  Info,
  Users, 
  Calendar, 
  Check, 
  X, 
  ArrowUpDown,
  BookOpen,
  Sparkles,
  ClipboardList,
  Sliders
} from 'lucide-react';
import { 
  Student, 
  Subject, 
  User, 
  Exam, 
  ExamRecord, 
  ExamType, 
  StudentExamScore,
  SchoolSettings 
} from '../types';
import { storage } from '../services/storage';
import { formatStrandDisplay, cleanStrandInput } from '../utils/strandFormatter';
import { getSubjectRatio } from '../utils/grading';
import { PrintExamModal } from './PrintExamModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ExamScoreManagementProps {
  currentUser: User;
  students: Student[];
  subjects: Subject[];
  initialSubjectId?: string;
  initialClassKey?: string;
  onNavigateToSubjects?: () => void;
  onNavigateToRatios?: (subjectId?: string) => void;
}

const EXAM_TYPE_LABELS: Record<ExamType, { label: string; badge: string }> = {
  unit_quiz: { label: 'แบบทดสอบย่อย / ท้ายบท', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  midterm: { label: 'สอบกลางภาคเรียน', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  final: { label: 'สอบปลายภาคเรียน', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  practical: { label: 'สอบปฏิบัติ / ทักษะ', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  retest: { label: 'สอบแก้ตัว', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  custom: { label: 'แบบทดสอบอื่นๆ', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const ExamScoreManagement: React.FC<ExamScoreManagementProps> = ({
  currentUser,
  students,
  subjects,
  initialSubjectId,
  initialClassKey,
  onNavigateToSubjects,
  onNavigateToRatios,
}) => {
  // Filter available subjects based on user role (Admin/Executive sees all, Teacher sees assigned or all if none assigned yet)
  const accessibleSubjects = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'executive') return subjects;
    const mySubjects = subjects.filter((s) => s.teacherId === currentUser.id || s.teacherName === currentUser.name);
    return mySubjects.length > 0 ? mySubjects : subjects;
  }, [subjects, currentUser]);

  // Selected Subject & Class & Semester
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && accessibleSubjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return accessibleSubjects.length > 0 ? accessibleSubjects[0].id : '';
  });

  // Keep selectedSubjectId in sync when accessible subjects change
  useEffect(() => {
    if (accessibleSubjects.length > 0 && !accessibleSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(accessibleSubjects[0].id);
    }
  }, [accessibleSubjects, selectedSubjectId]);

  const selectedSubject = useMemo(() => {
    return accessibleSubjects.find((s) => s.id === selectedSubjectId) || accessibleSubjects[0];
  }, [accessibleSubjects, selectedSubjectId]);

  // Available classes for selected subject (merged with student roster classes)
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
    return availableClasses.length > 0 ? availableClasses[0] : '';
  });

  // Ensure classKey updates when subject changes
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClassKey)) {
      setSelectedClassKey(availableClasses[0]);
    }
  }, [availableClasses, selectedClassKey]);

  // Semester filter
  const [selectedSemester, setSelectedSemester] = useState<'all' | '1' | '2'>('all');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Active sub-tab: 'exams_list' | 'score_entry' | 'matrix_summary'
  const [activeTab, setActiveTab] = useState<'exams_list' | 'score_entry' | 'matrix_summary'>('exams_list');

  // Data states from storage
  const [exams, setExams] = useState<Exam[]>(() => storage.getExams());
  const [examRecords, setExamRecords] = useState<ExamRecord[]>(() => storage.getExamRecords());
  const [schoolSettings] = useState<SchoolSettings>(() => storage.getSchoolSettings());

  // Currently selected Exam for score entry
  const [activeExamId, setActiveExamId] = useState<string>('');

  // Expand/collapse state for exam list rows (ถ้าตารางไม่พอให้ซ่อน เรียกใช้โดยการกดขยาย)
  const [expandedExamIds, setExpandedExamIds] = useState<Set<string>>(new Set());

  const toggleExamExpanded = (id: string) => {
    setExpandedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllExamsExpanded = () => {
    if (expandedExamIds.size === filteredExams.length) {
      setExpandedExamIds(new Set());
    } else {
      setExpandedExamIds(new Set(filteredExams.map((e) => e.id)));
    }
  };

  // Modal states
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printExamTarget, setPrintExamTarget] = useState<Exam | null>(null);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered exams for current subject and semester
  const filteredExams = useMemo(() => {
    if (!selectedSubject) return [];
    return exams.filter((ex) => {
      if (ex.subjectId !== selectedSubject.id) return false;
      if (selectedSemester !== 'all' && ex.semester.toString() !== selectedSemester) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = ex.title.toLowerCase().includes(q);
        const topicMatch = ex.topic?.toLowerCase().includes(q);
        const strandMatch = ex.strand?.toLowerCase().includes(q);
        if (!titleMatch && !topicMatch && !strandMatch) return false;
      }
      return true;
    });
  }, [exams, selectedSubject, selectedSemester, searchQuery]);

  // Set initial active exam if none selected
  useEffect(() => {
    if (filteredExams.length > 0 && (!activeExamId || !filteredExams.some((e) => e.id === activeExamId))) {
      setActiveExamId(filteredExams[0].id);
    }
  }, [filteredExams, activeExamId]);

  const activeExam = useMemo(() => {
    return exams.find((e) => e.id === activeExamId) || null;
  }, [exams, activeExamId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    if (!selectedClassKey) return [];
    return students
      .filter((s) => s.classKey === selectedClassKey)
      .sort((a, b) => a.studentNumber - b.studentNumber);
  }, [students, selectedClassKey]);

  // Current Exam Record for active exam and selected class
  const currentExamRecord = useMemo(() => {
    if (!activeExam || !selectedClassKey) return null;
    return examRecords.find(
      (r) => r.examId === activeExam.id && r.classKey === selectedClassKey
    ) || null;
  }, [activeExam, selectedClassKey, examRecords]);

  // Local scores state for active exam grading
  const [workingScores, setWorkingScores] = useState<Record<string, StudentExamScore>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Ratios per subject and semester from score ratio management
  const ratioSem1 = useMemo(() => getSubjectRatio(selectedSubject, 1), [selectedSubject]);
  const ratioSem2 = useMemo(() => getSubjectRatio(selectedSubject, 2), [selectedSubject]);
  const currentRatio = useMemo(() => {
    if (selectedSemester === '2') return ratioSem2;
    return ratioSem1;
  }, [selectedSemester, ratioSem1, ratioSem2]);

  // Initialize working scores when active exam or class changes
  useEffect(() => {
    if (!activeExam || !selectedClassKey) {
      setWorkingScores({});
      setIsDirty(false);
      return;
    }

    const initial: Record<string, StudentExamScore> = {};
    const existingScores = currentExamRecord?.studentScores || {};
    const rawMax = activeExam.rawMaxScore || activeExam.maxScore;

    classStudents.forEach((student) => {
      if (existingScores[student.id]) {
        const s = existingScores[student.id];
        const computedScaled = s.scaledScore !== undefined 
          ? s.scaledScore 
          : (s.score !== undefined && rawMax > 0 
              ? Number(((s.score / rawMax) * activeExam.maxScore).toFixed(2)) 
              : undefined);

        initial[student.id] = { 
          ...s,
          scaledScore: computedScaled
        };
      } else {
        initial[student.id] = {
          studentId: student.id,
          status: 'normal',
          note: '',
        };
      }
    });

    setWorkingScores(initial);
    setIsDirty(false);
  }, [activeExam?.id, selectedClassKey, classStudents, currentExamRecord]);

  // Score handlers - คะแนนสอบ ไม่ต้องใส่ 0 นำหน้า (เก็บบันทึกคะแนนดิบและคำนวณคะแนนจริงตามสัดส่วน)
  const handleScoreChange = (studentId: string, value: string) => {
    if (!activeExam) return;
    
    // Clean string: allow only numbers and a single decimal point
    let clean = value.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    // คะแนนสอบ ไม่ต้องใส่ 0 นำหน้า: ตัด 0 ที่อยู่ข้างหน้าตัวเลขออก (เช่น "05" -> "5", "00" -> "0")
    if (clean.length > 1 && clean.startsWith('0') && clean[1] !== '.') {
      clean = clean.replace(/^0+/, '') || '0';
    }

    if (clean === '') {
      setWorkingScores((prev) => {
        const current = { ...(prev[studentId] || { studentId, status: 'normal' }) };
        delete current.score;
        delete current.scaledScore;
        return {
          ...prev,
          [studentId]: current,
        };
      });
      setIsDirty(true);
      return;
    }

    const num = parseFloat(clean);
    if (!isNaN(num)) {
      const rawMax = activeExam.rawMaxScore || activeExam.maxScore;
      const clamped = Math.max(0, Math.min(rawMax, num));
      const scaled = rawMax > 0 ? Number(((clamped / rawMax) * activeExam.maxScore).toFixed(2)) : clamped;

      setWorkingScores((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { studentId, status: 'normal' }),
          score: clamped,
          scaledScore: scaled,
        },
      }));
      setIsDirty(true);
    }
  };

  const handleRetestScoreChange = (studentId: string, value: string) => {
    if (!activeExam) return;
    
    let clean = value.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    // คะแนนสอบ ไม่ต้องใส่ 0 นำหน้า
    if (clean.length > 1 && clean.startsWith('0') && clean[1] !== '.') {
      clean = clean.replace(/^0+/, '') || '0';
    }

    if (clean === '') {
      setWorkingScores((prev) => {
        const current = { ...(prev[studentId] || { studentId, status: 'normal' }) };
        delete current.retestScore;
        return {
          ...prev,
          [studentId]: current,
        };
      });
      setIsDirty(true);
      return;
    }

    const num = parseFloat(clean);
    if (!isNaN(num)) {
      const rawMax = activeExam.rawMaxScore || activeExam.maxScore;
      const clamped = Math.max(0, Math.min(rawMax, num));
      const scaled = rawMax > 0 ? Number(((clamped / rawMax) * activeExam.maxScore).toFixed(2)) : clamped;

      setWorkingScores((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { studentId, status: 'normal' }),
          retestScore: clamped,
          scaledScore: scaled,
        },
      }));
      setIsDirty(true);
    }
  };

  const handleStatusChange = (studentId: string, status: 'normal' | 'absent' | 'leave' | 'retested') => {
    setWorkingScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { studentId, score: 0 }),
        status,
      },
    }));
    setIsDirty(true);
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setWorkingScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { studentId, score: 0, status: 'normal' }),
        note,
      },
    }));
    setIsDirty(true);
  };

  // Save scores to storage
  const handleSaveScores = () => {
    if (!activeExam || !selectedClassKey) return;

    const recordToSave: ExamRecord = {
      id: currentExamRecord?.id || `examrec-${activeExam.id}-${selectedClassKey.replace(/\//g, '_')}`,
      examId: activeExam.id,
      subjectId: activeExam.subjectId,
      classKey: selectedClassKey,
      academicYear: schoolSettings.academicYear || '2568',
      semester: activeExam.semester,
      studentScores: workingScores,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
    };

    storage.saveExamRecord(recordToSave);
    setExamRecords(storage.getExamRecords());
    setIsDirty(false);
    showToast(`บันทึกคะแนนสอบ "${activeExam.title}" ห้อง ${selectedClassKey} เรียบร้อยแล้ว`);
  };

  // Quick fill helpers
  const handleQuickFillMax = () => {
    if (!activeExam) return;
    const rawMax = activeExam.rawMaxScore || activeExam.maxScore;
    const updated = { ...workingScores };
    classStudents.forEach((st) => {
      updated[st.id] = {
        ...(updated[st.id] || { studentId: st.id }),
        score: rawMax,
        scaledScore: activeExam.maxScore,
        status: 'normal',
      };
    });
    setWorkingScores(updated);
    setIsDirty(true);
    showToast(`กรอกคะแนนดิบเต็ม ${rawMax} คะแนน (เทียบเท่าคะแนนจริง ${activeExam.maxScore}) ให้นักเรียนทุกคนแล้ว`);
  };

  const handleQuickSetAllPresent = () => {
    const updated = { ...workingScores };
    classStudents.forEach((st) => {
      updated[st.id] = {
        ...(updated[st.id] || { studentId: st.id }),
        status: 'normal',
      };
    });
    setWorkingScores(updated);
    setIsDirty(true);
    showToast('ปรับสถานะนักเรียนทุกคนเป็น "เข้าสอบปกติ"');
  };

  const handleQuickClearAll = () => {
    if (!window.confirm('คุณต้องการล้างคะแนนของห้องนี้ทั้งหมดหรือไม่?')) return;
    const updated = { ...workingScores };
    classStudents.forEach((st) => {
      updated[st.id] = {
        studentId: st.id,
        status: 'normal',
        note: '',
      };
    });
    setWorkingScores(updated);
    setIsDirty(true);
    showToast('ล้างคะแนนทั้งหมดแล้ว');
  };

  // Add / Edit Exam Form State
  const [examFormData, setExamFormData] = useState<{
    title: string;
    examType: ExamType;
    semester: 1 | 2;
    strand: string;
    topic: string;
    indicator: string;
    rawMaxScore: number;
    maxScore: number;
    passingScore: number;
    examDate: string;
    description: string;
  }>({
    title: '',
    examType: 'unit_quiz',
    semester: 1,
    strand: '',
    topic: '',
    indicator: '',
    rawMaxScore: 40,
    maxScore: 20,
    passingScore: 10,
    examDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  const handleOpenAddExamModal = () => {
    setEditingExam(null);
    setExamFormData({
      title: '',
      examType: 'unit_quiz',
      semester: selectedSemester === '2' ? 2 : 1,
      strand: '',
      topic: '',
      indicator: '',
      rawMaxScore: 40,
      maxScore: 20,
      passingScore: 10,
      examDate: new Date().toISOString().split('T')[0],
      description: '',
    });
    setShowExamModal(true);
  };

  const handleOpenEditExamModal = (exam: Exam) => {
    setEditingExam(exam);
    setExamFormData({
      title: exam.title,
      examType: exam.examType,
      semester: exam.semester,
      strand: exam.strand || '',
      topic: exam.topic || '',
      indicator: exam.indicator || '',
      rawMaxScore: exam.rawMaxScore || exam.maxScore,
      maxScore: exam.maxScore,
      passingScore: exam.passingScore,
      examDate: exam.examDate || new Date().toISOString().split('T')[0],
      description: exam.description || '',
    });
    setShowExamModal(true);
  };

  const handleSaveExamForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    if (!examFormData.title.trim()) {
      alert('กรุณาระบุชื่อแบบทดสอบ');
      return;
    }

    const cleanStrand = cleanStrandInput(examFormData.strand);
    const rawMax = Number(examFormData.rawMaxScore) || Number(examFormData.maxScore) || 20;
    const finalMaxScore = Number(examFormData.maxScore) || 20;

    const examData: Exam = {
      id: editingExam ? editingExam.id : `exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId: selectedSubject.id,
      title: examFormData.title.trim(),
      examType: examFormData.examType,
      semester: examFormData.semester,
      strand: cleanStrand,
      topic: examFormData.topic.trim(),
      indicator: examFormData.indicator.trim(),
      rawMaxScore: rawMax,
      maxScore: finalMaxScore,
      passingScore: Number(examFormData.passingScore) || Math.round(finalMaxScore * 0.5),
      examDate: examFormData.examDate,
      description: examFormData.description.trim(),
      createdAt: editingExam ? editingExam.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveExam(examData);
    const updatedExams = storage.getExams();
    setExams(updatedExams);
    setActiveExamId(examData.id);
    if (selectedSemester !== 'all' && selectedSemester !== String(examData.semester)) {
      setSelectedSemester('all');
    }
    setShowExamModal(false);
    // Switch to score entry tab so teacher can enter scores right away
    setActiveTab('score_entry');
    showToast(editingExam ? 'แก้ไขข้อมูลแบบทดสอบเรียบร้อยแล้ว' : 'เพิ่มแบบทดสอบใหม่เรียบร้อยแล้ว และเปิดหน้าบันทึกคะแนนให้นักเรียนทันที');
  };

  // Quick generator for standard exams suite
  const handleGenerateStandardExams = () => {
    if (!selectedSubject) return;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const stdExams: Exam[] = [
      {
        id: `exam-${Date.now()}-1`,
        subjectId: selectedSubject.id,
        title: 'แบบทดสอบท้ายบทที่ 1',
        examType: 'unit_quiz',
        semester: selectedSemester === '2' ? 2 : 1,
        strand: '1',
        topic: 'หน่วยการเรียนรู้ที่ 1',
        rawMaxScore: 20,
        maxScore: 10,
        passingScore: 5,
        examDate: todayStr,
        description: 'แบบทดสอบวัดความรู้ความเข้าใจท้ายหน่วยการเรียนรู้ที่ 1 (คะแนนเต็ม 10 คะแนน เกณฑ์ผ่าน 5 คะแนน)',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `exam-${Date.now()}-2`,
        subjectId: selectedSubject.id,
        title: 'แบบทดสอบท้ายบทที่ 2',
        examType: 'unit_quiz',
        semester: selectedSemester === '2' ? 2 : 1,
        strand: '1',
        topic: 'หน่วยการเรียนรู้ที่ 2',
        rawMaxScore: 20,
        maxScore: 10,
        passingScore: 5,
        examDate: todayStr,
        description: 'แบบทดสอบวัดความรู้ความเข้าใจท้ายหน่วยการเรียนรู้ที่ 2 (คะแนนเต็ม 10 คะแนน เกณฑ์ผ่าน 5 คะแนน)',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `exam-${Date.now()}-3`,
        subjectId: selectedSubject.id,
        title: 'การสอบกลางภาคเรียน',
        examType: 'midterm',
        semester: selectedSemester === '2' ? 2 : 1,
        strand: '1',
        topic: 'การวัดผลสัมฤทธิ์กลางภาคเรียน',
        rawMaxScore: 40,
        maxScore: currentRatio.midtermWeight,
        passingScore: Math.round(currentRatio.midtermWeight * 0.5),
        examDate: todayStr,
        description: `การประเมินผลการเรียนรู้กลางภาคเรียน (คะแนนเต็มตามสัดส่วน ${currentRatio.midtermWeight} คะแนน เกณฑ์ผ่าน ${Math.round(currentRatio.midtermWeight * 0.5)} คะแนน)`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `exam-${Date.now()}-4`,
        subjectId: selectedSubject.id,
        title: 'การสอบปลายภาคเรียน',
        examType: 'final',
        semester: selectedSemester === '2' ? 2 : 1,
        strand: '1',
        topic: 'การวัดผลสัมฤทธิ์ปลายภาคเรียน',
        rawMaxScore: 40,
        maxScore: currentRatio.finalExamWeight,
        passingScore: Math.round(currentRatio.finalExamWeight * 0.5),
        examDate: todayStr,
        description: `การประเมินผลการเรียนรู้ปลายภาคเรียน (คะแนนเต็มตามสัดส่วน ${currentRatio.finalExamWeight} คะแนน เกณฑ์ผ่าน ${Math.round(currentRatio.finalExamWeight * 0.5)} คะแนน)`,
        createdAt: now,
        updatedAt: now,
      },
    ];

    stdExams.forEach((ex) => storage.saveExam(ex));
    const allEx = storage.getExams();
    setExams(allEx);
    setActiveExamId(stdExams[0].id);
    showToast('สร้างชุดแบบทดสอบมาตรฐาน 4 ชุดเรียบร้อยแล้ว');
  };

  const handleDeleteExam = (exam: Exam) => {
    setExamToDelete(exam);
  };

  const handleConfirmDeleteExam = () => {
    if (!examToDelete) return;
    setIsDeletingExam(true);
    try {
      storage.deleteExam(examToDelete.id);
      const updatedExams = storage.getExams();
      setExams(updatedExams);
      setExamRecords(storage.getExamRecords());
      if (activeExamId === examToDelete.id) {
        const remainingForSubject = updatedExams.filter((e) => e.subjectId === selectedSubject?.id);
        setActiveExamId(remainingForSubject[0]?.id || '');
      }
      showToast(`ลบแบบทดสอบ "${examToDelete.title}" เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Error deleting exam:', err);
      showToast('เกิดข้อผิดพลาดในการลบแบบทดสอบ');
    } finally {
      setIsDeletingExam(false);
      setExamToDelete(null);
    }
  };

  const handlePrintExam = (exam: Exam | null) => {
    setPrintExamTarget(exam);
    setShowPrintModal(true);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!activeExam || !selectedClassKey) return;
    const rows = [
      ['เลขที่', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'คะแนนสอบ', 'คะแนนเต็ม', 'ร้อยละ', 'สถานะ', 'หมายเหตุ']
    ];

    classStudents.forEach((st) => {
      const sc = workingScores[st.id];
      const effScore = sc?.status === 'retested' && sc?.retestScore !== undefined 
        ? sc.retestScore 
        : (sc?.score !== undefined ? sc.score : '');
      const pct = activeExam.maxScore > 0 && effScore !== '' ? ((Number(effScore) / activeExam.maxScore) * 100).toFixed(1) : '-';
      const statusLabel = sc?.status === 'absent' ? 'ขาดสอบ' : sc?.status === 'leave' ? 'ลา' : sc?.status === 'retested' ? 'สอบแก้ตัว' : 'เข้าสอบปกติ';
      rows.push([
        st.studentNumber.toString(),
        st.studentCode,
        st.prefix || '',
        st.firstName,
        st.lastName,
        sc?.status === 'absent' ? 'ขาดสอบ' : effScore === '' ? '-' : effScore.toString(),
        activeExam.maxScore.toString(),
        pct,
        statusLabel,
        sc?.note || '',
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `คะแนนสอบ_${activeExam.title}_ห้อง_${selectedClassKey.replace(/\//g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว');
  };

  // Performance calculations for stats bar
  const currentExamStats = useMemo(() => {
    if (!activeExam || classStudents.length === 0) {
      return { examinees: 0, absent: 0, passed: 0, avg: 0, max: 0, min: 0 };
    }

    let examinees = 0;
    let absent = 0;
    let passed = 0;
    let sum = 0;
    let max = 0;
    let min = 999;

    classStudents.forEach((st) => {
      const sc = workingScores[st.id];
      if (!sc || sc.status === 'absent') {
        absent++;
      } else {
        const hasScore = sc.score !== undefined || (sc.status === 'retested' && sc.retestScore !== undefined);
        if (hasScore) {
          examinees++;
          const eff = sc.status === 'retested' && sc.retestScore !== undefined ? sc.retestScore : (sc.score ?? 0);
          sum += eff;
          if (eff > max) max = eff;
          if (eff < min) min = eff;
          const rawMax = activeExam.rawMaxScore || activeExam.maxScore;
          const scaledVal = sc.scaledScore !== undefined ? sc.scaledScore : (rawMax > 0 ? (eff / rawMax) * activeExam.maxScore : eff);
          if (scaledVal >= activeExam.passingScore) passed++;
        }
      }
    });

    if (min === 999) min = 0;
    const avg = examinees > 0 ? sum / examinees : 0;

    return {
      examinees,
      absent,
      passed,
      avg: Number(avg.toFixed(1)),
      max,
      min,
    };
  }, [activeExam, classStudents, workingScores]);

  if (!selectedSubject) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">ไม่พบข้อมูลรายวิชา</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          ยังไม่มีรายวิชาในระบบ หรือคุณยังไม่ได้รับมอบหมายรายวิชา กรุณาสร้างหรือมอบหมายรายวิชาก่อนใช้งานระบบเก็บบันทึกคะแนนสอบ
        </p>
        {onNavigateToSubjects && (
          <button
            onClick={onNavigateToSubjects}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ไปที่ระบบจัดการรายวิชา</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fadeIn border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Selectors Group */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Subject Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">รายวิชา:</span>
            <select
              id="select-exam-subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              {accessibleSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">ห้องเรียน:</span>
            <select
              id="select-exam-class"
              value={selectedClassKey}
              onChange={(e) => setSelectedClassKey(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  ชั้น {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">ภาคเรียน:</span>
            <select
              id="select-exam-semester"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">ทุกภาคเรียน</option>
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            id="btn-add-new-exam"
            onClick={handleOpenAddExamModal}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มแบบทดสอบ</span>
          </button>

          <button
            id="btn-print-exam"
            onClick={() => {
              setPrintExamTarget(activeTab === 'score_entry' ? activeExam : null);
              setShowPrintModal(true);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="พิมพ์เอกสารใบลงคะแนนสอบ / รายงานผล"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">พิมพ์รายงาน</span>
          </button>

          {activeTab === 'score_entry' && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออกคะแนนเป็นไฟล์ CSV"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}

        </div>
      </div>

      {/* Score Ratio Reference Banner */}
      {selectedSubject && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/60 border border-indigo-200/80 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>อ้างอิงสัดส่วนคะแนนสอบ: {selectedSubject.code} {selectedSubject.name}</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedSemester === '2' ? 'ภาคเรียนที่ 2' : selectedSemester === '1' ? 'ภาคเรียนที่ 1' : 'ภาคเรียนที่ 1 & 2'}
                </span>
              </div>
              <div className="text-slate-600 mt-0.5">
                สอบกลางภาค: <strong className="text-indigo-700 font-extrabold">{currentRatio.midtermWeight}</strong> คะแนน | 
                สอบปลายภาค: <strong className="text-purple-700 font-extrabold">{currentRatio.finalExamWeight}</strong> คะแนน 
                <span className="text-slate-500 ml-1.5">(สัดส่วนใบงาน {currentRatio.courseworkWeight} คะแนน | รวมเต็ม {currentRatio.totalTargetScore} คะแนน)</span>
              </div>
            </div>
          </div>
          {onNavigateToRatios && (
            <button
              type="button"
              id="btn-goto-ratios-from-exams"
              onClick={() => onNavigateToRatios(selectedSubject.id)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>จัดการสัดส่วนคะแนน</span>
            </button>
          )}
        </div>
      )}

      {/* Main View Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            id="tab-exams-list"
            onClick={() => setActiveTab('exams_list')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'exams_list'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>รายการแบบทดสอบ ({filteredExams.length})</span>
          </button>

          <button
            id="tab-exam-score-entry"
            onClick={() => setActiveTab('score_entry')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'score_entry'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>บันทึกคะแนนสอบรายห้อง</span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก" />
            )}
          </button>

          <button
            id="tab-exam-matrix"
            onClick={() => setActiveTab('matrix_summary')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'matrix_summary'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>สรุปคะแนนสอบทุกชุด</span>
          </button>
        </div>

        {/* Search input in list tab */}
        {activeTab === 'exams_list' && (
          <div className="relative w-52 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาแบบทดสอบ, สาระ, เรื่อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* TAB 1: EXAMS LIST & MANAGEMENT */}
      {activeTab === 'exams_list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredExams.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">ยังไม่มีแบบทดสอบในวิชานี้</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                เริ่มต้นเพิ่มแบบทดสอบ เช่น แบบทดสอบท้ายบท สอบกลางภาค หรือสอบปลายภาค เพื่อเก็บบันทึกคะแนนนักเรียน
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                <button
                  onClick={handleOpenAddExamModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างแบบทดสอบใหม่</span>
                </button>
                <button
                  onClick={handleGenerateStandardExams}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  title="สร้างแบบทดสอบตัวอย่าง (ท้ายบทที่ 1, 2, กลางภาค, ปลายภาค)"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>สร้างชุดแบบทดสอบมาตรฐาน 4 ชุด</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Header Actions Bar with Expand/Collapse & Ratio Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAllExamsExpanded}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title={expandedExamIds.size === filteredExams.length ? 'ย่อตารางทั้งหมด' : 'กดขยายดูรายละเอียดทุกชุด'}
                  >
                    {expandedExamIds.size === filteredExams.length ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>ย่อตารางทั้งหมด</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>กดขยายดูครบทุกชุด ({filteredExams.length})</span>
                      </>
                    )}
                  </button>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    แสดงแบบทดสอบ {filteredExams.length} ชุด (ห้อง {selectedClassKey})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-900">
                    <Calculator className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>คะแนนสอบเก็บบันทึกคะแนนดิบ แล้วหารเทียบตามสัดส่วนวิชา (รวมให้ครบ 100 คะแนน)</span>
                  </div>
                  <button
                    onClick={handleOpenAddExamModal}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>สร้างแบบทดสอบ</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-3 w-12 text-center">ที่</th>
                      <th className="py-3 px-4 min-w-48">ชื่อแบบทดสอบ</th>
                      <th className="py-3 px-3 w-20 text-center">ภาคเรียน</th>
                      <th className="py-3 px-3 w-28 text-center">
                        คะแนนดิบ
                        <div className="text-[10px] font-normal text-slate-400 font-mono">(เต็มดิบ)</div>
                      </th>
                      <th className="py-3 px-3 w-28 text-center">
                        คะแนนเต็ม
                        <div className="text-[10px] font-normal text-indigo-600 font-mono">(ตามสัดส่วน)</div>
                      </th>
                      <th className="py-3 px-3 w-28 text-center hidden md:table-cell">
                        เกณฑ์ผ่าน
                        <div className="text-[10px] font-normal text-emerald-600 font-mono">(จากคะแนนเต็ม)</div>
                      </th>
                      <th className="py-3 px-4 w-36 text-center">สถานะการตรวจ</th>
                      <th className="py-3 px-4 w-52 text-center">การทำงาน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExams.map((exam, idx) => {
                      const typeCfg = EXAM_TYPE_LABELS[exam.examType] || EXAM_TYPE_LABELS.custom;
                      const rawMax = exam.rawMaxScore || exam.maxScore;
                      const isExpanded = expandedExamIds.has(exam.id);

                      // Check completion in selected class
                      const record = examRecords.find((r) => r.examId === exam.id && r.classKey === selectedClassKey);
                      const studentScoresList = record 
                        ? (Object.values(record.studentScores) as StudentExamScore[])
                        : [];
                      const scoredCount = studentScoresList.filter(
                        (s) => s.score !== undefined || s.status === 'absent' || s.status === 'leave'
                      ).length;
                      const totalStudentsInClass = classStudents.length;
                      const isFullyGraded = totalStudentsInClass > 0 && scoredCount >= totalStudentsInClass;

                      // Statistics for expanded view
                      const validScores = studentScoresList
                        .filter((s) => s.score !== undefined && s.status !== 'absent' && s.status !== 'leave')
                        .map((s) => s.score as number);
                      const passedCount = studentScoresList.filter((s) => {
                        const eff = s.status === 'retested' && s.retestScore !== undefined ? s.retestScore : s.score;
                        const scaledVal = s.scaledScore !== undefined ? s.scaledScore : (rawMax > 0 && eff !== undefined ? (eff / rawMax) * exam.maxScore : eff);
                        return scaledVal !== undefined && scaledVal >= exam.passingScore && s.status !== 'absent' && s.status !== 'leave';
                      }).length;
                      const failedCount = validScores.length - passedCount;
                      const absentCount = studentScoresList.filter((s) => s.status === 'absent' || s.status === 'leave').length;
                      const avgRaw = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '-';
                      const maxRaw = validScores.length > 0 ? Math.max(...validScores) : '-';
                      const minRaw = validScores.length > 0 ? Math.min(...validScores) : '-';
                      const avgScaled = validScores.length > 0 && rawMax > 0 
                        ? ((Number(avgRaw) / rawMax) * exam.maxScore).toFixed(2) 
                        : '-';

                      return (
                        <React.Fragment key={exam.id}>
                          <tr className={`hover:bg-slate-50/70 transition-colors ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                            <td className="py-3.5 px-3 text-center font-mono text-slate-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800 text-xs">{exam.title}</div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeCfg.badge}`}>
                                  {typeCfg.label}
                                </span>
                                {exam.topic && (
                                  <span className="text-[10px] text-slate-500 truncate max-w-[170px]" title={exam.topic}>
                                    {exam.topic}
                                  </span>
                                )}
                                {exam.examDate && (
                                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                    <Calendar className="w-2.5 h-2.5" />
                                    <span>{exam.examDate}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                เทอม {exam.semester}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                  {rawMax} ดิบ
                                </span>
                                {rawMax !== exam.maxScore ? (
                                  <span className="text-[9px] text-indigo-600 font-medium mt-0.5">
                                    หารเทียบสัดส่วน
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 mt-0.5">
                                    คะแนนเต็มตรง
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                                  {exam.maxScore} คะแนน
                                </span>
                                <span className="text-[9px] text-slate-400 mt-0.5">
                                  ตามสัดส่วนวิชา
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center hidden md:table-cell">
                              <div className="flex flex-col items-center justify-center">
                                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100" title={`เกณฑ์ผ่าน ${exam.passingScore} จากคะแนนเต็ม ${exam.maxScore} คะแนน`}>
                                  ≥ {exam.passingScore} / {exam.maxScore}
                                </span>
                                <span className="text-[9px] text-slate-400 mt-0.5">
                                  ({exam.maxScore > 0 ? ((exam.passingScore / exam.maxScore) * 100).toFixed(0) : 0}%)
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {totalStudentsInClass === 0 ? (
                                <span className="text-slate-400 text-[11px]">ไม่มีนักเรียน</span>
                              ) : isFullyGraded ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>ครบ {scoredCount}/{totalStudentsInClass}</span>
                                </span>
                              ) : scoredCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  <span>บันทึก {scoredCount}/{totalStudentsInClass}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                                  ยังไม่กรอกคะแนน
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setActiveExamId(exam.id);
                                    setActiveTab('score_entry');
                                  }}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                  title="ตรวจและบันทึกคะแนนสอบของชุดนี้"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>ตรวจ/ลงคะแนน</span>
                                </button>
                                <button
                                  onClick={() => toggleExamExpanded(exam.id)}
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                                    isExpanded
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                  title={isExpanded ? 'ย่อรายละเอียดแบบทดสอบ' : 'กดขยายดูรายละเอียด เกณฑ์ผ่าน และสถิติ'}
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  <span>{isExpanded ? 'ย่อ' : 'กดขยาย'}</span>
                                </button>
                                <button
                                  onClick={() => handleOpenEditExamModal(exam)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไขข้อมูลแบบทดสอบ"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExam(exam)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบแบบทดสอบนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ACCORDION ROW: แสดงรายละเอียดเต็มเมื่อกดขยาย */}
                          {isExpanded && (
                            <tr className="bg-slate-50/60 border-b border-slate-200">
                              <td colSpan={8} className="p-4 sm:p-5">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
                                  
                                  {/* Title & Badge */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                        <Calculator className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h5 className="font-bold text-slate-800 text-sm">{exam.title}</h5>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                          <span>{typeCfg.label}</span>
                                          <span>•</span>
                                          <span>ภาคเรียนที่ {exam.semester}</span>
                                          {exam.examDate && (
                                            <>
                                              <span>•</span>
                                              <span>วันที่จัดสอบ: {exam.examDate}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setActiveExamId(exam.id);
                                          setActiveTab('score_entry');
                                        }}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>บันทึกคะแนนห้อง {selectedClassKey}</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenEditExamModal(exam)}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                        <span>แก้ไข</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* 3 Information Cards */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* 1. Raw to Scaled Calculation Formula */}
                                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                                      <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-2">
                                        <Percent className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>การหารคะแนนดิบตามสัดส่วน</span>
                                      </div>
                                      <div className="space-y-1.5 text-[11px] text-slate-700">
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">คะแนนดิบเต็ม:</span>
                                          <strong className="font-mono text-slate-800">{rawMax} คะแนน</strong>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">คะแนนเต็มตามสัดส่วน:</span>
                                          <strong className="font-mono text-indigo-700">{exam.maxScore} คะแนน</strong>
                                        </div>
                                        <div className="pt-1.5 border-t border-indigo-100 font-mono text-[10px] text-indigo-950 bg-white/70 p-1.5 rounded border">
                                          สูตร: <code>(คะแนนดิบ ÷ {rawMax}) × {exam.maxScore}</code>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                          คิดเป็นสัดส่วน {exam.maxScore}% รวมกับคะแนนเก็บเพื่อคิดเกรดเต็ม 100
                                        </p>
                                      </div>
                                    </div>

                                    {/* 2. Educational Metadata & Passing Threshold */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                                        <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                                        <span>เกณฑ์ผ่านและเนื้อหา</span>
                                      </div>
                                      <div className="space-y-1 text-[11px] text-slate-600">
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">เกณฑ์ผ่าน (จากคะแนนเต็ม):</span>
                                          <strong className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                            ≥ {exam.passingScore} จาก {exam.maxScore} คะแนน ({exam.maxScore > 0 ? ((exam.passingScore / exam.maxScore) * 100).toFixed(0) : 0}%)
                                          </strong>
                                        </div>
                                        {rawMax !== exam.maxScore && (
                                          <div className="text-[10px] text-slate-400">
                                            (เทียบเท่าคะแนนดิบข้อสอบ ≥ {exam.maxScore > 0 ? ((exam.passingScore / exam.maxScore) * rawMax).toFixed(1) : 0} จาก {rawMax} คะแนนดิบ)
                                          </div>
                                        )}
                                        <div>
                                          <span className="text-slate-500">สาระการเรียนรู้: </span>
                                          <span className="font-medium text-slate-700">{formatStrandDisplay(exam.strand) || '-'}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-500">เรื่อง / หน่วย: </span>
                                          <span className="font-medium text-slate-700">{exam.topic || '-'}</span>
                                        </div>
                                        {exam.indicator && (
                                          <div>
                                            <span className="text-slate-500">ตัวชี้วัด: </span>
                                            <span className="text-slate-700">{exam.indicator}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 3. Room Statistics */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                                        <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                                        <span>สถิติห้อง {selectedClassKey}</span>
                                      </div>
                                      <div className="space-y-1 text-[11px] text-slate-600">
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">ตรวจแล้ว:</span>
                                          <span className="font-bold text-slate-800">{scoredCount} / {totalStudentsInClass} คน</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">ผ่าน / ไม่ผ่าน:</span>
                                          <span>
                                            <strong className="text-emerald-700">{passedCount}</strong> / <strong className="text-rose-600">{failedCount > 0 ? failedCount : 0}</strong>
                                            {absentCount > 0 && <span className="text-slate-400 text-[10px]"> (ขาด/ลา {absentCount})</span>}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">คะแนนดิบเฉลี่ย:</span>
                                          <span className="font-mono font-bold text-slate-800">{avgRaw} (สูง {maxRaw} / ต่ำ {minRaw})</span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-slate-200">
                                          <span className="text-slate-500">คะแนนจริงเฉลี่ย:</span>
                                          <span className="font-mono font-bold text-indigo-700">{avgScaled} / {exam.maxScore}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {exam.description && (
                                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                      <span className="font-semibold text-slate-700">คำอธิบาย: </span>
                                      {exam.description}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCORE ENTRY (RECORD SCORES FOR ACTIVE EXAM) */}
      {activeTab === 'score_entry' && (
        <div className="space-y-4">
          
          {/* Active Exam Selector and Overview Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">กำลังบันทึกคะแนน:</span>
                <select
                  id="select-active-exam-entry"
                  value={activeExamId}
                  onChange={(e) => setActiveExamId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {filteredExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} (เต็ม {ex.maxScore} คะแนน)
                    </option>
                  ))}
                </select>
                {activeExam && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditExamModal(activeExam)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="แก้ไขข้อมูลแบบทดสอบนี้"
                    >
                      <Edit3 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExam(activeExam)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="ลบแบบทดสอบนี้"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintExam(activeExam)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="พิมพ์ใบลงคะแนนสอบ"
                    >
                      <Printer className="w-4 h-4 text-indigo-600" />
                    </button>
                  </div>
                )}
              </div>

              {activeExam && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    คะแนนเต็ม: {activeExam.maxScore} คะแนน
                  </span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100" title="เกณฑ์ผ่านกำหนดจากคะแนนเต็ม">
                    เกณฑ์ผ่าน: ≥ {activeExam.passingScore} คะแนน ({activeExam.maxScore > 0 ? ((activeExam.passingScore / activeExam.maxScore) * 100).toFixed(0) : 0}% ของคะแนนเต็ม)
                  </span>
                  {activeExam.strand && (
                    <span className="text-slate-500">
                      สาระ: <strong className="text-slate-700">{formatStrandDisplay(activeExam.strand)}</strong>
                    </span>
                  )}
                  {activeExam.topic && (
                    <span className="text-slate-500">
                      เรื่อง: <strong className="text-slate-700">{activeExam.topic}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Tools & Save Button */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={handleQuickFillMax}
                  className="px-2.5 py-1 text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="กรอกคะแนนเต็มให้นักเรียนทุกคน"
                >
                  กรอกคะแนนเต็มทุกคน
                </button>
                <button
                  type="button"
                  onClick={handleQuickSetAllPresent}
                  className="px-2.5 py-1 text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="ตั้งค่าสถานะเป็นเข้าสอบทุกคน"
                >
                  เข้าสอบทุกคน
                </button>
                <button
                  type="button"
                  onClick={handleQuickClearAll}
                  className="px-2.5 py-1 text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="ล้างคะแนนทั้งหมด"
                >
                  ล้างคะแนน
                </button>
              </div>

              <button
                id="btn-save-exam-scores"
                type="button"
                onClick={handleSaveScores}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                  isDirty 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{isDirty ? 'บันทึกคะแนน (มีการเปลี่ยนแปลง)' : 'บันทึกคะแนน'}</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">นักเรียนในห้อง</div>
              <div className="text-base font-bold text-slate-800 font-mono mt-0.5">{classStudents.length} คน</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">เข้าสอบ</div>
              <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">{currentExamStats.examinees} คน</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">ขาดสอบ / ลา</div>
              <div className="text-base font-bold text-rose-600 font-mono mt-0.5">{currentExamStats.absent} คน</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">ผ่านเกณฑ์</div>
              <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                {currentExamStats.passed} คน ({currentExamStats.examinees > 0 ? ((currentExamStats.passed / currentExamStats.examinees) * 100).toFixed(0) : 0}%)
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">คะแนนเฉลี่ย</div>
              <div className="text-base font-bold text-indigo-700 font-mono mt-0.5">{currentExamStats.avg}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">สูงสุด / ต่ำสุด</div>
              <div className="text-base font-bold text-slate-800 font-mono mt-0.5">{currentExamStats.max} / {currentExamStats.min}</div>
            </div>
          </div>

          {/* Student Score Input Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {classStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>ไม่พบนักเรียนในชั้น {selectedClassKey}</p>
              </div>
            ) : !activeExam ? (
              <div className="p-12 text-center text-slate-500">
                <p>กรุณาเลือกหรือสร้างแบบทดสอบก่อนเริ่มบันทึกคะแนน</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {activeExam && (
                  <div className="bg-indigo-50/70 border-b border-indigo-100 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900">
                      <Calculator className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        ระบบคำนวณสัดส่วน: เก็บคะแนนดิบเต็ม <strong>{activeExam.rawMaxScore || activeExam.maxScore} คะแนน</strong> หารแปลงเป็นคะแนนจริงตามสัดส่วน <strong>{activeExam.maxScore} คะแนน</strong>
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-800 bg-white/90 px-3 py-1 rounded-full border border-emerald-200/70 font-medium">
                      เกณฑ์ผ่าน: <strong>≥ {activeExam.passingScore} / {activeExam.maxScore} คะแนน</strong> ({activeExam.maxScore > 0 ? ((activeExam.passingScore / activeExam.maxScore) * 100).toFixed(0) : 0}% ของคะแนนเต็ม)
                      {(activeExam.rawMaxScore || activeExam.maxScore) !== activeExam.maxScore && (
                        <span className="text-slate-500 ml-1.5 font-normal">
                          (เทียบเท่าคะแนนดิบ ≥ {((activeExam.passingScore / activeExam.maxScore) * (activeExam.rawMaxScore || activeExam.maxScore)).toFixed(1)})
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                      <th className="py-3 px-3 w-20 text-center">รหัสนักเรียน</th>
                      <th className="py-3 px-4 min-w-44">ชื่อ - นามสกุล</th>
                      <th className="py-3 px-3 w-28 text-center bg-slate-100/50">
                        คะแนนดิบที่ได้
                        <div className="text-[10px] font-normal text-slate-500 font-mono">(เต็มดิบ {activeExam.rawMaxScore || activeExam.maxScore})</div>
                      </th>
                      <th className="py-3 px-3 w-28 text-center bg-indigo-50/70 border-x border-indigo-100/80">
                        คะแนนตามสัดส่วน
                        <div className="text-[10px] font-semibold text-indigo-700 font-mono">(เต็มจริง {activeExam.maxScore})</div>
                      </th>
                      <th className="py-3 px-3 w-28 text-center">สถานะการสอบ</th>
                      <th className="py-3 px-3 w-24 text-center">คะแนนแก้ตัว (ดิบ)</th>
                      <th className="py-3 px-3 w-16 text-center">ร้อยละ (%)</th>
                      <th className="py-3 px-3 w-24 text-center">ผลประเมิน</th>
                      <th className="py-3 px-4 min-w-40">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classStudents.map((student) => {
                      const scoreData = workingScores[student.id] || {
                        studentId: student.id,
                        status: 'normal',
                        note: '',
                      };

                      const status = scoreData.status || 'normal';
                      const isAbsent = status === 'absent';
                      const isLeave = status === 'leave';
                      const isRetest = status === 'retested';
                      const hasScore = scoreData.score !== undefined;
                      const hasRetest = isRetest && scoreData.retestScore !== undefined;
                      const effectiveRawScore = hasRetest ? (scoreData.retestScore as number) : (scoreData.score ?? 0);
                      const rawMax = activeExam.rawMaxScore || activeExam.maxScore;
                      
                      // Calculate proportional scaled score
                      const computedScaledScore = rawMax > 0 && (hasScore || hasRetest)
                        ? Number(((effectiveRawScore / rawMax) * activeExam.maxScore).toFixed(2))
                        : undefined;
                      const displayScaled = scoreData.scaledScore !== undefined ? scoreData.scaledScore : computedScaledScore;

                      const percent = rawMax > 0 && (hasScore || hasRetest) 
                        ? ((effectiveRawScore / rawMax) * 100).toFixed(0) 
                        : '-';
                      const isPassed = !isAbsent && !isLeave && (hasScore || hasRetest) && (displayScaled !== undefined ? displayScaled : computedScaledScore ?? 0) >= activeExam.passingScore;

                      return (
                        <tr 
                          key={student.id} 
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isAbsent ? 'bg-rose-50/30' : isLeave ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-500">
                            {student.studentNumber}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {student.studentCode}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-800">
                              {student.prefix}{student.firstName} {student.lastName}
                            </span>
                          </td>
                          
                          {/* Raw Score Input */}
                          <td className="py-2.5 px-3 text-center bg-slate-50/30">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={isAbsent || isLeave}
                              value={isAbsent || isLeave ? '' : (scoreData.score !== undefined ? String(scoreData.score) : '')}
                              onChange={(e) => handleScoreChange(student.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder={isAbsent ? 'ขาด' : isLeave ? 'ลา' : '-'}
                              className={`w-20 text-center font-mono font-bold py-1 px-2 rounded-lg border outline-none text-xs transition-colors ${
                                isAbsent || isLeave
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : !hasScore
                                  ? 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                                  : isPassed
                                  ? 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                                  : 'bg-rose-50 border-rose-200 text-rose-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                              }`}
                            />
                          </td>

                          {/* Calculated Scaled Score Display */}
                          <td className="py-2.5 px-3 text-center bg-indigo-50/30 border-x border-indigo-100/60 font-mono">
                            {isAbsent ? (
                              <span className="text-rose-500 text-[11px] font-semibold">0 (ขาดสอบ)</span>
                            ) : isLeave ? (
                              <span className="text-amber-600 text-[11px] font-semibold">ลา</span>
                            ) : displayScaled !== undefined ? (
                              <span className="inline-flex items-center gap-1 font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs shadow-2xs">
                                {displayScaled}
                                <span className="text-[10px] font-normal text-indigo-400">/{activeExam.maxScore}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Status Select */}
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={status}
                              onChange={(e) => handleStatusChange(student.id, e.target.value as any)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="normal">เข้าสอบปกติ</option>
                              <option value="absent">ขาดสอบ</option>
                              <option value="leave">ลา</option>
                              <option value="retested">สอบแก้ตัว</option>
                            </select>
                          </td>

                          {/* Retest Score Input */}
                          <td className="py-2.5 px-3 text-center">
                            {isRetest ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={scoreData.retestScore !== undefined ? String(scoreData.retestScore) : ''}
                                onChange={(e) => handleRetestScoreChange(student.id, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="คะแนนดิบใหม่"
                                className="w-20 text-center font-mono font-bold py-1 px-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 outline-none text-xs focus:ring-2 focus:ring-amber-200"
                              />
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>

                          {/* Percent */}
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {isAbsent || isLeave ? '-' : percent === '-' ? '-' : `${percent}%`}
                          </td>

                          {/* Pass/Fail Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {isAbsent ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                ขาดสอบ
                              </span>
                            ) : isLeave ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                ลา
                              </span>
                            ) : !hasScore && !hasRetest ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
                                รอลงคะแนน
                              </span>
                            ) : isPassed ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ผ่าน
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                                ไม่ผ่าน
                              </span>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={scoreData.note || ''}
                              onChange={(e) => handleNoteChange(student.id, e.target.value)}
                              placeholder="หมายเหตุเพิ่มเติม..."
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 py-1 px-1 text-xs text-slate-600 outline-none transition-colors"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ALL EXAMS MATRIX SUMMARY */}
      {activeTab === 'matrix_summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                ตารางสรุปคะแนนสอบรวมทุกแบบทดสอบ • ชั้น {selectedClassKey}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                รายวิชา {selectedSubject.code} {selectedSubject.name} (แบบทดสอบทั้งหมด {filteredExams.length} ชุด)
              </p>
            </div>

            <button
              onClick={() => {
                setPrintExamTarget(null);
                setShowPrintModal(true);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>พิมพ์ใบสรุปคะแนน</span>
            </button>
          </div>

          {classStudents.length === 0 || filteredExams.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p>ยังไม่มีข้อมูลแบบทดสอบหรือนักเรียนในห้องนี้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                    <th className="py-3 px-3 w-20 text-center">รหัส</th>
                    <th className="py-3 px-4 min-w-44">ชื่อ - นามสกุล</th>
                    {filteredExams.map((ex) => (
                      <th key={ex.id} className="py-3 px-3 min-w-28 text-center border-l border-slate-100">
                        <div className="font-bold text-slate-800 leading-tight">{ex.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">(เต็ม {ex.maxScore})</div>
                      </th>
                    ))}
                    <th className="py-3 px-4 w-28 text-center bg-slate-100/80 border-l border-slate-200">
                      คะแนนสอบรวม
                    </th>
                    <th className="py-3 px-3 w-20 text-center bg-slate-100/80">
                      ร้อยละ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((st) => {
                    let totalEarned = 0;
                    let totalMax = 0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-center font-mono font-medium text-slate-500">
                          {st.studentNumber}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">
                          {st.studentCode}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {st.prefix}{st.firstName} {st.lastName}
                        </td>

                        {filteredExams.map((ex) => {
                          const record = examRecords.find((r) => r.examId === ex.id && r.classKey === selectedClassKey);
                          const sc = record?.studentScores[st.id];
                          const scoreVal = sc?.score ?? 0;
                          const effective = sc?.status === 'retested' && sc?.retestScore !== undefined ? sc.retestScore : scoreVal;
                          const isAbsent = sc?.status === 'absent';
                          const isLeave = sc?.status === 'leave';

                          const hasVal = sc && (sc.score !== undefined || (sc.status === 'retested' && sc.retestScore !== undefined));

                          totalMax += ex.maxScore;
                          if (!isAbsent && !isLeave && hasVal) {
                            totalEarned += effective;
                          }

                          return (
                            <td key={ex.id} className="py-3 px-3 text-center font-mono border-l border-slate-100">
                              {isAbsent ? (
                                <span className="text-rose-600 font-semibold text-[11px]">ขาด</span>
                              ) : isLeave ? (
                                <span className="text-amber-600 font-semibold text-[11px]">ลา</span>
                              ) : hasVal ? (
                                <span className={`font-bold ${effective >= ex.passingScore ? 'text-slate-800' : 'text-rose-600'}`}>
                                  {effective}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-3 px-4 text-center font-mono font-bold text-indigo-700 bg-slate-50 border-l border-slate-200">
                          {totalEarned} / {totalMax}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 bg-slate-50">
                          {totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT EXAM MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingExam ? 'แก้ไขแบบทดสอบ' : 'เพิ่มแบบทดสอบใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setShowExamModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExamForm} className="p-6 space-y-4">
              
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อแบบทดสอบ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แบบทดสอบท้ายบทที่ 1 เซลล์และโครงสร้างพืช"
                  value={examFormData.title}
                  onChange={(e) => setExamFormData({ ...examFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Type & Semester Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ประเภทการสอบ
                  </label>
                  <select
                    value={examFormData.examType}
                    onChange={(e) => setExamFormData({ ...examFormData, examType: e.target.value as ExamType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="unit_quiz">แบบทดสอบย่อย / ท้ายบท</option>
                    <option value="midterm">สอบกลางภาคเรียน</option>
                    <option value="final">สอบปลายภาคเรียน</option>
                    <option value="practical">สอบปฏิบัติ / ทักษะ</option>
                    <option value="retest">สอบแก้ตัว</option>
                    <option value="custom">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ภาคเรียน
                  </label>
                  <select
                    value={examFormData.semester}
                    onChange={(e) => setExamFormData({ ...examFormData, semester: Number(e.target.value) as 1 | 2 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value={1}>ภาคเรียนที่ 1</option>
                    <option value={2}>ภาคเรียนที่ 2</option>
                  </select>
                </div>
              </div>

              {/* Strand & Topic */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สาระการเรียนรู้
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(ตัดคำว่า "สาระที่" ออก)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 1. วิทยาศาสตร์ชีวภาพ"
                    value={examFormData.strand}
                    onChange={(e) => setExamFormData({ ...examFormData, strand: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เรื่อง / หน่วยการเรียนรู้
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น โครงสร้างและการทำงานของเซลล์"
                    value={examFormData.topic}
                    onChange={(e) => setExamFormData({ ...examFormData, topic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Score Ratio & Calculation Settings */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                    <span>การกำหนดคะแนนเต็มและเกณฑ์คะแนนผ่าน</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-medium">รวมคะแนนครบ 100 ตามสัดส่วนวิชา</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      คะแนนเต็มตามสัดส่วน <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={examFormData.maxScore}
                      onChange={(e) => {
                        const newMax = Number(e.target.value) || 0;
                        const ratio = examFormData.maxScore > 0 ? examFormData.passingScore / examFormData.maxScore : 0.5;
                        const newPass = Math.max(1, Math.round(newMax * (ratio || 0.5)));
                        setExamFormData({
                          ...examFormData,
                          maxScore: newMax,
                          passingScore: newPass,
                        });
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">คะแนนจริงใน ปพ.5 เช่น 20</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      คะแนนดิบเต็ม (Raw) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      required
                      value={examFormData.rawMaxScore}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 0;
                        setExamFormData({
                          ...examFormData,
                          rawMaxScore: raw,
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">คะแนนในชุดข้อสอบ เช่น 40</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เกณฑ์คะแนนผ่าน (กำหนดจากคะแนนเต็ม) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={examFormData.maxScore}
                      step="any"
                      required
                      value={examFormData.passingScore}
                      onChange={(e) => setExamFormData({ ...examFormData, passingScore: Number(e.target.value) || 0 })}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {[50, 60, 70, 80].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            const val = Number(((examFormData.maxScore * pct) / 100).toFixed(1));
                            setExamFormData({ ...examFormData, passingScore: val });
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border cursor-pointer transition-colors ${
                            examFormData.maxScore > 0 && Math.round((examFormData.passingScore / examFormData.maxScore) * 100) === pct
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-900 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100 flex items-start gap-2">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span>
                      เกณฑ์ผ่าน: <strong>≥ {examFormData.passingScore} จากคะแนนเต็ม {examFormData.maxScore} คะแนน</strong>{' '}
                      ({examFormData.maxScore > 0 ? ((examFormData.passingScore / examFormData.maxScore) * 100).toFixed(0) : 0}% ของคะแนนเต็ม)
                    </span>
                    {(examFormData.rawMaxScore || examFormData.maxScore) !== examFormData.maxScore && (
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        เทียบเท่าคะแนนดิบข้อสอบ ≥ {examFormData.maxScore > 0 ? (((examFormData.passingScore / examFormData.maxScore) * (examFormData.rawMaxScore || examFormData.maxScore))).toFixed(1) : 0} จากเต็ม {examFormData.rawMaxScore} คะแนน
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-indigo-800 bg-white/80 p-2 rounded-lg border border-indigo-100/80 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    สูตรคำนวณอัตโนมัติ: <strong>คะแนนจริง = (คะแนนดิบที่ได้ ÷ {examFormData.rawMaxScore || examFormData.maxScore}) × {examFormData.maxScore}</strong>
                  </span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่จัดสอบ
                </label>
                <input
                  type="date"
                  value={examFormData.examDate}
                  onChange={(e) => setExamFormData({ ...examFormData, examDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คำอธิบาย / รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  placeholder="หมายเหตุเกณฑ์การให้คะแนน หรือเนื้อหาที่ออกสอบ..."
                  value={examFormData.description}
                  onChange={(e) => setExamFormData({ ...examFormData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {editingExam ? 'บันทึกการแก้ไข' : 'สร้างแบบทดสอบ'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PRINT EXAM MODAL */}
      {showPrintModal && (
        <PrintExamModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          subject={selectedSubject}
          classKey={selectedClassKey}
          exam={printExamTarget}
          allExams={filteredExams}
          students={classStudents}
          examRecord={printExamTarget ? examRecords.find((r) => r.examId === printExamTarget.id && r.classKey === selectedClassKey) : undefined}
          allRecords={examRecords}
          schoolSettings={schoolSettings}
        />
      )}

      {/* CONFIRM DELETE EXAM MODAL */}
      {examToDelete && (
        <ConfirmDeleteModal
          isOpen={!!examToDelete}
          title="ยืนยันการลบแบบทดสอบ"
          itemTitle={examToDelete.title}
          itemSubtitle={`วิชา ${selectedSubject?.name || ''} (${selectedSubject?.code || ''}) • ภาคเรียนที่ ${examToDelete.semester} • คะแนนเต็ม ${examToDelete.maxScore} คะแนน`}
          warningMessage="คุณแน่ใจหรือไม่ว่าต้องการลบแบบทดสอบนี้? ข้อมูลการบันทึกคะแนนสอบของนักเรียนทั้งหมดในแบบทดสอบนี้จะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้"
          confirmLabel={isDeletingExam ? 'กำลังลบ...' : 'ยืนยันการลบแบบทดสอบ'}
          isLoading={isDeletingExam}
          onConfirm={handleConfirmDeleteExam}
          onClose={() => {
            if (!isDeletingExam) setExamToDelete(null);
          }}
        />
      )}

    </div>
  );
};
