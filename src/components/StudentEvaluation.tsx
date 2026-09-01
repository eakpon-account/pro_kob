import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  FileSpreadsheet, 
  Award, 
  BookOpen, 
  School, 
  CheckCircle2, 
  Calculator,
  X,
  FileText,
  Bookmark,
  Layers,
  HelpCircle,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Sparkles,
  Columns,
  Minimize2,
  Maximize2,
  LayoutGrid,
  ListFilter,
  Keyboard,
  Smartphone,
  Monitor,
  UserCheck,
  ClipboardCheck,
  CheckSquare,
  AlertCircle,
  Eye,
  Percent,
  Sliders,
  Check,
  Info,
  Flame,
  FileBadge
} from 'lucide-react';
import { 
  Assignment, 
  AssignmentCategory, 
  Student, 
  StudentSubjectScore, 
  Subject 
} from '../types';
import { 
  computeFinalCombinedScore, 
  computeSemesterScore, 
  getCategoryInfo, 
  getGradeLabel 
} from '../utils/grading';
import { storage } from '../services/storage';
import { exportEvaluationReportExcel } from '../utils/excelHelper';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface StudentEvaluationProps {
  students: Student[];
  subjects: Subject[];
  assignments: Assignment[];
  scores: StudentSubjectScore[];
  onUpdateScores: (newScores: StudentSubjectScore[]) => void;
  onUpdateAssignments: (newAssignments: Assignment[]) => void;
  preselectedSubjectId?: string;
  preselectedClassKey?: string;
}

export const StudentEvaluation: React.FC<StudentEvaluationProps> = ({
  students,
  subjects,
  assignments,
  scores,
  onUpdateScores,
  onUpdateAssignments,
  preselectedSubjectId,
  preselectedClassKey,
}) => {
  // Navigation & Selection States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    preselectedSubjectId || (subjects.length > 0 ? subjects[0].id : '')
  );
  
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  }, [subjects, selectedSubjectId]);

  // Target Classes for selected subject
  const availableClasses = useMemo(() => {
    if (!selectedSubject) return [];
    return selectedSubject.targetClasses || [];
  }, [selectedSubject]);

  const [selectedClassKey, setSelectedClassKey] = useState<string>(
    preselectedClassKey || (availableClasses.length > 0 ? availableClasses[0] : 'ม.1/1')
  );

  // Sync selectedClassKey when subject changes if not valid
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClassKey)) {
      setSelectedClassKey(availableClasses[0]);
    }
  }, [availableClasses, selectedClassKey]);

  // Active Semester Tab (1 or 2)
  const [activeSemester, setActiveSemester] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Evaluation Items (Add / Edit / Reorder / Delete)
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicMaxScore, setNewTopicMaxScore] = useState<number>(20);
  const [newTopicCategory, setNewTopicCategory] = useState<AssignmentCategory>('worksheet');

  // Edit Modal State
  const [itemToEdit, setItemToEdit] = useState<Assignment | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicDescription, setEditTopicDescription] = useState('');
  const [editTopicMaxScore, setEditTopicMaxScore] = useState<number>(20);
  const [editTopicCategory, setEditTopicCategory] = useState<AssignmentCategory>('worksheet');

  // Delete & Reorder State
  const [itemToDelete, setItemToDelete] = useState<Assignment | null>(null);
  const [showReorderModal, setShowReorderModal] = useState(false);

  // Single Student Individual Assessment View Modal
  const [studentToView, setStudentToView] = useState<Student | null>(null);

  // Print Classroom Assessment Modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Status Notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);

  // Filter students for current class and sort by student number (ASC)
  const filteredStudents = useMemo(() => {
    let list = students.filter((s) => s.classKey === selectedClassKey);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.studentCode.includes(q) ||
          String(s.studentNumber).includes(q)
      );
    }
    return list.sort((a, b) => a.studentNumber - b.studentNumber);
  }, [students, selectedClassKey, searchQuery]);

  // Current Subject Evaluation Items (Assignments) for current semester
  const currentSemesterItems = useMemo(() => {
    if (!selectedSubject) return [];
    return assignments
      .filter((a) => a.subjectId === selectedSubject.id && a.semester === activeSemester)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [assignments, selectedSubject, activeSemester]);

  // Map of scores: studentId -> StudentSubjectScore
  const scoreMap = useMemo(() => {
    const map = new Map<string, StudentSubjectScore>();
    scores
      .filter((s) => s.subjectId === selectedSubjectId)
      .forEach((s) => map.set(s.studentId, s));
    return map;
  }, [scores, selectedSubjectId]);

  // Total Max Score for current evaluation items
  const totalMaxScore = useMemo(() => {
    return currentSemesterItems.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0);
  }, [currentSemesterItems]);

  // Statistics calculation for the classroom
  const classroomStats = useMemo(() => {
    if (filteredStudents.length === 0 || currentSemesterItems.length === 0) {
      return {
        avgScore: 0,
        avgPercentage: 0,
        passCount: 0,
        excellentCount: 0,
        passRate: 0,
      };
    }

    let totalRawEarned = 0;
    let pass = 0;
    let excellent = 0;

    filteredStudents.forEach((st) => {
      const sc = scoreMap.get(st.id);
      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
      const asgScores = sc?.[semKey]?.assignmentScores || {};

      let studentTotal = 0;
      currentSemesterItems.forEach((item) => {
        const val = asgScores[item.id];
        if (typeof val === 'number') {
          studentTotal += val;
        }
      });

      totalRawEarned += studentTotal;
      const pct = totalMaxScore > 0 ? (studentTotal / totalMaxScore) * 100 : 0;
      if (pct >= 50) pass++;
      if (pct >= 80) excellent++;
    });

    const avgScore = Number((totalRawEarned / filteredStudents.length).toFixed(1));
    const avgPercentage = totalMaxScore > 0 ? Number(((avgScore / totalMaxScore) * 100).toFixed(1)) : 0;
    const passRate = Number(((pass / filteredStudents.length) * 100).toFixed(0));

    return {
      avgScore,
      avgPercentage,
      passCount: pass,
      excellentCount: excellent,
      passRate,
    };
  }, [filteredStudents, currentSemesterItems, scoreMap, activeSemester, totalMaxScore]);

  // Handle Score Input Change
  const handleScoreChange = (studentId: string, itemId: string, rawValue: string) => {
    if (!selectedSubject) return;

    const item = currentSemesterItems.find((a) => a.id === itemId);
    if (!item) return;

    let numVal: number | undefined;
    if (rawValue.trim() === '') {
      numVal = undefined;
    } else {
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed)) return;
      // Clamp between 0 and maxScore
      numVal = Math.min(Math.max(0, parsed), item.maxScore);
    }

    const existingScore = scoreMap.get(studentId) || {
      id: `${selectedSubject.id}_${studentId}_2568`,
      studentId,
      subjectId: selectedSubject.id,
      academicYear: '2568',
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

    const targetSemester = activeSemester;
    const semKey = targetSemester === 1 ? 'semester1' : 'semester2';
    const oldAsgScores = { ...(existingScore[semKey]?.assignmentScores || {}) };

    if (numVal === undefined) {
      delete oldAsgScores[itemId];
    } else {
      oldAsgScores[itemId] = numVal;
    }

    // Recalculate semester scores
    const calculatedSem = computeSemesterScore(oldAsgScores, currentSemesterItems);

    const updatedRecord: StudentSubjectScore = {
      ...existingScore,
      [semKey]: calculatedSem,
      updatedAt: new Date().toISOString(),
    };

    const s1Total = targetSemester === 1 ? calculatedSem.totalSemesterScore : updatedRecord.semester1.totalSemesterScore;
    const s2Total = targetSemester === 2 ? calculatedSem.totalSemesterScore : updatedRecord.semester2.totalSemesterScore;
    updatedRecord.finalCombined = computeFinalCombinedScore(s1Total, s2Total);

    // Save
    storage.saveScore(updatedRecord);
    const newScores = scores.filter((s) => s.id !== updatedRecord.id).concat(updatedRecord);
    onUpdateScores(newScores);
  };

  // Add Evaluation Item (หัวข้อการประเมินใหม่)
  const handleCreateEvaluationItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedSubject) return;

    const maxScore = Math.max(1, Number(newTopicMaxScore) || 10);
    const newItem: Assignment = {
      id: `eval-${selectedSubject.id}-s${activeSemester}-${Date.now()}`,
      subjectId: selectedSubject.id,
      semester: activeSemester,
      name: newTopicName.trim(),
      category: newTopicCategory,
      maxScore: maxScore,
      description: newTopicDescription.trim() || '',
      orderIndex: currentSemesterItems.length + 1,
    };

    const updatedAssignments = [...assignments, newItem];
    storage.saveAssignment(newItem);
    onUpdateAssignments(updatedAssignments);

    // Recalculate scores
    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const semItems = updatedAssignments.filter((a) => a.subjectId === selectedSubject.id && a.semester === activeSemester);

    const updatedScores = affectedScores.map((rec) => {
      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
      const semData = rec[semKey];
      const recalc = computeSemesterScore(semData.assignmentScores, semItems);

      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = activeSemester === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = activeSemester === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'success',
      text: 'เพิ่มหัวข้อและช่องคะแนนประเมินเรียบร้อยแล้ว',
      subText: `หัวข้อ: "${newItem.name}" (คะแนนเต็ม ${newItem.maxScore} คะแนน)`,
    });

    // Reset Form
    setNewTopicName('');
    setNewTopicDescription('');
    setNewTopicMaxScore(20);
    setNewTopicCategory('worksheet');
    setShowAddItemModal(false);

    setTimeout(() => {
      setStatusMessage((cur) => (cur?.text.includes('เพิ่มหัวข้อ') ? null : cur));
    }, 4000);
  };

  // Open Edit Modal
  const handleOpenEditItem = (item: Assignment) => {
    setItemToEdit(item);
    setEditTopicName(item.name);
    setEditTopicDescription(item.description || '');
    setEditTopicMaxScore(item.maxScore);
    setEditTopicCategory(item.category);
  };

  // Save Edit
  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !selectedSubject || !editTopicName.trim()) return;

    const newMax = Math.max(1, Number(editTopicMaxScore) || 10);
    const updatedItem: Assignment = {
      ...itemToEdit,
      name: editTopicName.trim(),
      description: editTopicDescription.trim() || '',
      maxScore: newMax,
      category: editTopicCategory,
    };

    const updatedAssignments = assignments.map((a) => (a.id === updatedItem.id ? updatedItem : a));
    storage.saveAssignment(updatedItem);
    onUpdateAssignments(updatedAssignments);

    // Recalculate
    const semItems = updatedAssignments.filter(
      (a) => a.subjectId === selectedSubject.id && a.semester === activeSemester
    );
    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const updatedScores = affectedScores.map((rec) => {
      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
      const semData = rec[semKey];
      const recalc = computeSemesterScore(semData.assignmentScores, semItems);

      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = activeSemester === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = activeSemester === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'success',
      text: 'แก้ไขข้อมูลหัวข้อการประเมินสำเร็จ',
      subText: `ปรับปรุง "${updatedItem.name}" (คะแนนเต็ม ${updatedItem.maxScore} คะแนน)`,
    });

    setItemToEdit(null);
    setTimeout(() => {
      setStatusMessage((cur) => (cur?.text.includes('แก้ไข') ? null : cur));
    }, 4000);
  };

  // Delete Evaluation Item
  const handleConfirmDeleteItem = () => {
    if (!itemToDelete || !selectedSubject) return;

    const deletedId = itemToDelete.id;
    const deletedName = itemToDelete.name;

    const updatedAssignments = assignments.filter((a) => a.id !== deletedId);
    storage.deleteAssignment(deletedId);
    onUpdateAssignments(updatedAssignments);

    // Remove scores for this item and recalculate
    const semItems = updatedAssignments.filter(
      (a) => a.subjectId === selectedSubject.id && a.semester === activeSemester
    );
    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const updatedScores = affectedScores.map((rec) => {
      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
      const newAsgScores = { ...(rec[semKey]?.assignmentScores || {}) };
      delete newAsgScores[deletedId];

      const recalc = computeSemesterScore(newAsgScores, semItems);
      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = activeSemester === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = activeSemester === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'deleted',
      text: `ลบหัวข้อประเมิน "${deletedName}" เรียบร้อยแล้ว`,
    });

    setItemToDelete(null);
    setTimeout(() => {
      setStatusMessage((cur) => (cur?.text.includes('ลบหัวข้อ') ? null : cur));
    }, 4000);
  };

  // Quick Action: Fill Max Score for All Students in this column
  const handleFillMaxScore = (itemId: string) => {
    if (!selectedSubject) return;
    const item = currentSemesterItems.find((a) => a.id === itemId);
    if (!item) return;

    filteredStudents.forEach((st) => {
      handleScoreChange(st.id, itemId, String(item.maxScore));
    });

    setStatusMessage({
      type: 'success',
      text: `กรอกคะแนนเต็ม (${item.maxScore} คะแนน) ให้นักเรียนทุกคนในห้องแล้ว`,
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Quick Action: Clear Score for All Students in this column
  const handleClearScoreColumn = (itemId: string) => {
    if (!selectedSubject) return;
    const item = currentSemesterItems.find((a) => a.id === itemId);
    if (!item) return;

    filteredStudents.forEach((st) => {
      handleScoreChange(st.id, itemId, '');
    });

    setStatusMessage({
      type: 'deleted',
      text: `ล้างคะแนนในหัวข้อ "${item.name}" ทั้งห้องเรียบร้อยแล้ว`,
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Move Column Left / Right
  const handleMoveColumn = (index: number, direction: 'left' | 'right') => {
    if (!selectedSubject) return;
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentSemesterItems.length) return;

    const list = [...currentSemesterItems];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    // Update orderIndex
    const updatedCurrent = list.map((item, i) => ({
      ...item,
      orderIndex: i + 1,
    }));

    const otherAsgs = assignments.filter(
      (a) => !(a.subjectId === selectedSubject.id && a.semester === activeSemester)
    );

    const fullUpdated = [...otherAsgs, ...updatedCurrent];
    storage.saveAllAssignments(fullUpdated);
    onUpdateAssignments(fullUpdated);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!selectedSubject) return;
    exportEvaluationReportExcel(
      selectedSubject,
      selectedClassKey,
      activeSemester,
      filteredStudents,
      currentSemesterItems,
      scores
    );
  };

  // Quick Presets for Topic Names
  const topicPresets = [
    { title: 'การส่งงานตรงต่อเวลา', desc: 'ส่งงานครบถ้วนและตรงตามกำหนดเวลาที่ตกลงกันไว้', score: 10, category: 'worksheet' as AssignmentCategory },
    { title: 'ความถูกต้องและสมบูรณ์', desc: 'เนื้อหาถูกต้อง ชัดเจน ครบถ้วนตามมาตรฐานตัวชี้วัด', score: 20, category: 'worksheet' as AssignmentCategory },
    { title: 'ทักษะกระบวนการคิด/ปฏิบัติ', desc: 'มีขั้นตอนการทำงานอย่างเป็นระบบ วางแผนและแก้ปัญหาได้ดี', score: 20, category: 'exercise' as AssignmentCategory },
    { title: 'การนำเสนอผลงาน', desc: 'สื่อสารได้น่าสนใจ มีความมั่นใจและตอบข้อซักถามได้ชัดเจน', score: 15, category: 'project' as AssignmentCategory },
    { title: 'คุณลักษณะอันพึงประสงค์', desc: 'มีวินัย ใฝ่เรียนรู้ มุ่งมั่นในการทำงาน และมีจิตสาธารณะ', score: 10, category: 'custom' as AssignmentCategory },
    { title: 'ชิ้นงานสร้างสรรค์/โครงงาน', desc: 'ผลงานมีความคิดริเริ่มสร้างสรรค์ ประณีตและประยุกต์ใช้ได้จริง', score: 30, category: 'project' as AssignmentCategory },
    { title: 'แบบทดสอบท้ายหน่วย', desc: 'วัดความรู้ความเข้าใจตามตัวชี้วัดของหน่วยการเรียนรู้', score: 20, category: 'test' as AssignmentCategory },
  ];

  return (
    <div className="space-y-6">
      {/* Toast / Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm transition-all duration-300 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : statusMessage.type === 'deleted'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'deleted' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <div>
              <p className="font-semibold text-xs">{statusMessage.text}</p>
              {statusMessage.subText && <p className="text-[11px] opacity-85 mt-0.5">{statusMessage.subText}</p>}
            </div>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls Panel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                  แบบบันทึกการประเมินนักเรียนรายบุคคล
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  ประเมินตามเกณฑ์
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดหัวข้อ รายละเอียดเกณฑ์การให้คะแนน และบันทึกคะแนนประเมินรายบุคคล
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Add Evaluation Column Button */}
            <button
              id="btn-add-evaluation-item"
              onClick={() => setShowAddItemModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มช่องคะแนน / หัวข้อการประเมิน</span>
            </button>

            {/* Reorder Columns */}
            {currentSemesterItems.length > 1 && (
              <button
                onClick={() => setShowReorderModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                title="จัดลำดับหัวข้อการประเมิน"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">จัดลำดับหัวข้อ</span>
              </button>
            )}

            {/* Print Classroom Sheet */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์แบบบันทึก</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Subject, Class, Semester, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          
          {/* Subject Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              เลือกรายวิชา
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name} ({sub.credits} นก.)
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              ห้องเรียน
            </label>
            <select
              value={selectedClassKey}
              onChange={(e) => setSelectedClassKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  ห้อง {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              ภาคเรียนที่ประเมิน
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSemester(1)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSemester === 1
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 1
              </button>
              <button
                type="button"
                onClick={() => setActiveSemester(2)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSemester === 2
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 2
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              ค้นหานักเรียน
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เลขที่, รหัส..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Quick Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              จำนวนนักเรียน
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-slate-800">{filteredStudents.length}</span>
              <span className="text-[11px] text-slate-500 font-medium">คน</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              หัวข้อการประเมิน
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-indigo-600">{currentSemesterItems.length}</span>
              <span className="text-[11px] text-slate-500 font-medium">หัวข้อ (เต็ม {totalMaxScore} คะแนน)</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              คะแนนเฉลี่ยห้อง
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-emerald-600">{classroomStats.avgScore}</span>
              <span className="text-[11px] text-slate-500 font-medium">({classroomStats.avgPercentage}%)</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              อัตราผ่านเกณฑ์
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-bold text-amber-600">{classroomStats.passRate}%</span>
              <span className="text-[11px] text-slate-500 font-medium">({classroomStats.passCount}/{filteredStudents.length} คน)</span>
            </div>
          </div>

        </div>
      </div>

      {/* Main Table: Evaluation Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Top Subheader */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileBadge className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              ตารางบันทึกคะแนนประเมินรายบุคคล — {selectedSubject?.code} ห้อง {selectedClassKey} (ภาคเรียนที่ {activeSemester})
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>ดีเยี่ยม (80-100%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>ดี (70-79%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>ผ่าน (50-69%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>ปรับปรุง (&lt;50%)</span>
            </span>
          </div>
        </div>

        {/* Evaluation Items Empty State */}
        {currentSemesterItems.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto">
              <Plus className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-sm font-bold text-slate-800">ยังไม่มีหัวข้อการประเมินในภาคเรียนที่ {activeSemester}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                คลิกปุ่มด้านล่างเพื่อเริ่มสร้างหัวข้อการประเมิน เช่น ทักษะการปฏิบัติงาน, การส่งงานตรงเวลา, คุณลักษณะอันพึงประสงค์ หรือแบบทดสอบ
              </p>
            </div>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างหัวข้อการประเมินแรก</span>
            </button>
          </div>
        ) : (
          /* Table Container with Horizontal Scroll */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                  
                  {/* Fixed Columns */}
                  <th className="py-3 px-3 w-12 text-center font-bold text-slate-600 border-r border-slate-200">
                    เลขที่
                  </th>
                  <th className="py-3 px-3 w-20 text-center font-bold text-slate-600 border-r border-slate-200">
                    รหัส
                  </th>
                  <th className="py-3 px-4 min-w-[180px] font-bold text-slate-800 border-r border-slate-200">
                    ชื่อ - นามสกุล
                  </th>

                  {/* Dynamic Evaluation Columns */}
                  {currentSemesterItems.map((item, index) => {
                    const catInfo = getCategoryInfo(item.category);
                    return (
                      <th
                        key={item.id}
                        className="py-3 px-3 min-w-[150px] max-w-[200px] border-r border-slate-200 align-top bg-slate-50/70"
                      >
                        <div className="space-y-1.5">
                          
                          {/* Topic Name & Menu */}
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-800 leading-tight line-clamp-2" title={item.name}>
                              {index + 1}. {item.name}
                            </span>
                            
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="p-1 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                title="แก้ไขหัวข้อและเกณฑ์คะแนน"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setItemToDelete(item)}
                                className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="ลบหัวข้อนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Description / Rubric Preview */}
                          {item.description && (
                            <p className="text-[10px] text-slate-500 font-normal line-clamp-2 leading-tight bg-white p-1.5 rounded border border-slate-200/60" title={item.description}>
                              {item.description}
                            </p>
                          )}

                          {/* Max Score & Quick Actions */}
                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span className="font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              เต็ม {item.maxScore}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFillMaxScore(item.id)}
                                className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-[9px] transition-colors cursor-pointer"
                                title="กรอกคะแนนเต็มทุกคน"
                              >
                                เต็มทุกคน
                              </button>
                              <button
                                onClick={() => handleClearScoreColumn(item.id)}
                                className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-[9px] transition-colors cursor-pointer"
                                title="ล้างคะแนนช่องนี้"
                              >
                                ล้าง
                              </button>
                            </div>
                          </div>

                        </div>
                      </th>
                    );
                  })}

                  {/* Summary Columns */}
                  <th className="py-3 px-3 w-24 text-center font-bold text-slate-800 bg-indigo-50/50 border-r border-slate-200">
                    <div>รวมคะแนน</div>
                    <div className="text-[10px] text-indigo-700 font-medium mt-0.5">(เต็ม {totalMaxScore})</div>
                  </th>
                  <th className="py-3 px-3 w-20 text-center font-bold text-slate-800 bg-indigo-50/50 border-r border-slate-200">
                    ร้อยละ (%)
                  </th>
                  <th className="py-3 px-3 w-24 text-center font-bold text-slate-800 bg-indigo-50/50 border-r border-slate-200">
                    ระดับคุณภาพ
                  </th>
                  <th className="py-3 px-3 w-20 text-center font-bold text-slate-800 bg-indigo-50/50 border-r border-slate-200">
                    เกรด
                  </th>
                  <th className="py-3 px-3 w-24 text-center font-bold text-slate-800">
                    แบบประเมินเดี่ยว
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredStudents.map((student, sIdx) => {
                  const sc = scoreMap.get(student.id);
                  const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
                  const asgScores = sc?.[semKey]?.assignmentScores || {};

                  // Compute raw earned score
                  let studentRawTotal = 0;
                  currentSemesterItems.forEach((item) => {
                    const val = asgScores[item.id];
                    if (typeof val === 'number') {
                      studentRawTotal += val;
                    }
                  });

                  const percentage = totalMaxScore > 0 ? (studentRawTotal / totalMaxScore) * 100 : 0;
                  
                  let qualityLevel = 'ปรับปรุง';
                  let qualityBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  let gradeValue = 0;

                  if (percentage >= 80) {
                    qualityLevel = 'ดีเยี่ยม';
                    qualityBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    gradeValue = 4;
                  } else if (percentage >= 70) {
                    qualityLevel = 'ดี';
                    qualityBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                    gradeValue = 3;
                  } else if (percentage >= 50) {
                    qualityLevel = 'ผ่านเกณฑ์';
                    qualityBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                    gradeValue = 2;
                  }

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        sIdx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                    >
                      
                      {/* No. */}
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-600 border-r border-slate-200">
                        {student.studentNumber}
                      </td>

                      {/* Student ID */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200">
                        {student.studentCode}
                      </td>

                      {/* Student Name */}
                      <td className="py-2.5 px-4 font-medium text-slate-900 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${student.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`} />
                          <span className="font-semibold">{student.prefix}{student.firstName} {student.lastName}</span>
                        </div>
                      </td>

                      {/* Dynamic Score Inputs */}
                      {currentSemesterItems.map((item) => {
                        const currentVal = asgScores[item.id];
                        const valString = currentVal !== undefined ? String(currentVal) : '';
                        const isMax = currentVal === item.maxScore;

                        return (
                          <td
                            key={item.id}
                            className="py-2 px-2 text-center border-r border-slate-200"
                          >
                            <input
                              type="number"
                              min="0"
                              max={item.maxScore}
                              step="any"
                              value={valString}
                              placeholder="-"
                              onChange={(e) => handleScoreChange(student.id, item.id, e.target.value)}
                              className={`w-full text-center py-1.5 px-2 rounded-lg font-bold text-xs border transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                                valString === ''
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 placeholder-slate-300'
                                  : isMax
                                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-800'
                                  : 'bg-white border-slate-300 text-slate-800'
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Total Score */}
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/30 border-r border-slate-200">
                        {studentRawTotal}
                      </td>

                      {/* Percentage */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 bg-indigo-50/30 border-r border-slate-200">
                        {percentage.toFixed(1)}%
                      </td>

                      {/* Quality Level Badge */}
                      <td className="py-2.5 px-3 text-center bg-indigo-50/30 border-r border-slate-200">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${qualityBadgeClass}`}>
                          {qualityLevel}
                        </span>
                      </td>

                      {/* Grade */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 bg-indigo-50/30 border-r border-slate-200">
                        {gradeValue}
                      </td>

                      {/* View Single Student Modal Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setStudentToView(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>ดูแบบเดี่ยว</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: เพิ่มช่องคะแนน / หัวข้อการประเมิน (Add Evaluation Item Modal) */}
      {/* ========================================================================= */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    เพิ่มช่องคะแนน / หัวข้อการประเมิน
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedSubject?.code} - {selectedSubject?.name} (ภาคเรียนที่ {activeSemester})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Preset Selector Chips */}
            <div className="mt-4 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>หรือคลิกเลือกตัวอย่างหัวข้อแนะนำด่วน:</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {topicPresets.map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => {
                      setNewTopicName(preset.title);
                      setNewTopicDescription(preset.desc);
                      setNewTopicMaxScore(preset.score);
                      setNewTopicCategory(preset.category);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border border-slate-200/80"
                  >
                    + {preset.title} ({preset.score} คะแนน)
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateEvaluationItem} className="mt-4 space-y-4">
              
              {/* 1. หัวข้อการประเมิน (Topic Title) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  หัวข้อการประเมิน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น การส่งงานตรงต่อเวลา, ทักษะการปฏิบัติงาน, คุณลักษณะอันพึงประสงค์"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 2. รายละเอียด / เกณฑ์การให้คะแนน (Rubric Description) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รายละเอียด / เกณฑ์การให้คะแนน (คำอธิบาย Rubric)
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น ส่งงานตรงเวลา มีความประณีตเรียบร้อย และเนื้อหาถูกต้องครบถ้วนตามเกณฑ์..."
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 3. คะแนนเต็ม & หมวดหมู่ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* คะแนนเต็ม */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    คะแนนเต็ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={newTopicMaxScore}
                    onChange={(e) => setNewTopicMaxScore(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  {/* Quick score chips */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {[5, 10, 15, 20, 25, 30, 50].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setNewTopicMaxScore(sc)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          newTopicMaxScore === sc
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* หมวดหมู่ / ด้านการประเมิน */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    หมวดหมู่ / ด้านการประเมิน
                  </label>
                  <select
                    value={newTopicCategory}
                    onChange={(e) => setNewTopicCategory(e.target.value as AssignmentCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="worksheet">ใบงาน / แบบฝึกหัด (Worksheet)</option>
                    <option value="exercise">ทักษะและการปฏิบัติ (Skill/Practice)</option>
                    <option value="project">โครงงาน / ชิ้นงาน (Project/Product)</option>
                    <option value="report">รายงาน / การนำเสนอ (Report/Presentation)</option>
                    <option value="homework_book">สมุดการบ้าน / ผลงาน (Book/Portfolio)</option>
                    <option value="test">แบบทดสอบ / การสอบ (Test/Exam)</option>
                    <option value="custom">คุณลักษณะ / กำหนดเอง (Custom Rubric)</option>
                  </select>
                </div>

              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกและเพิ่มช่องคะแนน</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: แก้ไขหัวข้อการประเมิน (Edit Evaluation Item Modal) */}
      {/* ========================================================================= */}
      {itemToEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    แก้ไขหัวข้อและเกณฑ์คะแนนประเมิน
                  </h3>
                  <p className="text-xs text-slate-500">
                    ปรับปรุงรายละเอียดและคะแนนเต็มของช่องคะแนนนี้
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="mt-4 space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  หัวข้อการประเมิน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTopicName}
                  onChange={(e) => setEditTopicName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รายละเอียด / เกณฑ์การให้คะแนน
                </label>
                <textarea
                  rows={3}
                  value={editTopicDescription}
                  onChange={(e) => setEditTopicDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    คะแนนเต็ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={editTopicMaxScore}
                    onChange={(e) => setEditTopicMaxScore(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    หมวดหมู่
                  </label>
                  <select
                    value={editTopicCategory}
                    onChange={(e) => setEditTopicCategory(e.target.value as AssignmentCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="worksheet">ใบงาน / แบบฝึกหัด (Worksheet)</option>
                    <option value="exercise">ทักษะและการปฏิบัติ (Skill/Practice)</option>
                    <option value="project">โครงงาน / ชิ้นงาน (Project/Product)</option>
                    <option value="report">รายงาน / การนำเสนอ (Report/Presentation)</option>
                    <option value="homework_book">สมุดการบ้าน / ผลงาน (Book/Portfolio)</option>
                    <option value="test">แบบทดสอบ / การสอบ (Test/Exam)</option>
                    <option value="custom">คุณลักษณะ / กำหนดเอง (Custom Rubric)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: จัดลำดับหัวข้อการประเมิน (Reorder Modal) */}
      {/* ========================================================================= */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  จัดลำดับหัวข้อการประเมิน
                </h3>
              </div>
              <button
                onClick={() => setShowReorderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
              {currentSemesterItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 font-bold text-slate-700 text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">{item.name}</h4>
                      <p className="text-[10px] text-slate-500">คะแนนเต็ม {item.maxScore} คะแนน</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, 'left')}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="เลื่อนขึ้น"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === currentSemesterItems.length - 1}
                      onClick={() => handleMoveColumn(idx, 'right')}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="เลื่อนลง"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowReorderModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: แบบประเมินรายบุคคลเดี่ยว (Single Student Individual Assessment Modal) */}
      {/* ========================================================================= */}
      {studentToView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base ${studentToView.gender === 'F' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                  {studentToView.studentNumber}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    แบบบันทึกการประเมินผลรายบุคคล
                  </h3>
                  <p className="text-xs text-slate-500">
                    {studentToView.prefix}{studentToView.firstName} {studentToView.lastName} (รหัส {studentToView.studentCode}) • ห้อง {studentToView.classKey}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStudentToView(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Subject Info Card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-wrap justify-between gap-2">
                <div>
                  <span className="text-slate-500 font-medium">รายวิชา: </span>
                  <span className="font-bold text-slate-800">{selectedSubject?.code} {selectedSubject?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">ภาคเรียนที่: </span>
                  <span className="font-bold text-indigo-700">{activeSemester}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">ครูผู้สอน: </span>
                  <span className="font-bold text-slate-800">{selectedSubject?.teacherName || '-'}</span>
                </div>
              </div>

              {/* Items Evaluation Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3 w-10 text-center">ลำดับ</th>
                      <th className="py-2.5 px-3">หัวข้อและเกณฑ์การประเมิน</th>
                      <th className="py-2.5 px-3 w-24 text-center">คะแนนเต็ม</th>
                      <th className="py-2.5 px-3 w-28 text-center">คะแนนที่ได้</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentSemesterItems.map((item, idx) => {
                      const sc = scoreMap.get(studentToView.id);
                      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
                      const asgScores = sc?.[semKey]?.assignmentScores || {};
                      const val = asgScores[item.id];

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            {item.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-600">{item.maxScore}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-lg font-bold ${val !== undefined ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                              {val !== undefined ? val : '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              {(() => {
                const sc = scoreMap.get(studentToView.id);
                const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
                const asgScores = sc?.[semKey]?.assignmentScores || {};
                let studentTotal = 0;
                currentSemesterItems.forEach((item) => {
                  const val = asgScores[item.id];
                  if (typeof val === 'number') studentTotal += val;
                });
                const pct = totalMaxScore > 0 ? (studentTotal / totalMaxScore) * 100 : 0;
                let level = 'ปรับปรุง';
                let levelClass = 'bg-rose-100 text-rose-800 border-rose-200';
                if (pct >= 80) {
                  level = 'ดีเยี่ยม';
                  levelClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                } else if (pct >= 70) {
                  level = 'ดี';
                  levelClass = 'bg-blue-100 text-blue-800 border-blue-200';
                } else if (pct >= 50) {
                  level = 'ผ่านเกณฑ์';
                  levelClass = 'bg-amber-100 text-amber-800 border-amber-200';
                }

                return (
                  <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">คะแนนรวมที่ได้</span>
                        <span className="text-base font-bold text-slate-800">{studentTotal} / {totalMaxScore}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">ร้อยละ (%)</span>
                        <span className="text-base font-bold text-indigo-700">{pct.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">ผลการประเมิน</span>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${levelClass}`}>
                          {level}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ใบบันทึกเดี่ยว</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentToView(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: พิมพ์แบบบันทึกการประเมินทั้งห้อง (Classroom Print Modal) */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  ตัวอย่างก่อนพิมพ์: แบบบันทึกการประเมินนักเรียนรายบุคคล
                </h3>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Preview Container */}
            <div className="p-6 my-4 bg-white border border-slate-300 rounded-xl shadow-xs space-y-4 print:border-none print:shadow-none">
              
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-slate-900">แบบบันทึกการประเมินผลนักเรียนรายบุคคล</h2>
                <p className="text-xs text-slate-700">
                  รายวิชา {selectedSubject?.code} {selectedSubject?.name} ({selectedSubject?.credits} หน่วยกิต) • ชั้น {selectedClassKey} • ภาคเรียนที่ {activeSemester} ปีการศึกษา 2568
                </p>
                <p className="text-xs text-slate-600">
                  ครูผู้สอน: {selectedSubject?.teacherName || '...................................................'}
                </p>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden text-[11px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                      <th className="py-2 px-2 w-10 text-center border-r border-slate-300">ที่</th>
                      <th className="py-2 px-2 w-16 text-center border-r border-slate-300">รหัส</th>
                      <th className="py-2 px-3 border-r border-slate-300">ชื่อ - นามสกุล</th>
                      {currentSemesterItems.map((item, i) => (
                        <th key={item.id} className="py-2 px-2 text-center border-r border-slate-300">
                          <div>{i + 1}. {item.name}</div>
                          <div className="text-[9px] font-normal text-slate-600">(เต็ม {item.maxScore})</div>
                        </th>
                      ))}
                      <th className="py-2 px-2 text-center border-r border-slate-300">รวม ({totalMaxScore})</th>
                      <th className="py-2 px-2 text-center border-r border-slate-300">%</th>
                      <th className="py-2 px-2 text-center">ระดับคุณภาพ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredStudents.map((st) => {
                      const sc = scoreMap.get(st.id);
                      const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
                      const asgScores = sc?.[semKey]?.assignmentScores || {};

                      let studentTotal = 0;
                      currentSemesterItems.forEach((item) => {
                        const val = asgScores[item.id];
                        if (typeof val === 'number') studentTotal += val;
                      });

                      const pct = totalMaxScore > 0 ? (studentTotal / totalMaxScore) * 100 : 0;
                      let quality = 'ปรับปรุง';
                      if (pct >= 80) quality = 'ดีเยี่ยม';
                      else if (pct >= 70) quality = 'ดี';
                      else if (pct >= 50) quality = 'ผ่านเกณฑ์';

                      return (
                        <tr key={st.id}>
                          <td className="py-1.5 px-2 text-center border-r border-slate-300">{st.studentNumber}</td>
                          <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{st.studentCode}</td>
                          <td className="py-1.5 px-3 border-r border-slate-300 font-medium">{st.prefix}{st.firstName} {st.lastName}</td>
                          {currentSemesterItems.map((item) => (
                            <td key={item.id} className="py-1.5 px-2 text-center border-r border-slate-300 font-bold">
                              {asgScores[item.id] !== undefined ? asgScores[item.id] : '-'}
                            </td>
                          ))}
                          <td className="py-1.5 px-2 text-center font-bold border-r border-slate-300">{studentTotal}</td>
                          <td className="py-1.5 px-2 text-center font-semibold border-r border-slate-300">{pct.toFixed(1)}%</td>
                          <td className="py-1.5 px-2 text-center font-semibold">{quality}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs text-center">
                <div className="space-y-1">
                  <p>ลงชื่อ..........................................................ครูผู้ประเมิน</p>
                  <p>({selectedSubject?.teacherName || '..........................................................'})</p>
                  <p>ตำแหน่ง ครูผู้สอน</p>
                </div>
                <div className="space-y-1">
                  <p>ลงชื่อ..........................................................หัวหน้ากลุ่มสาระฯ/ฝ่ายวิชาการ</p>
                  <p>(..........................................................)</p>
                  <p>ตำแหน่ง หัวหน้างานวัดและประเมินผล</p>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์เอกสารนี้ (Print)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <ConfirmDeleteModal
          isOpen={true}
          title="ยืนยันการลบหัวข้อการประเมิน"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบหัวข้อ "${itemToDelete.name}" (คะแนนเต็ม ${itemToDelete.maxScore} คะแนน) ? ข้อมูลคะแนนของนักเรียนทุกคนในช่องนี้จะถูกลบออกด้วย`}
          onConfirm={handleConfirmDeleteItem}
          onCancel={() => setItemToDelete(null)}
        />
      )}

    </div>
  );
};
