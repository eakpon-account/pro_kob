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
  Monitor
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
  getGradeLabel,
  getAssignmentAbbreviation,
  getAssignmentSummaryText
} from '../utils/grading';
import { storage } from '../services/storage';
import { exportGradeReportExcel } from '../utils/excelHelper';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MobileSingleAssignmentView } from './MobileSingleAssignmentView';

interface ScoreGradingProps {
  students: Student[];
  subjects: Subject[];
  assignments: Assignment[];
  scores: StudentSubjectScore[];
  onUpdateScores: (newScores: StudentSubjectScore[]) => void;
  onUpdateAssignments: (newAssignments: Assignment[]) => void;
  onOpenPrintModal: (subject: Subject, classKey: string, students: Student[], scores: StudentSubjectScore[], semester?: 1 | 2 | 'combined') => void;
  preselectedSubjectId?: string;
  preselectedClassKey?: string;
}

export const ScoreGrading: React.FC<ScoreGradingProps> = ({
  students,
  subjects,
  assignments,
  scores,
  onUpdateScores,
  onUpdateAssignments,
  onOpenPrintModal,
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

  // Active Semester Tab (1, 2, or 'combined')
  const [activeSemesterTab, setActiveSemesterTab] = useState<1 | 2 | 'combined'>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssignmentsCollapsed, setIsAssignmentsCollapsed] = useState(false);
  
  // Layout Mode: 'table' (ตารางรวม) vs 'focus' (โฟกัสรายใบงานบนมือถือ/แท็บเล็ต)
  const [gradingLayoutMode, setGradingLayoutMode] = useState<'table' | 'focus'>('table');
  const [selectedFocusAssignmentId, setSelectedFocusAssignmentId] = useState<string>('');

  // Modals
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [newAsgCategory, setNewAsgCategory] = useState<AssignmentCategory>('worksheet');
  const [newAsgName, setNewAsgName] = useState('');
  const [newAsgMaxScore, setNewAsgMaxScore] = useState<number>(20);
  const [newAsgDescription, setNewAsgDescription] = useState('');

  // Edit Assignment State
  const [assignmentToEdit, setAssignmentToEdit] = useState<Assignment | null>(null);
  const [editAsgCategory, setEditAsgCategory] = useState<AssignmentCategory>('worksheet');
  const [editAsgName, setEditAsgName] = useState('');
  const [editAsgMaxScore, setEditAsgMaxScore] = useState<number>(20);
  const [editAsgDescription, setEditAsgDescription] = useState('');

  // Reorder Assignment Modal State
  const [showReorderModal, setShowReorderModal] = useState(false);

  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
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

  // Current Subject Assignments for current semester tab
  const currentSemesterAssignments = useMemo(() => {
    if (!selectedSubject || activeSemesterTab === 'combined') return [];
    return assignments.filter(
      (a) => a.subjectId === selectedSubject.id && a.semester === activeSemesterTab
    );
  }, [assignments, selectedSubject, activeSemesterTab]);

  // Sync selected focus assignment
  useEffect(() => {
    if (currentSemesterAssignments.length > 0) {
      if (!currentSemesterAssignments.some(a => a.id === selectedFocusAssignmentId)) {
        setSelectedFocusAssignmentId(currentSemesterAssignments[0].id);
      }
    } else {
      setSelectedFocusAssignmentId('');
    }
  }, [currentSemesterAssignments, selectedFocusAssignmentId]);

  // Currently focused assignment object
  const activeFocusAssignment = useMemo(() => {
    return currentSemesterAssignments.find(a => a.id === selectedFocusAssignmentId) || currentSemesterAssignments[0] || null;
  }, [currentSemesterAssignments, selectedFocusAssignmentId]);

  // Total Max Raw Score in the current semester
  const currentSemesterTotalMaxScore = useMemo(() => {
    return currentSemesterAssignments.reduce((sum, a) => sum + a.maxScore, 0);
  }, [currentSemesterAssignments]);

  // Score Map: studentId -> StudentSubjectScore
  const scoreMap = useMemo(() => {
    const map = new Map<string, StudentSubjectScore>();
    scores.forEach((sc) => {
      if (sc.subjectId === selectedSubjectId) {
        map.set(sc.studentId, sc);
      }
    });
    return map;
  }, [scores, selectedSubjectId]);

  // Score change handlers
  const handleScoreChange = (
    studentId: string,
    asgId: string,
    rawVal?: string,
    maxScore?: number
  ) => {
    const existingScore = scoreMap.get(studentId) || {
      id: `score-${studentId}-${selectedSubjectId}`,
      studentId,
      subjectId: selectedSubjectId,
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

    const targetSemester = activeSemesterTab === 2 ? 2 : 1;
    const semKey = targetSemester === 1 ? 'semester1' : 'semester2';
    const semAsgs = assignments.filter((a) => a.subjectId === selectedSubject.id && a.semester === targetSemester);

    const semData = { ...existingScore[semKey] };
    const asgScores = { ...(semData.assignmentScores || {}) };

    if (rawVal === '' || rawVal === undefined) {
      delete asgScores[asgId];
    } else {
      let numVal = parseFloat(rawVal);
      if (isNaN(numVal)) numVal = 0;
      if (numVal < 0) numVal = 0;
      if (maxScore !== undefined && numVal > maxScore) {
        numVal = maxScore;
      }
      asgScores[asgId] = numVal;
    }

    // คำนวณด้วยสูตร: (คะแนนรวมที่ได้ ÷ คะแนนเต็มรวม) × 100 และตัดเกรด 0, 1, 2, 3, 4
    const calculatedSem = computeSemesterScore(asgScores, semAsgs);

    const updatedRecord: StudentSubjectScore = {
      ...existingScore,
      [semKey]: calculatedSem,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate 2-semester combined average: (S1 + S2) / 2
    const s1Total = targetSemester === 1 ? calculatedSem.totalSemesterScore : updatedRecord.semester1.totalSemesterScore;
    const s2Total = targetSemester === 2 ? calculatedSem.totalSemesterScore : updatedRecord.semester2.totalSemesterScore;
    updatedRecord.finalCombined = computeFinalCombinedScore(s1Total, s2Total);

    // Save to storage & update state
    storage.saveScore(updatedRecord);
    const newScoreList = scores.filter((s) => s.id !== updatedRecord.id).concat(updatedRecord);
    onUpdateScores(newScoreList);
  };

  // Add Assignment / Score column
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgName.trim() || !selectedSubject) return;

    const semester = activeSemesterTab === 2 ? 2 : 1;
    const newAsg: Assignment = {
      id: `asg-${selectedSubject.id}-s${semester}-${Date.now()}`,
      subjectId: selectedSubject.id,
      semester,
      name: newAsgName.trim(),
      category: newAsgCategory,
      maxScore: Number(newAsgMaxScore) || 10,
      description: newAsgDescription.trim() || '',
    };

    const updatedAsgs = [...assignments, newAsg];
    storage.saveAssignment(newAsg);
    onUpdateAssignments(updatedAsgs);

    // Recalculate all scores for this subject and semester
    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const semAsgs = updatedAsgs.filter((a) => a.subjectId === selectedSubject.id && a.semester === semester);

    const updatedScores = affectedScores.map((rec) => {
      const semKey = semester === 1 ? 'semester1' : 'semester2';
      const semData = rec[semKey];
      const recalc = computeSemesterScore(semData.assignmentScores, semAsgs);

      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = semester === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = semester === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'success',
      text: 'เพิ่มช่องคะแนนเรียบร้อยแล้ว',
      subText: `เพิ่ม "${newAsg.name}" (คะแนนเต็ม ${newAsg.maxScore} คะแนน, ภาคเรียนที่ ${semester})`,
    });

    // Reset Form
    setNewAsgName('');
    setNewAsgDescription('');
    setNewAsgMaxScore(20);
    setShowAddAssignmentModal(false);

    setTimeout(() => {
      setStatusMessage((current) => (current?.text.includes('เพิ่มช่องคะแนน') ? null : current));
    }, 4000);
  };

  // Open Edit Modal for Assignment
  const handleOpenEditAssignment = (asg: Assignment) => {
    setAssignmentToEdit(asg);
    setEditAsgCategory(asg.category);
    setEditAsgName(asg.name);
    setEditAsgMaxScore(asg.maxScore);
    setEditAsgDescription(asg.description || '');
  };

  // Confirm and Save Edited Assignment
  const handleUpdateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentToEdit || !selectedSubject) return;
    if (!editAsgName.trim()) return;

    const newMax = Math.max(1, Number(editAsgMaxScore) || 10);
    const updatedAsg: Assignment = {
      ...assignmentToEdit,
      name: editAsgName.trim(),
      category: editAsgCategory,
      maxScore: newMax,
      description: editAsgDescription.trim() || '',
    };

    const updatedAsgs = assignments.map((a) => (a.id === updatedAsg.id ? updatedAsg : a));
    storage.saveAssignment(updatedAsg);
    onUpdateAssignments(updatedAsgs);

    // Recalculate scores for students of this subject in this semester
    const semester = updatedAsg.semester;
    const semAsgs = updatedAsgs.filter(
      (a) => a.subjectId === selectedSubject.id && a.semester === semester
    );

    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const updatedScores = affectedScores.map((rec) => {
      const semKey = semester === 1 ? 'semester1' : 'semester2';
      const semData = rec[semKey];
      const recalc = computeSemesterScore(semData.assignmentScores, semAsgs);

      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = semester === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = semester === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'success',
      text: 'แก้ไขช่องคะแนนเรียบร้อยแล้ว',
      subText: `แก้ไขข้อมูล "${updatedAsg.name}" (คะแนนเต็ม ${updatedAsg.maxScore} คะแนน)`,
    });

    setAssignmentToEdit(null);

    setTimeout(() => {
      setStatusMessage((current) => (current?.text.includes('แก้ไขช่องคะแนน') ? null : current));
    }, 4000);
  };

  // Reorder / Move Assignment (Left / Right / Up / Down)
  const handleMoveAssignment = (asgId: string, direction: 'left' | 'right' | 'up' | 'down') => {
    if (!selectedSubject) return;

    const curSemAsgs = [...currentSemesterAssignments];
    const idx = curSemAsgs.findIndex((a) => a.id === asgId);
    if (idx < 0) return;

    const targetIdx = (direction === 'left' || direction === 'up') ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= curSemAsgs.length) return;

    // Swap positions
    const movingItem = curSemAsgs[idx];
    curSemAsgs[idx] = curSemAsgs[targetIdx];
    curSemAsgs[targetIdx] = movingItem;

    // Reconstruct full assignment list with new order
    const otherAsgs = assignments.filter(
      (a) => !(a.subjectId === selectedSubject.id && a.semester === activeSemesterTab)
    );
    const updatedAll = [...otherAsgs, ...curSemAsgs];

    storage.saveAllAssignments(updatedAll);
    onUpdateAssignments(updatedAll);

    setStatusMessage({
      type: 'success',
      text: 'สลับตำแหน่งช่องคะแนนเรียบร้อยแล้ว',
      subText: `ย้าย "${movingItem.name}" ไปยังตำแหน่งลำดับที่ ${targetIdx + 1}`,
    });

    setTimeout(() => {
      setStatusMessage((current) => (current?.text.includes('สลับตำแหน่ง') ? null : current));
    }, 3000);
  };

  // Open Delete Modal for Assignment
  const handleRequestDeleteAssignment = (asg: Assignment) => {
    setAssignmentToDelete(asg);
  };

  // Confirm and Execute Assignment Deletion
  const handleConfirmDeleteAssignment = () => {
    if (!assignmentToDelete || !selectedSubject) return;

    const asg = assignmentToDelete;
    storage.deleteAssignment(asg.id);
    const remainingAsgs = assignments.filter((a) => a.id !== asg.id);
    onUpdateAssignments(remainingAsgs);

    // Recalculate scores for this semester without this assignment
    const targetSem = asg.semester;
    const targetSemAsgs = remainingAsgs.filter(
      (a) => a.subjectId === selectedSubject.id && a.semester === targetSem
    );

    const affectedScores = scores.filter((s) => s.subjectId === selectedSubject.id);
    const updatedScores = affectedScores.map((rec) => {
      const semKey = targetSem === 1 ? 'semester1' : 'semester2';
      const semData = rec[semKey];

      // Remove score key for deleted assignment
      const newAsgScores = { ...semData.assignmentScores };
      delete newAsgScores[asg.id];

      const recalc = computeSemesterScore(newAsgScores, targetSemAsgs);

      const newRec: StudentSubjectScore = {
        ...rec,
        [semKey]: recalc,
        updatedAt: new Date().toISOString(),
      };
      const s1 = targetSem === 1 ? recalc.totalSemesterScore : rec.semester1.totalSemesterScore;
      const s2 = targetSem === 2 ? recalc.totalSemesterScore : rec.semester2.totalSemesterScore;
      newRec.finalCombined = computeFinalCombinedScore(s1, s2);
      storage.saveScore(newRec);
      return newRec;
    });

    const otherScores = scores.filter((s) => s.subjectId !== selectedSubject.id);
    onUpdateScores([...otherScores, ...updatedScores]);

    setStatusMessage({
      type: 'deleted',
      text: 'ลบช่องคะแนนเรียบร้อยแล้ว',
      subText: `ลบช่องคะแนน "${asg.name}" (ระบบคำนวณคะแนนรวมและเกรดใหม่เรียบร้อยแล้ว)`,
    });
    setAssignmentToDelete(null);

    setTimeout(() => {
      setStatusMessage((current) => (current?.subText?.includes(asg.name) ? null : current));
    }, 4000);
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
          statusMessage.type === 'deleted' 
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'deleted' ? (
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold">{statusMessage.text}</p>
              {statusMessage.subText && (
                <p className="text-[11px] opacity-80 mt-0.5">{statusMessage.subText}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Filter Bar: Subject, Room & Action Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Subject & Class Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Subject Selector */}
            <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  วิชาที่กำลังบันทึกคะแนน
                </label>
                <select
                  id="select-grading-subject"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} {sub.name} ({sub.credits} นก. - {sub.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Classroom Selector */}
            <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <School className="w-4 h-4 text-emerald-600" />
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ห้องเรียน (จัดเรียงตามเลขที่)
                </label>
                <select
                  id="select-grading-classroom"
                  value={selectedClassKey}
                  onChange={(e) => setSelectedClassKey(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      ห้อง {cls} ({students.filter((s) => s.classKey === cls).length} คน)
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Print Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-print-scoresheet"
              onClick={() => onOpenPrintModal(selectedSubject, selectedClassKey, filteredStudents, scores, activeSemesterTab)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="พิมพ์ตารางบันทึกคะแนนรายชิ้นงานของภาคเรียนนี้"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ตารางให้คะแนน</span>
            </button>

            <button
              onClick={() => onOpenPrintModal(selectedSubject, selectedClassKey, filteredStudents, scores, 'combined')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
              title="พิมพ์ใบตัดเกรดสรุป 2 ภาคเรียน (ปพ.5)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ใบตัดเกรด / ปพ.5</span>
            </button>
          </div>

        </div>

        {/* Semester Tab Switcher & Add Assignment Bar */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            
            <button
              id="tab-semester-1"
              onClick={() => setActiveSemesterTab(1)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeSemesterTab === 1
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              <span>ภาคเรียนที่ 1</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${activeSemesterTab === 1 ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                {assignments.filter(a => a.subjectId === selectedSubject?.id && a.semester === 1).length} ช่องคะแนน
              </span>
            </button>

            <button
              id="tab-semester-2"
              onClick={() => setActiveSemesterTab(2)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeSemesterTab === 2
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              <span>ภาคเรียนที่ 2</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${activeSemesterTab === 2 ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                {assignments.filter(a => a.subjectId === selectedSubject?.id && a.semester === 2).length} ช่องคะแนน
              </span>
            </button>

            <button
              id="tab-semester-combined"
              onClick={() => setActiveSemesterTab('combined')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeSemesterTab === 'combined'
                  ? 'bg-slate-800 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>สรุปผล 2 ภาคเรียน (ตัดเกรด 8 ระดับ 0 - 4)</span>
            </button>

          </div>

          {/* Add Assignment Button (visible in Term 1 & 2) */}
          {activeSemesterTab !== 'combined' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                คะแนนเต็มรวม: <strong className="text-emerald-700 font-bold">{currentSemesterTotalMaxScore}</strong> คะแนน
              </span>

              <button
                id="btn-add-assignment"
                onClick={() => setShowAddAssignmentModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มช่องคะแนน</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Score DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Header Control: Search, View Mode Switcher and Column Toggle */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัสนักเรียน หรือเลขที่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-56 sm:w-72 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* View Mode Switcher: Table View vs Single Assignment Focus View */}
            {activeSemesterTab !== 'combined' && currentSemesterAssignments.length > 0 && (
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  id="btn-view-mode-table"
                  onClick={() => setGradingLayoutMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    gradingLayoutMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="โหมดตารางรวม (เหมาะสำหรับคอมพิวเตอร์และจอใหญ่)"
                >
                  <Monitor className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">ตารางรวม</span>
                </button>
                <button
                  type="button"
                  id="btn-view-mode-focus"
                  onClick={() => setGradingLayoutMode('focus')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    gradingLayoutMode === 'focus'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="โหมดตรวจรายใบงาน (เหมาะสำหรับมือถือและแท็บเล็ต แตะง่าย รวดเร็ว)"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ตรวจรายใบงาน</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1 rounded-sm font-black">ใหม่</span>
                </button>
              </div>
            )}
          </div>

          {/* Toggle Collapsible Column Button & Keyboard Guide */}
          <div className="flex flex-wrap items-center gap-2">
            {activeSemesterTab !== 'combined' && gradingLayoutMode === 'table' && (
              <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                <span>กด <strong>Enter / ↓</strong> เพื่อเลื่อนลงคนถัดไป</span>
              </div>
            )}

            {activeSemesterTab !== 'combined' && currentSemesterAssignments.length > 0 && gradingLayoutMode === 'table' && (
              <button
                type="button"
                id="btn-toggle-collapse-columns"
                onClick={() => setIsAssignmentsCollapsed(!isAssignmentsCollapsed)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-2xs bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300"
                title={isAssignmentsCollapsed ? 'คลิกเพื่อขยายดูช่องคะแนนทั้งหมด' : 'คลิกเพื่อย่อ/ซ่อนคอลัมน์คะแนนย่อย'}
              >
                {isAssignmentsCollapsed ? (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ขยายคอลัมน์คะแนน ({currentSemesterAssignments.length} ช่อง)</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>ย่อคอลัมน์คะแนน</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Main Content: Single Assignment Focus View OR Scrollable DataTable */}
        {activeSemesterTab !== 'combined' && gradingLayoutMode === 'focus' && activeFocusAssignment ? (
          <div className="p-4 sm:p-5 bg-slate-50/60">
            <MobileSingleAssignmentView
              assignment={activeFocusAssignment}
              assignments={currentSemesterAssignments}
              students={filteredStudents}
              scoreMap={scoreMap}
              activeSemester={activeSemesterTab}
              onScoreChange={handleScoreChange}
              onSelectAssignment={(id) => setSelectedFocusAssignmentId(id)}
            />
          </div>
        ) : (
          /* Scrollable DataTable with Horizontal Scrollbar & Clean White Background */
          <div className="overflow-x-auto custom-scrollbar-x bg-white pb-2.5">
            <table className="w-full text-left text-xs border-collapse bg-white">
            
            {/* Table Header */}
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-900 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-2 w-12 min-w-[48px] text-center text-xs text-slate-900 border-r border-slate-200 sticky left-0 bg-slate-100 z-10 font-bold">
                  เลขที่
                </th>
                <th className="py-3 px-1.5 w-16 min-w-[64px] text-center text-xs text-slate-900 border-r border-slate-200 sticky left-12 bg-slate-100 z-10 font-bold">
                  รหัส
                </th>
                <th className="py-3 px-4 min-w-[240px] text-left text-xs text-slate-900 border-r border-slate-200 sticky left-28 bg-slate-100 z-10 font-bold">
                  ชื่อ - นามสกุล
                </th>

                {/* Term 1 & 2 Specific Columns */}
                {activeSemesterTab !== 'combined' ? (
                  <>
                    {/* If Collapsed: Show Single Collapsible Summary Header */}
                    {isAssignmentsCollapsed ? (
                      <th className="py-2.5 px-3 min-w-[160px] text-center border-r border-slate-200 bg-emerald-50/70">
                        <button
                          type="button"
                          onClick={() => setIsAssignmentsCollapsed(false)}
                          className="flex items-center justify-center gap-1.5 w-full text-emerald-800 font-bold hover:text-emerald-950 transition-colors py-1.5 px-2 rounded-lg bg-white/80 hover:bg-white border border-emerald-200 shadow-2xs cursor-pointer"
                          title="คลิกเพื่อขยายดูช่องคะแนนย่อยทั้งหมด"
                        >
                          <Columns className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ช่องคะแนน ({currentSemesterAssignments.length})</span>
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                          (ย่ออยู่ • คลิกเพื่อขยาย)
                        </span>
                      </th>
                    ) : (
                      /* Individual Compact Assignment Columns (ตัวย่อ 1, 2... หรือ ท และคะแนนเต็ม) */
                      currentSemesterAssignments.map((asg) => {
                        const catInfo = getCategoryInfo(asg.category);
                        const abbr = getAssignmentAbbreviation(asg, currentSemesterAssignments);
                        const isTest = asg.category === 'test';
                        const summaryText = getAssignmentSummaryText(asg, currentSemesterAssignments);
                        
                        const tooltipText = `${summaryText}\nประเภท: ${catInfo.label}${asg.description ? `\nคำอธิบาย: ${asg.description}` : ''}\nคะแนนเต็ม: ${asg.maxScore} คะแนน`;

                        return (
                          <th 
                            key={asg.id} 
                            className="py-2 px-1.5 min-w-[64px] text-center border-r border-slate-200 group hover:bg-slate-100/80 transition-colors relative bg-slate-50"
                            title={tooltipText}
                          >
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* ตัวย่อช่องใบงาน/แบบทดสอบ (1, 2, 3... หรือ ท) */}
                              <span 
                                className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md font-black text-xs border shadow-2xs ${
                                  isTest
                                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                }`}
                              >
                                {abbr}
                              </span>

                              {/* คะแนนเต็ม เช่น (10) */}
                              <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                ({asg.maxScore})
                              </span>
                            </div>

                            {/* Hover Tooltip: แสดง ข้อมูลใบงาน / คำอธิบาย เมื่อนำเมาส์มาวาง */}
                            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 absolute top-full left-1/2 -translate-x-1/2 mt-2 z-40 w-64 p-3 bg-slate-900 text-white text-left rounded-xl shadow-2xl border border-slate-700 pointer-events-none text-xs font-normal">
                              {/* Tooltip triangle */}
                              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-t border-slate-700"></div>

                              <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px] mb-1">
                                <div className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span>ตัวย่อ: {abbr}</span>
                                </div>
                                <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-medium">
                                  {catInfo.label}
                                </span>
                              </div>
                              <p className="text-white font-semibold text-xs leading-snug break-words mb-2">
                                {asg.name}
                              </p>

                              <div className="pt-2 border-t border-slate-800 space-y-1">
                                <div className="text-[11px] text-slate-300">
                                  <span className="text-slate-400 font-medium">คำอธิบาย: </span>
                                  <span>{asg.description ? asg.description : '- ไม่มีคำอธิบายเพิ่มเติม -'}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                                  <span>ประเภท: <strong className="text-slate-200">{catInfo.label}</strong></span>
                                  <span>คะแนนเต็ม: <strong className="text-emerald-400">{asg.maxScore} คะแนน</strong></span>
                                </div>
                              </div>
                            </div>
                          </th>
                        );
                      })
                    )}

                    {/* Empty State when no assignments added yet */}
                    {currentSemesterAssignments.length === 0 && (
                      <th className="py-4 px-6 text-center text-slate-400 font-normal border-r border-slate-100 bg-slate-50/50 min-w-[240px]">
                        <span className="text-xs">ยังไม่มีช่องคะแนนในเทอมนี้ &rarr; กดปุ่ม &quot;เพิ่มช่องคะแนน&quot;</span>
                      </th>
                    )}

                    {/* Total Raw Score Column (เช่น 120 / 150) */}
                    <th className="py-2.5 px-3 min-w-[110px] text-center border-r border-slate-200 bg-slate-100/80 text-slate-900 font-bold">
                      <div>คะแนนดิบรวม</div>
                      <span className="text-[10px] font-semibold text-slate-700">
                        เต็ม {currentSemesterTotalMaxScore} คะแนน
                      </span>
                    </th>

                    {/* Scaled Score to 100: (ได้ ÷ เต็ม) * 100 */}
                    <th className="py-2.5 px-3 min-w-[120px] text-center border-r border-slate-200 bg-emerald-100/60 font-bold text-slate-900">
                      <div>คะแนนเต็ม 100</div>
                      <span className="text-[10px] font-semibold text-emerald-900">
                        (ดิบ ÷ {currentSemesterTotalMaxScore || 100}) × 100
                      </span>
                    </th>

                    {/* Semester Grade: 0, 1, 1.5, 2, 2.5, 3, 3.5, 4 */}
                    <th className="py-2.5 px-3 min-w-[110px] text-center font-bold text-slate-900 border-r border-slate-200 bg-amber-50/60">
                      <div>เกรดเทอม {activeSemesterTab}</div>
                      <span className="text-[10px] font-semibold text-amber-900">ระดับ 0 - 4</span>
                    </th>
                  </>
                ) : (
                  /* Combined 2-Semester View Columns */
                  <>
                    <th className="py-3 px-4 text-center border-r border-slate-200 bg-slate-100/80 min-w-[140px] font-bold text-slate-900">
                      <div>คะแนนเทอม 1</div>
                      <span className="text-[10px] text-slate-700 font-semibold">เทียบเต็ม 100</span>
                    </th>

                    <th className="py-3 px-4 text-center border-r border-slate-200 bg-slate-100/80 min-w-[140px] font-bold text-slate-900">
                      <div>คะแนนเทอม 2</div>
                      <span className="text-[10px] text-slate-700 font-semibold">เทียบเต็ม 100</span>
                    </th>

                    <th className="py-3 px-4 text-center border-r border-slate-200 bg-emerald-50/80 text-slate-900 font-bold min-w-[160px]">
                      <div>คะแนนรวมเฉลี่ย 2 เทอม</div>
                      <span className="text-[10px] text-emerald-900 font-semibold">(เทอม 1 + เทอม 2) ÷ 2</span>
                    </th>

                    <th className="py-3 px-4 text-center border-r border-slate-200 min-w-[120px] font-bold text-slate-900 bg-amber-50/60">
                      <div>เกรดตัดสินปลายปี</div>
                      <span className="text-[10px] text-amber-900 font-semibold">ระดับ 0 - 4</span>
                    </th>

                    <th className="py-3 px-4 text-center min-w-[130px] font-bold text-slate-900">
                      ผลการประเมิน
                    </th>
                  </>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 text-slate-900 font-medium">
              {filteredStudents.map((st, sIndex) => {
                const sc = scoreMap.get(st.id);
                const s1 = sc?.semester1;
                const s2 = sc?.semester2;
                const combined = sc?.finalCombined;
                const targetSemData = activeSemesterTab === 2 ? s2 : s1;

                const semGrade = targetSemData?.grade ?? 0;
                const semGradeLabel = getGradeLabel(semGrade);
                const finalGrade = combined?.finalGrade ?? 0;
                const finalGradeLabel = getGradeLabel(finalGrade);

                return (
                  <tr key={st.id} className="hover:bg-emerald-50/30 transition-colors">
                    
                    {/* Student Number (เลขที่) */}
                    <td className="py-2.5 px-2 text-center font-bold text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10">
                      <span className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-900 border border-slate-200">
                        {st.studentNumber}
                      </span>
                    </td>

                    {/* Student Code (รหัส ย่อกะทัดรัด ตัวหนา คมชัด) */}
                    <td className="py-2.5 px-1.5 text-center text-xs font-bold text-slate-900 font-mono border-r border-slate-200 sticky left-12 bg-white z-10">
                      {st.studentCode}
                    </td>

                    {/* Student Name (ขยายเต็มช่อง ตัวหนาดำเข้ม คมชัด ขนาดเท่ากัน) */}
                    <td className="py-2.5 px-4 text-xs font-bold text-slate-900 border-r border-slate-200 sticky left-28 bg-white z-10 whitespace-nowrap">
                      <span>{st.prefix} {st.firstName} {st.lastName}</span>
                    </td>

                    {/* Term 1 & 2 Specific Cells */}
                    {activeSemesterTab !== 'combined' ? (
                      <>
                        {/* If Collapsed: Show Single Compact Summary Cell */}
                        {isAssignmentsCollapsed ? (
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-emerald-50/20">
                            <span className="text-xs font-black text-slate-900">
                              {targetSemData?.totalRawAssignments?.toFixed(1) || '0.0'}
                            </span>
                            <span className="text-[10px] text-slate-600 font-medium block">
                              / {currentSemesterTotalMaxScore} คะแนน
                            </span>
                          </td>
                        ) : (
                          /* Compact Assignment Text Inputs with max score limitation & keyboard navigation */
                          <>
                            {currentSemesterAssignments.map((asg, asgIdx) => {
                              const currentScore = targetSemData?.assignmentScores?.[asg.id];
                              const displayVal = currentScore !== undefined ? String(currentScore) : '';
                              const abbr = getAssignmentAbbreviation(asg, currentSemesterAssignments);
                              return (
                                <td key={asg.id} className="py-2 px-1 text-center border-r border-slate-200 bg-white">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    id={`table-score-input-${asgIdx}-${sIndex}`}
                                    value={displayVal}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      // Allow only digits and at most one decimal point
                                      const clean = raw.replace(/[^0-9.]/g, '');
                                      const parts = clean.split('.');
                                      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;

                                      if (sanitized === '') {
                                        handleScoreChange(st.id, asg.id, '', asg.maxScore);
                                        return;
                                      }

                                      const num = parseFloat(sanitized);
                                      if (!isNaN(num)) {
                                        if (num > asg.maxScore) {
                                          handleScoreChange(st.id, asg.id, String(asg.maxScore), asg.maxScore);
                                        } else {
                                          handleScoreChange(st.id, asg.id, sanitized, asg.maxScore);
                                        }
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const nextRow = document.getElementById(`table-score-input-${asgIdx}-${sIndex + 1}`);
                                        if (nextRow) nextRow.focus();
                                      } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const prevRow = document.getElementById(`table-score-input-${asgIdx}-${sIndex - 1}`);
                                        if (prevRow) prevRow.focus();
                                      } else if (e.key === 'ArrowRight') {
                                        const nextCol = document.getElementById(`table-score-input-${asgIdx + 1}-${sIndex}`);
                                        if (nextCol) nextCol.focus();
                                      } else if (e.key === 'ArrowLeft') {
                                        const prevCol = document.getElementById(`table-score-input-${asgIdx - 1}-${sIndex}`);
                                        if (prevCol) prevCol.focus();
                                      }
                                    }}
                                    className="w-12 h-7 text-center px-0.5 bg-white hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded text-xs font-black text-slate-900 transition-all shadow-2xs"
                                    placeholder="-"
                                    title={`${abbr}. ${asg.name} (คะแนนเต็ม ${asg.maxScore} คะแนน)`}
                                  />
                                </td>
                              );
                            })}

                            {currentSemesterAssignments.length === 0 && (
                              <td className="py-2.5 px-4 text-center text-slate-400 text-xs border-r border-slate-200 bg-white">
                                -
                              </td>
                            )}
                          </>
                        )}

                        {/* Raw Score Sum (เช่น 120 / 150) */}
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 border-r border-slate-200 bg-slate-50/70">
                          <span className="text-xs font-black text-slate-900">{targetSemData?.totalRawAssignments?.toFixed(1) || '0.0'}</span>
                          <span className="text-[10px] text-slate-600 font-medium block">
                            / {currentSemesterTotalMaxScore}
                          </span>
                        </td>

                        {/* Scaled Score to 100: (ได้ ÷ เต็ม) * 100 */}
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 border-r border-slate-200 bg-emerald-50/50 text-sm">
                          {targetSemData?.totalSemesterScore?.toFixed(1) || '0.0'}
                        </td>

                        {/* Semester Grade: Integer 0, 1, 2, 3, 4 */}
                        <td className="py-2.5 px-3 text-center bg-amber-50/20">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${semGradeLabel.bgClass} ${semGradeLabel.textClass} border ${semGradeLabel.borderClass}`}>
                            เกรด {semGrade}
                          </span>
                        </td>
                      </>
                    ) : (
                      /* Combined 2-Semester View Cells */
                      <>
                        {/* Term 1 Total */}
                        <td className="py-2.5 px-4 text-center border-r border-slate-200 font-semibold text-slate-900 bg-slate-50/40">
                          <span className="text-sm font-black text-slate-900">{s1?.totalSemesterScore?.toFixed(1) || '0.0'}</span>
                          <span className="text-[10px] text-slate-600 block font-medium">
                            เกรด {s1?.grade ?? 0}
                          </span>
                        </td>

                        {/* Term 2 Total */}
                        <td className="py-2.5 px-4 text-center border-r border-slate-200 font-semibold text-slate-900 bg-slate-50/40">
                          <span className="text-sm font-black text-slate-900">{s2?.totalSemesterScore?.toFixed(1) || '0.0'}</span>
                          <span className="text-[10px] text-slate-600 block font-medium">
                            เกรด {s2?.grade ?? 0}
                          </span>
                        </td>

                        {/* (Term 1 + Term 2) / 2 */}
                        <td className="py-2.5 px-4 text-center border-r border-slate-200 font-black text-slate-900 bg-emerald-50/40 text-sm">
                          {combined?.combinedAverageScore?.toFixed(2) || '0.00'}
                          <span className="text-[10px] text-emerald-800 block font-semibold">
                            (เต็ม 100)
                          </span>
                        </td>

                        {/* Final Grade Cut (Integer 0, 1, 2, 3, 4) */}
                        <td className="py-2.5 px-4 text-center border-r border-slate-200 bg-amber-50/30">
                          <span className={`px-3.5 py-1 rounded-full font-black text-xs inline-block ${finalGradeLabel.bgClass} ${finalGradeLabel.textClass} border ${finalGradeLabel.borderClass}`}>
                            เกรด {finalGrade}
                          </span>
                        </td>

                        {/* Assessment Remark */}
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            combined?.passed
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-300'
                          }`}>
                            {combined?.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน (สอบซ่อม)'}
                          </span>
                        </td>
                      </>
                    )}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* ข้อมูลใบงานท้ายตาราง พร้อมปุ่มแก้ไขและลบ (เช่น 1.เรื่อง (คะแนน)) */}
        {activeSemesterTab !== 'combined' && currentSemesterAssignments.length > 0 && (
          <div className="p-4 bg-slate-50/90 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>ข้อมูลใบงานและช่องคะแนน (ภาคเรียนที่ {activeSemesterTab})</span>
                <span className="text-[11px] font-normal text-slate-500">
                  • ทั้งหมด {currentSemesterAssignments.length} รายการ (คะแนนเต็มรวม {currentSemesterTotalMaxScore} คะแนน)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">1</span>
                  <span>= ใบงาน / แบบฝึกหัด</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-rose-100 text-rose-800 font-bold text-xs">ท</span>
                  <span>= แบบทดสอบ</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {currentSemesterAssignments.map((asg, index) => {
                const abbr = getAssignmentAbbreviation(asg, currentSemesterAssignments);
                const catInfo = getCategoryInfo(asg.category);
                const isTest = asg.category === 'test';
                const isFirst = index === 0;
                const isLast = index === currentSemesterAssignments.length - 1;

                return (
                  <div 
                    key={asg.id}
                    className="flex flex-col justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-start gap-2.5">
                        <span className={`shrink-0 w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center border shadow-2xs ${
                          isTest 
                            ? 'bg-rose-50 text-rose-700 border-rose-300' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}>
                          {abbr}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 text-xs leading-snug line-clamp-2" title={asg.name}>
                            {asg.name}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                            <span className={`px-1.5 py-0.5 rounded border font-medium ${catInfo.bgClass} ${catInfo.textClass} ${catInfo.borderClass}`}>
                              {catInfo.label}
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              เต็ม {asg.maxScore} คะแนน
                            </span>
                          </div>
                        </div>
                      </div>

                      {asg.description && (
                        <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 line-clamp-2" title={asg.description}>
                          {asg.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons: Edit, Delete, Move left/right */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      {/* Order shift buttons */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveAssignment(asg.id, 'left')}
                          className={`p-1 rounded-md text-xs transition-colors ${
                            isFirst 
                              ? 'text-slate-300 cursor-not-allowed' 
                              : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                          }`}
                          title={isFirst ? 'อยู่ที่ตำแหน่งแรกแล้ว' : 'เลื่อนไปทางซ้าย/ขึ้นก่อนหน้า'}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveAssignment(asg.id, 'right')}
                          className={`p-1 rounded-md text-xs transition-colors ${
                            isLast 
                              ? 'text-slate-300 cursor-not-allowed' 
                              : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                          }`}
                          title={isLast ? 'อยู่ที่ตำแหน่งสุดท้ายแล้ว' : 'เลื่อนไปทางขวา/ถัดไป'}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditAssignment(asg)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                          title="แก้ไขข้อมูลใบงานนี้"
                        >
                          <Edit3 className="w-3 h-3 text-emerald-600" />
                          <span>แก้ไข</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteAssignment(asg)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                          title="ลบใบงานนี้"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>ลบ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <School className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium">ไม่พบรายชื่อนักเรียนในห้องเรียนนี้</p>
            <p className="text-xs text-slate-400 mt-1">สามารถเพิ่มนักเรียนหรือนำเข้าไฟล์ Excel ได้ที่แท็บ &quot;ทะเบียนรายชื่อนักเรียน&quot;</p>
          </div>
        )}

      </div>

      {/* Modal: Add Assignment / Score Column */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                เพิ่มช่องคะแนน / ชิ้นงาน (ภาคเรียนที่ {activeSemesterTab})
              </h3>
              <button
                onClick={() => setShowAddAssignmentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ประเภทของงาน / การให้คะแนน <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'worksheet', label: 'ใบงาน' },
                    { key: 'exercise', label: 'แบบฝึกหัด' },
                    { key: 'project', label: 'โครงงาน' },
                    { key: 'report', label: 'รายงาน' },
                    { key: 'homework_book', label: 'สมุดการบ้าน' },
                    { key: 'test', label: 'แบบทดสอบ' },
                    { key: 'custom', label: 'กำหนดเอง (กรอกได้เอง)' },
                  ].map((item) => {
                    const isSelected = newAsgCategory === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setNewAsgCategory(item.key as AssignmentCategory);
                          if (!newAsgName) {
                            if (item.key === 'worksheet') setNewAsgName('ใบงานที่ 1');
                            else if (item.key === 'exercise') setNewAsgName('แบบฝึกหัดที่ 1');
                            else if (item.key === 'project') setNewAsgName('โครงงาน');
                            else if (item.key === 'report') setNewAsgName('รายงาน');
                            else if (item.key === 'homework_book') setNewAsgName('สมุดการบ้าน');
                            else if (item.key === 'test') setNewAsgName('แบบทดสอบเก็บคะแนน');
                          }
                        }}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อรายการ / หัวข้อชิ้นงาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ใบงานที่ 1 การคิดเชิงคำนวณ, สมุดการบ้านสัปดาห์ที่ 2, สอบท้ายบท"
                  value={newAsgName}
                  onChange={(e) => setNewAsgName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Max Score Input (กรอกได้เอง) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คะแนนเต็มของช่องนี้ (กรอกคะแนนเต็มได้เอง) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    required
                    value={newAsgMaxScore}
                    onChange={(e) => setNewAsgMaxScore(Math.max(1, Number(e.target.value)))}
                    className="w-32 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 text-center"
                  />
                  <span className="text-xs text-slate-500">คะแนน</span>

                  {/* Preset quick pills */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {[10, 15, 20, 25, 30, 40, 50].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setNewAsgMaxScore(score)}
                        className={`px-2 py-1 text-[11px] rounded-md border cursor-pointer ${
                          newAsgMaxScore === score
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คำอธิบายเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น สาระการเรียนรู้ที่ 1, กิจกรรมกลุ่ม"
                  value={newAsgDescription}
                  onChange={(e) => setNewAsgDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Formula explanation box */}
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Calculator className="w-3.5 h-3.5" />
                  สูตรการคำนวณคะแนนรวมและตัดเกรดอัตโนมัติ:
                </div>
                <p>
                  ระบบจะนำคะแนนดิบรวมของทุกช่องในเทอม หารด้วย คะแนนเต็มรวมทั้งหมด แล้วคูณด้วย 100:
                </p>
                <p className="font-mono bg-white/70 p-1.5 rounded border border-emerald-200 text-emerald-950 font-semibold text-center my-1">
                  คะแนนเต็ม 100 = (คะแนนรวมที่ได้ ÷ คะแนนเต็มรวม) × 100
                </p>
                <p className="text-[10px] text-emerald-700">
                  เช่น คะแนนเต็มรวม 150 คะแนน นักเรียนได้ 120 คะแนน &rarr; (120 ÷ 150) × 100 = <strong>80 คะแนน (เกรด 4)</strong>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssignmentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกช่องคะแนน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Assignment / Score Column */}
      {assignmentToEdit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                แก้ไขข้อมูลช่องคะแนน (ภาคเรียนที่ {assignmentToEdit.semester})
              </h3>
              <button
                onClick={() => setAssignmentToEdit(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignment} className="space-y-4">
              
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ประเภทของงาน / การให้คะแนน <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'worksheet', label: 'ใบงาน' },
                    { key: 'exercise', label: 'แบบฝึกหัด' },
                    { key: 'project', label: 'โครงงาน' },
                    { key: 'report', label: 'รายงาน' },
                    { key: 'homework_book', label: 'สมุดการบ้าน' },
                    { key: 'test', label: 'แบบทดสอบ' },
                    { key: 'custom', label: 'กำหนดเอง (กรอกได้เอง)' },
                  ].map((item) => {
                    const isSelected = editAsgCategory === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setEditAsgCategory(item.key as AssignmentCategory)}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อรายการ / หัวข้อชิ้นงาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ใบงานที่ 1 การคิดเชิงคำนวณ"
                  value={editAsgName}
                  onChange={(e) => setEditAsgName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Max Score Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คะแนนเต็มของช่องนี้ (กรอกคะแนนเต็มได้เอง) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    required
                    value={editAsgMaxScore}
                    onChange={(e) => setEditAsgMaxScore(Math.max(1, Number(e.target.value)))}
                    className="w-32 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 text-center"
                  />
                  <span className="text-xs text-slate-500">คะแนน</span>

                  {/* Preset quick pills */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {[10, 15, 20, 25, 30, 40, 50].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setEditAsgMaxScore(score)}
                        className={`px-2 py-1 text-[11px] rounded-md border cursor-pointer ${
                          editAsgMaxScore === score
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คำอธิบายเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น สาระการเรียนรู้ที่ 1, กิจกรรมกลุ่ม"
                  value={editAsgDescription}
                  onChange={(e) => setEditAsgDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignmentToEdit(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reorder Assignments */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                สลับตำแหน่งและจัดลำดับช่องคะแนน (ภาคเรียนที่ {activeSemesterTab})
              </h3>
              <button
                onClick={() => setShowReorderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              คลิกปุ่มลูกศรขึ้น ⬆️ หรือ ลง ⬇️ เพื่อเลื่อนตำแหน่งช่องคะแนน ลำดับในตารางบันทึกคะแนนจะเปลี่ยนตามทันที
            </p>

            {/* List of current semester assignments */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {currentSemesterAssignments.map((asg, index) => {
                const catInfo = getCategoryInfo(asg.category);
                const isFirst = index === 0;
                const isLast = index === currentSemesterAssignments.length - 1;

                return (
                  <div
                    key={asg.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                  >
                    {/* Index & Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${catInfo.bgClass} ${catInfo.textClass} ${catInfo.borderClass}`}>
                            {catInfo.label}
                          </span>
                          <span className="font-bold text-xs text-slate-800 truncate" title={asg.name}>
                            {asg.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                          คะแนนเต็ม: {asg.maxScore} คะแนน
                        </span>
                      </div>
                    </div>

                    {/* Actions: Up, Down, Edit, Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveAssignment(asg.id, 'up')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isFirst
                            ? 'text-slate-300 border-slate-200 bg-slate-100 cursor-not-allowed'
                            : 'text-slate-700 border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer shadow-2xs'
                        }`}
                        title="เลื่อนขึ้น"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveAssignment(asg.id, 'down')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isLast
                            ? 'text-slate-300 border-slate-200 bg-slate-100 cursor-not-allowed'
                            : 'text-slate-700 border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer shadow-2xs'
                        }`}
                        title="เลื่อนลง"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>

                      {/* Quick Edit */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowReorderModal(false);
                          handleOpenEditAssignment(asg);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 transition-colors cursor-pointer shadow-2xs ml-1"
                        title="แก้ไขข้อมูลช่องคะแนนนี้"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Quick Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowReorderModal(false);
                          handleRequestDeleteAssignment(asg);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                        title="ลบช่องคะแนนนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-3">
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirm Delete Assignment Modal */}
      {assignmentToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(assignmentToDelete)}
          title="ยืนยันการลบช่องคะแนน"
          itemTitle={assignmentToDelete.name}
          itemSubtitle={`ภาคเรียนที่ ${assignmentToDelete.semester} | ประเภท: ${getCategoryInfo(assignmentToDelete.category).label} | คะแนนเต็ม: ${assignmentToDelete.maxScore} คะแนน`}
          warningMessage="คะแนนที่เคยกรอกไว้ในช่องนี้ของนักเรียนทุกคนจะถูกลบออก และระบบจะคำนวณคะแนนรวมเต็ม 100 และตัดเกรด 8 ระดับ (0 - 4) ใหม่โดยอัตโนมัติ"
          confirmLabel="ยืนยันการลบช่องคะแนน"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDeleteAssignment}
          onClose={() => setAssignmentToDelete(null)}
        />
      )}

    </div>
  );
};
