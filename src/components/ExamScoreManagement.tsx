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
  Users, 
  Calendar, 
  Check, 
  X, 
  ArrowUpDown,
  BookOpen,
  Sparkles,
  ClipboardList
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
import { PrintExamModal } from './PrintExamModal';

interface ExamScoreManagementProps {
  currentUser: User;
  students: Student[];
  subjects: Subject[];
  initialSubjectId?: string;
  initialClassKey?: string;
  onNavigateToSubjects?: () => void;
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

  // Modal states
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printExamTarget, setPrintExamTarget] = useState<Exam | null>(null);

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

  // Initialize working scores when active exam or class changes
  useEffect(() => {
    if (!activeExam || !selectedClassKey) {
      setWorkingScores({});
      setIsDirty(false);
      return;
    }

    const initial: Record<string, StudentExamScore> = {};
    const existingScores = currentExamRecord?.studentScores || {};

    classStudents.forEach((student) => {
      if (existingScores[student.id]) {
        initial[student.id] = { ...existingScores[student.id] };
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

  // Score handlers - คะแนนสอบ ไม่ต้องใส่ 0 นำหน้า
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
      const clamped = Math.max(0, Math.min(activeExam.maxScore, num));
      setWorkingScores((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { studentId, status: 'normal' }),
          score: clamped,
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
      const clamped = Math.max(0, Math.min(activeExam.maxScore, num));
      setWorkingScores((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { studentId, status: 'normal' }),
          retestScore: clamped,
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
    const updated = { ...workingScores };
    classStudents.forEach((st) => {
      updated[st.id] = {
        ...(updated[st.id] || { studentId: st.id }),
        score: activeExam.maxScore,
        status: 'normal',
      };
    });
    setWorkingScores(updated);
    setIsDirty(true);
    showToast(`กรอกคะแนนเต็ม ${activeExam.maxScore} คะแนนให้นักเรียนทุกคนแล้ว`);
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

    const examData: Exam = {
      id: editingExam ? editingExam.id : `exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId: selectedSubject.id,
      title: examFormData.title.trim(),
      examType: examFormData.examType,
      semester: examFormData.semester,
      strand: cleanStrand,
      topic: examFormData.topic.trim(),
      indicator: examFormData.indicator.trim(),
      maxScore: Number(examFormData.maxScore) || 20,
      passingScore: Number(examFormData.passingScore) || 10,
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
        maxScore: 10,
        passingScore: 5,
        examDate: todayStr,
        description: 'แบบทดสอบวัดความรู้ความเข้าใจท้ายหน่วยการเรียนรู้ที่ 1',
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
        maxScore: 10,
        passingScore: 5,
        examDate: todayStr,
        description: 'แบบทดสอบวัดความรู้ความเข้าใจท้ายหน่วยการเรียนรู้ที่ 2',
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
        maxScore: 20,
        passingScore: 10,
        examDate: todayStr,
        description: 'การประเมินผลการเรียนรู้กลางภาคเรียน',
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
        maxScore: 30,
        passingScore: 15,
        examDate: todayStr,
        description: 'การประเมินผลการเรียนรู้ปลายภาคเรียน',
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
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบแบบทดสอบ "${exam.title}" ? ข้อมูลคะแนนสอบของแบบทดสอบนี้จะถูกลบด้วย`)) {
      return;
    }
    storage.deleteExam(exam.id);
    setExams(storage.getExams());
    setExamRecords(storage.getExamRecords());
    showToast(`ลบแบบทดสอบ "${exam.title}" เรียบร้อยแล้ว`);
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
          if (eff >= activeExam.passingScore) passed++;
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4 w-12 text-center">ที่</th>
                    <th className="py-3 px-4">ชื่อแบบทดสอบ</th>
                    <th className="py-3 px-4 w-36">ประเภท</th>
                    <th className="py-3 px-4">สาระการเรียนรู้</th>
                    <th className="py-3 px-4">เรื่อง / หน่วย</th>
                    <th className="py-3 px-3 w-16 text-center">ภาค</th>
                    <th className="py-3 px-3 w-20 text-center">คะแนนเต็ม</th>
                    <th className="py-3 px-3 w-20 text-center">เกณฑ์ผ่าน</th>
                    <th className="py-3 px-4 w-36 text-center">สถานะการตรวจ</th>
                    <th className="py-3 px-4 w-44 text-center">การทำงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExams.map((exam, idx) => {
                    const typeCfg = EXAM_TYPE_LABELS[exam.examType] || EXAM_TYPE_LABELS.custom;
                    // Check completion in selected class
                    const record = examRecords.find((r) => r.examId === exam.id && r.classKey === selectedClassKey);
                    const scoredCount = record 
                      ? (Object.values(record.studentScores) as StudentExamScore[]).filter((s) => s.score !== undefined || s.status === 'absent' || s.status === 'leave').length 
                      : 0;
                    const totalStudentsInClass = classStudents.length;
                    const isFullyGraded = totalStudentsInClass > 0 && scoredCount >= totalStudentsInClass;

                    return (
                      <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{exam.title}</div>
                          {exam.examDate && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>จัดสอบ: {exam.examDate}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${typeCfg.badge}`}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {formatStrandDisplay(exam.strand)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {exam.topic || '-'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono font-bold text-slate-700">เทอม {exam.semester}</span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {exam.maxScore}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {exam.passingScore}
                          </span>
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setActiveExamId(exam.id);
                                setActiveTab('score_entry');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="บันทึกคะแนนสอบของชุดนี้"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>ตรวจ/ลงคะแนน</span>
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
                    );
                  })}
                </tbody>
              </table>
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
              </div>

              {activeExam && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    คะแนนเต็ม: {activeExam.maxScore} คะแนน
                  </span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    เกณฑ์ผ่าน: {activeExam.passingScore} คะแนน
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
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                      <th className="py-3 px-3 w-20 text-center">รหัสนักเรียน</th>
                      <th className="py-3 px-4 min-w-44">ชื่อ - นามสกุล</th>
                      <th className="py-3 px-3 w-28 text-center">
                        คะแนนสอบ
                        <div className="text-[10px] font-normal text-slate-400 font-mono">(เต็ม {activeExam.maxScore})</div>
                      </th>
                      <th className="py-3 px-3 w-32 text-center">สถานะการสอบ</th>
                      <th className="py-3 px-3 w-24 text-center">คะแนนแก้ตัว</th>
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
                      const effectiveScore = hasRetest ? (scoreData.retestScore as number) : (scoreData.score ?? 0);
                      const percent = activeExam.maxScore > 0 && (hasScore || hasRetest) 
                        ? ((effectiveScore / activeExam.maxScore) * 100).toFixed(0) 
                        : '-';
                      const isPassed = !isAbsent && !isLeave && (hasScore || hasRetest) && effectiveScore >= activeExam.passingScore;

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
                          
                          {/* Score Input */}
                          <td className="py-2.5 px-3 text-center">
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
                                placeholder="คะแนนใหม่"
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

              {/* Score & Passing Score */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    คะแนนเต็ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={examFormData.maxScore}
                    onChange={(e) => {
                      const max = Number(e.target.value) || 0;
                      setExamFormData({
                        ...examFormData,
                        maxScore: max,
                        passingScore: Math.round(max * 0.5),
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เกณฑ์คะแนนผ่าน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={examFormData.maxScore}
                    required
                    value={examFormData.passingScore}
                    onChange={(e) => setExamFormData({ ...examFormData, passingScore: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
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

    </div>
  );
};
