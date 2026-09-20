import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  UserCheck, 
  Users, 
  BookOpen, 
  History, 
  Calendar, 
  Save, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Layers, 
  Copy, 
  ExternalLink,
  Trash2,
  Filter,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { storage } from '../services/storage';
import { Student, Subject, StudentSubjectScore, PromotionRecord, User } from '../types';
import { StudentTranscriptModal } from './StudentTranscriptModal';

interface StudentPromotionProps {
  currentUser: User;
  onNavigateToTab?: (tab: any) => void;
  onPromotionCompleted?: (newAcademicYear: string) => void;
  initialAcademicYear?: string;
}

interface StudentPromotionItemState {
  studentId: string;
  selected: boolean;
  action: 'promote' | 'repeat' | 'graduated' | 'transferred';
  targetGradeLevel: string;
  targetClassKey: string;
  targetStudentNumber: number;
  gpa: number;
  passedAll: boolean;
  passedCount: number;
  failedCount: number;
  totalSubjects: number;
}

export const StudentPromotion: React.FC<StudentPromotionProps> = ({
  currentUser,
  onNavigateToTab,
  onPromotionCompleted,
  initialAcademicYear,
}) => {
  const schoolSettings = storage.getSchoolSettings();
  const availableYears = storage.getAvailableAcademicYears();

  // Active View Tab: 'promotion' or 'history'
  const [activeTab, setActiveTab] = useState<'promotion' | 'history'>('promotion');

  // Year Selection
  const [fromYear, setFromYear] = useState<string>(initialAcademicYear || schoolSettings.academicYear || '2568');
  const [toYear, setToYear] = useState<string>(() => {
    const fromNum = parseInt(initialAcademicYear || schoolSettings.academicYear || '2568', 10);
    return !isNaN(fromNum) ? (fromNum + 1).toString() : '2569';
  });

  // Grade & Class Selection
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClassKey, setSelectedClassKey] = useState<string>('all');

  // Options
  const [setAsCurrentYear, setSetAsCurrentYear] = useState<boolean>(true);
  const [copySubjects, setCopySubjects] = useState<boolean>(true);
  const [promotionNote, setPromotionNote] = useState<string>('');

  // Loaded Data
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<StudentSubjectScore[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);

  // Item states mapping
  const [promotionMap, setPromotionMap] = useState<Record<string, StudentPromotionItemState>>({});

  // Execution & Modals
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultModal, setResultModal] = useState<{
    isOpen: boolean;
    record?: PromotionRecord;
    message: string;
  }>({
    isOpen: false,
    message: '',
  });

  // Transcript Preview Modal
  const [transcriptStudentId, setTranscriptStudentId] = useState<string | null>(null);

  // History detail drawer
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<PromotionRecord | null>(null);

  // Load data when fromYear changes
  const loadData = () => {
    const stds = storage.getStudentsForAcademicYear(fromYear);
    const scrs = storage.getScores().filter((s) => s.academicYear === fromYear);
    const subs = storage.getSubjects().filter((s) => !s.academicYear || s.academicYear === fromYear);
    const hist = storage.getPromotionHistory();

    setStudents(stds);
    setScores(scrs);
    setSubjects(subs);
    setPromotionHistory(hist);
  };

  useEffect(() => {
    loadData();
  }, [fromYear]);

  // Update toYear when fromYear changes
  useEffect(() => {
    const num = parseInt(fromYear, 10);
    if (!isNaN(num)) {
      setToYear((num + 1).toString());
    }
  }, [fromYear]);

  // Available distinct grades & classes for source year
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.gradeLevel) set.add(s.gradeLevel);
    });
    return Array.from(set).sort();
  }, [students]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (selectedGrade === 'all' || s.gradeLevel === selectedGrade) {
        if (s.classKey) set.add(s.classKey);
      }
    });
    return Array.from(set).sort();
  }, [students, selectedGrade]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status === 'graduated' || s.status === 'transferred') return false;
      if (selectedGrade !== 'all' && s.gradeLevel !== selectedGrade) return false;
      if (selectedClassKey !== 'all' && s.classKey !== selectedClassKey) return false;
      return true;
    });
  }, [students, selectedGrade, selectedClassKey]);

  // Suggest next grade level (รองรับระดับอนุบาล ประถม มัธยมต้น และมัธยมปลาย)
  const getSuggestedNextGrade = (grade: string): { nextGrade: string; isGraduation: boolean } => {
    const g = grade.trim();
    if (g === 'อ.1') return { nextGrade: 'อ.2', isGraduation: false };
    if (g === 'อ.2') return { nextGrade: 'อ.3', isGraduation: false };
    if (g === 'อ.3') return { nextGrade: 'ป.1', isGraduation: false };
    if (g === 'ป.1') return { nextGrade: 'ป.2', isGraduation: false };
    if (g === 'ป.2') return { nextGrade: 'ป.3', isGraduation: false };
    if (g === 'ป.3') return { nextGrade: 'ป.4', isGraduation: false };
    if (g === 'ป.4') return { nextGrade: 'ป.5', isGraduation: false };
    if (g === 'ป.5') return { nextGrade: 'ป.6', isGraduation: false };
    if (g === 'ป.6') return { nextGrade: 'ม.1', isGraduation: false };
    if (g === 'ม.1') return { nextGrade: 'ม.2', isGraduation: false };
    if (g === 'ม.2') return { nextGrade: 'ม.3', isGraduation: false };
    if (g === 'ม.3') return { nextGrade: 'ม.4', isGraduation: false };
    if (g === 'ม.4') return { nextGrade: 'ม.5', isGraduation: false };
    if (g === 'ม.5') return { nextGrade: 'ม.6', isGraduation: false };
    if (g === 'ม.6') return { nextGrade: 'สำเร็จการศึกษา', isGraduation: true };
    return { nextGrade: grade, isGraduation: false };
  };

  // Build target class key (e.g. ป.1/1 -> ป.2/1, ม.6/1 -> จบการศึกษา)
  const getSuggestedTargetClassKey = (currentClassKey: string, nextGrade: string, isGraduation: boolean) => {
    if (isGraduation || nextGrade === 'สำเร็จการศึกษา' || currentClassKey.startsWith('ม.6')) {
      return 'จบการศึกษา';
    }
    const parts = currentClassKey.split('/');
    const roomNum = parts[1] || '1';
    return `${nextGrade}/${roomNum}`;
  };

  // Initialize or update promotion items map
  useEffect(() => {
    const newMap: Record<string, StudentPromotionItemState> = {};

    filteredStudents.forEach((student) => {
      // Find all scores for this student in fromYear
      const studentScores = scores.filter((sc) => sc.studentId === student.id);
      
      let totalGradePoints = 0;
      let totalCredits = 0;
      let passedCount = 0;
      let failedCount = 0;

      studentScores.forEach((sc) => {
        const sub = subjects.find((s) => s.id === sc.subjectId);
        const credits = sub?.credits || 1.0;
        const grade = sc.finalCombined?.finalGrade ?? 0;
        totalCredits += credits;
        totalGradePoints += (credits * grade);
        if (grade >= 1) {
          passedCount++;
        } else {
          failedCount++;
        }
      });

      const gpa = totalCredits > 0 ? parseFloat((totalGradePoints / totalCredits).toFixed(2)) : 0;
      const passedAll = failedCount === 0 && studentScores.length > 0;

      const { nextGrade, isGraduation } = getSuggestedNextGrade(student.gradeLevel);
      const isGraduationStudent = student.gradeLevel === 'ป.6';

      const defaultAction: 'promote' | 'repeat' | 'graduated' | 'transferred' = 
        isGraduationStudent ? 'graduated' : 'promote';

      const targetClass = getSuggestedTargetClassKey(student.classKey, nextGrade, defaultAction === 'graduated');

      newMap[student.id] = {
        studentId: student.id,
        selected: true,
        action: defaultAction,
        targetGradeLevel: defaultAction === 'graduated' ? student.gradeLevel : nextGrade,
        targetClassKey: targetClass,
        targetStudentNumber: student.studentNumber,
        gpa,
        passedAll,
        passedCount,
        failedCount,
        totalSubjects: studentScores.length,
      };
    });

    setPromotionMap(newMap);
  }, [filteredStudents, scores, subjects]);

  // Action helpers
  const handleToggleSelectAll = (checked: boolean) => {
    setPromotionMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((s) => {
        if (updated[s.id]) {
          updated[s.id].selected = checked;
        }
      });
      return updated;
    });
  };

  const handleSelectOnlyPassed = () => {
    setPromotionMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((s) => {
        if (updated[s.id]) {
          updated[s.id].selected = updated[s.id].passedAll;
        }
      });
      return updated;
    });
  };

  const handleBatchSetAction = (action: 'promote' | 'repeat' | 'graduated' | 'transferred') => {
    setPromotionMap((prev) => {
      const updated = { ...prev };
      filteredStudents.forEach((s) => {
        if (updated[s.id] && updated[s.id].selected) {
          updated[s.id].action = action;
          if (action === 'repeat') {
            updated[s.id].targetGradeLevel = s.gradeLevel;
            updated[s.id].targetClassKey = s.classKey;
          } else if (action === 'graduated') {
            updated[s.id].targetClassKey = 'สำเร็จการศึกษา';
          }
        }
      });
      return updated;
    });
  };

  const handleItemChange = (studentId: string, updates: Partial<StudentPromotionItemState>) => {
    setPromotionMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...updates,
      },
    }));
  };

  // Counts of selected students
  const selectedCount = useMemo(() => {
    return filteredStudents.filter((s) => promotionMap[s.id]?.selected).length;
  }, [filteredStudents, promotionMap]);

  const selectedBreakdown = useMemo(() => {
    let promote = 0;
    let repeat = 0;
    let graduated = 0;
    let transferred = 0;

    filteredStudents.forEach((s) => {
      const item = promotionMap[s.id];
      if (item?.selected) {
        if (item.action === 'promote') promote++;
        else if (item.action === 'repeat') repeat++;
        else if (item.action === 'graduated') graduated++;
        else if (item.action === 'transferred') transferred++;
      }
    });

    return { promote, repeat, graduated, transferred };
  }, [filteredStudents, promotionMap]);

  // Execute Promotion
  const handleExecutePromotion = async () => {
    if (selectedCount === 0) {
      alert('กรุณาเลือกนักเรียนอย่างน้อย 1 คนเพื่อดำเนินการเลื่อนชั้น');
      return;
    }

    if (!toYear.trim()) {
      alert('กรุณาระบุปีการศึกษาใหม่');
      return;
    }

    if (fromYear === toYear) {
      const confirmed = window.confirm(
        `ปีการศึกษาเดิม (${fromYear}) และปีการศึกษาใหม่ (${toYear}) เป็นปีเดียวกัน คุณแน่ใจหรือไม่ว่าต้องการดำเนินการ?`
      );
      if (!confirmed) return;
    }

    const confirmMsg = `ยืนยันการดำเนินการเลื่อนชั้นเรียน:\n` +
      `- จากปีการศึกษา ${fromYear} ไปยังปีการศึกษา ${toYear}\n` +
      `- จำนวนนักเรียนทั้งหมดที่เลือก: ${selectedCount} คน\n` +
      `  • เลื่อนชั้น: ${selectedBreakdown.promote} คน\n` +
      `  • ซ้ำชั้น: ${selectedBreakdown.repeat} คน\n` +
      `  • สำเร็จการศึกษา: ${selectedBreakdown.graduated} คน\n` +
      `  • จำหน่าย/ย้าย: ${selectedBreakdown.transferred} คน\n\n` +
      `ข้อมูลคะแนนและประวัติของปี ${fromYear} จะถูกเก็บรักษาไว้อย่างสมบูรณ์ คุณต้องการเริ่มดำเนินการหรือไม่?`;

    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);

    try {
      const studentsToProcess = filteredStudents
        .filter((s) => promotionMap[s.id]?.selected)
        .map((s) => {
          const item = promotionMap[s.id];
          return {
            studentId: s.id,
            studentCode: s.studentCode,
            name: `${s.prefix}${s.firstName} ${s.lastName}`,
            action: item.action,
            targetGradeLevel: item.targetGradeLevel,
            targetClassKey: item.targetClassKey,
            targetStudentNumber: item.targetStudentNumber,
            gpa: item.gpa,
            passedAll: item.passedAll,
          };
        });

      const res = await storage.executeStudentPromotion({
        fromAcademicYear: fromYear,
        toAcademicYear: toYear,
        sourceGradeLevel: selectedGrade !== 'all' ? selectedGrade : undefined,
        sourceClassKey: selectedClassKey !== 'all' ? selectedClassKey : undefined,
        students: studentsToProcess,
        copySubjectsToNewYear: copySubjects,
        setAsCurrentAcademicYear: setAsCurrentYear,
        executedBy: currentUser.name || 'ครูผู้สอน',
        note: promotionNote,
      });

      setResultModal({
        isOpen: true,
        record: res.record,
        message: res.message,
      });

      // Reload local data
      loadData();

      if (onPromotionCompleted) {
        onPromotionCompleted(toYear);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเลื่อนชั้นเรียน: ' + (err.message || 'โปรดลองอีกครั้ง'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistoryRecord = (recordId: string) => {
    if (window.confirm('คุณต้องการลบประวัติการบันทึกนี้ใช่หรือไม่? (การลบประวัติจะไม่ย้อนคืนสถานะนักเรียน)')) {
      storage.deletePromotionRecord(recordId);
      setPromotionHistory(storage.getPromotionHistory());
      if (selectedHistoryRecord?.id === recordId) {
        setSelectedHistoryRecord(null);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Top Banner / Breadcrumb */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-inner">
              <GraduationCap className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">ระบบเลื่อนชั้นเรียน (Student Grade Promotion)</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-200 border border-purple-300/30">
                  ประจำปีการศึกษา
                </span>
              </div>
              <p className="text-xs text-purple-200/90 mt-0.5">
                จัดเลื่อนระดับชั้นนักเรียนเข้าสู่ปีการศึกษาใหม่ พร้อมเก็บบันทึกประวัติและคะแนนปีก่อนหน้าไว้ให้ครูย้อนกลับมาดูได้ตลอดเวลา
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center bg-black/20 backdrop-blur-xs p-1 rounded-xl border border-white/15 text-xs font-semibold self-start md:self-auto">
            <button
              onClick={() => setActiveTab('promotion')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'promotion'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>ดำเนินการเลื่อนชั้น</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>ประวัติการเลื่อนชั้น ({promotionHistory.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: PROMOTION WORKFLOW */}
      {activeTab === 'promotion' && (
        <>
          {/* Settings Control Card: From Year -> To Year & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                <h3 className="text-sm font-bold text-slate-800">
                  กำหนดช่วงปีการศึกษาและกลุ่มนักเรียนเป้าหมาย
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                พบนักเรียนในระบบ: <strong className="text-purple-700">{filteredStudents.length}</strong> คน
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Source Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ปีการศึกษาต้นทาง (เดิม)
                </label>
                <div className="relative">
                  <select
                    value={fromYear}
                    onChange={(e) => setFromYear(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        ปีการศึกษา {yr} {yr === schoolSettings.academicYear ? '(ปีปัจจุบัน)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Year */}
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1.5 flex items-center justify-between">
                  <span>ปีการศึกษาใหม่ (ปลายทาง)</span>
                  <span className="text-[10px] text-purple-600 font-medium">+1 ปีอัตโนมัติ</span>
                </label>
                <input
                  type="text"
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  placeholder="เช่น 2569"
                  className="w-full bg-purple-50/50 border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Grade Level Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกระดับชั้น
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setSelectedClassKey('all');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                >
                  <option value="all">ทุกระดับชั้น ({availableGrades.join(', ') || 'ไม่มี'})</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>
                      ระดับชั้น {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Classroom Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกห้องเรียน
                </label>
                <select
                  value={selectedClassKey}
                  onChange={(e) => setSelectedClassKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                >
                  <option value="all">ทุกห้องเรียน</option>
                  {availableClasses.map((ck) => (
                    <option key={ck} value={ck}>
                      ห้อง {ck}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Options Checkboxes */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-5 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={setAsCurrentYear}
                  onChange={(e) => setSetAsCurrentYear(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <span>ตั้งค่าปีการศึกษาใหม่ (<strong>{toYear}</strong>) ให้เป็นปีปัจจุบันของสถานศึกษา</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={copySubjects}
                  onChange={(e) => setCopySubjects(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <span>คัดลอกรายวิชาพื้นฐานของปีเดิมไปยังปีการศึกษาใหม่ ({toYear}) โดยอัตโนมัติ</span>
              </label>
            </div>

          </div>

          {/* Action Toolbar & Bulk Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            
            {/* Quick Selection Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleToggleSelectAll(true)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>เลือกทั้งหมด ({filteredStudents.length})</span>
              </button>

              <button
                onClick={() => handleToggleSelectAll(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>ยกเลิกเลือก</span>
              </button>

              <button
                onClick={handleSelectOnlyPassed}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>เลือกเฉพาะผู้ผ่านเกณฑ์</span>
              </button>

              <div className="h-4 w-[1px] bg-slate-300 mx-1 hidden sm:block" />

              <span className="text-xs font-medium text-slate-500">
                เปลี่ยนสถานะกลุ่มที่เลือก:
              </span>
              <button
                onClick={() => handleBatchSetAction('promote')}
                className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              >
                เลื่อนชั้นทั้งหมด
              </button>
              <button
                onClick={() => handleBatchSetAction('repeat')}
                className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
              >
                ซ้ำชั้น
              </button>
              <button
                onClick={() => handleBatchSetAction('graduated')}
                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                จบการศึกษา
              </button>
            </div>

            {/* Execute Button */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-xs text-slate-500 font-medium">เลือกแล้ว</span>
                <span className="text-sm font-bold text-purple-700 ml-1.5">{selectedCount} คน</span>
              </div>
              <button
                onClick={handleExecutePromotion}
                disabled={isProcessing || selectedCount === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all cursor-pointer ${
                  selectedCount > 0 && !isProcessing
                    ? 'bg-purple-700 hover:bg-purple-800 hover:shadow-md active:scale-98'
                    : 'bg-slate-400 cursor-not-allowed opacity-70'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isProcessing ? 'กำลังดำเนินการ...' : `ยืนยันการเลื่อนชั้น (${selectedCount} คน)`}</span>
              </button>
            </div>

          </div>

          {/* Students Evaluation & Promotion Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredStudents.length > 0 && selectedCount === filteredStudents.length}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 w-12 text-center">เลขที่</th>
                    <th className="py-3 px-3 w-20">รหัสนักเรียน</th>
                    <th className="py-3 px-3 min-w-[160px]">ชื่อ-นามสกุล</th>
                    <th className="py-3 px-3 w-24 text-center">ชั้นเดิม ({fromYear})</th>
                    <th className="py-3 px-3 w-24 text-center">GPA (ปีก่อน)</th>
                    <th className="py-3 px-3 w-28 text-center">ผลประเมิน</th>
                    <th className="py-3 px-3 w-36">การตัดสินใจ</th>
                    <th className="py-3 px-3 w-32">ชั้น/ห้องปลายทาง</th>
                    <th className="py-3 px-3 w-16 text-center">เลขที่ใหม่</th>
                    <th className="py-3 px-3 w-24 text-center">ประวัติคะแนน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600">ไม่พบรายชื่อนักเรียนสำหรับเงื่อนไขที่เลือก</p>
                        <p className="text-xs text-slate-400 mt-1">โปรดเลือกปีการศึกษาหรือระดับชั้นอื่น</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const item = promotionMap[student.id] || {
                        selected: true,
                        action: 'promote',
                        targetGradeLevel: student.gradeLevel,
                        targetClassKey: student.classKey,
                        targetStudentNumber: student.studentNumber,
                        gpa: 0,
                        passedAll: true,
                        passedCount: 0,
                        failedCount: 0,
                        totalSubjects: 0,
                      };

                      return (
                        <tr 
                          key={student.id}
                          className={`transition-colors ${
                            item.selected ? 'bg-purple-50/20 hover:bg-purple-50/40' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => handleItemChange(student.id, { selected: e.target.checked })}
                              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>

                          {/* Student Number */}
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 font-semibold">
                            {student.studentNumber}
                          </td>

                          {/* Student Code */}
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {student.studentCode}
                          </td>

                          {/* Name */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">
                              {student.prefix}{student.firstName} {student.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              เพศ: {student.gender === 'M' ? 'ชาย' : 'หญิง'}
                            </div>
                          </td>

                          {/* Current Class */}
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {student.classKey}
                          </td>

                          {/* GPA in previous year */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                            {item.totalSubjects > 0 ? item.gpa.toFixed(2) : '-'}
                          </td>

                          {/* Evaluation Status Tag */}
                          <td className="py-2.5 px-3 text-center">
                            {item.totalSubjects === 0 ? (
                              <span className="text-[11px] text-slate-400">-</span>
                            ) : item.passedAll ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ผ่านเกณฑ์
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title={`ไม่ผ่าน ${item.failedCount} วิชา`}>
                                <AlertCircle className="w-3 h-3 text-amber-600" /> ติด 0/ร ({item.failedCount})
                              </span>
                            )}
                          </td>

                          {/* Action Selector */}
                          <td className="py-2.5 px-3">
                            <select
                              value={item.action}
                              onChange={(e) => {
                                const newAction = e.target.value as any;
                                let newTargetClass = item.targetClassKey;
                                let newTargetGrade = item.targetGradeLevel;

                                if (newAction === 'repeat') {
                                  newTargetClass = student.classKey;
                                  newTargetGrade = student.gradeLevel;
                                } else if (newAction === 'graduated') {
                                  newTargetClass = 'สำเร็จการศึกษา';
                                } else if (newAction === 'promote') {
                                  const { nextGrade, isGraduation } = getSuggestedNextGrade(student.gradeLevel);
                                  newTargetGrade = nextGrade;
                                  newTargetClass = getSuggestedTargetClassKey(student.classKey, nextGrade, isGraduation);
                                }

                                handleItemChange(student.id, {
                                  action: newAction,
                                  targetClassKey: newTargetClass,
                                  targetGradeLevel: newTargetGrade,
                                });
                              }}
                              className={`w-full py-1 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                                item.action === 'promote'
                                  ? 'bg-indigo-50/70 border-indigo-300 text-indigo-800'
                                  : item.action === 'repeat'
                                  ? 'bg-amber-50/70 border-amber-300 text-amber-800'
                                  : item.action === 'graduated'
                                  ? 'bg-blue-50/70 border-blue-300 text-blue-800'
                                  : 'bg-slate-100 border-slate-300 text-slate-700'
                              }`}
                            >
                              <option value="promote">เลื่อนชั้น (Promote)</option>
                              <option value="repeat">ซ้ำชั้น (Repeat)</option>
                              <option value="graduated">สำเร็จการศึกษา (Graduate)</option>
                              <option value="transferred">ย้ายสถานศึกษา (Transfer)</option>
                            </select>
                          </td>

                          {/* Target Classroom */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.targetClassKey}
                              disabled={item.action === 'graduated' || item.action === 'transferred'}
                              onChange={(e) => {
                                const val = e.target.value;
                                const grade = val.split('/')[0] || val;
                                handleItemChange(student.id, {
                                  targetClassKey: val,
                                  targetGradeLevel: grade,
                                });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </td>

                          {/* Target Student Number */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.targetStudentNumber}
                              disabled={item.action === 'graduated' || item.action === 'transferred'}
                              onChange={(e) => handleItemChange(student.id, { targetStudentNumber: parseInt(e.target.value, 10) || 1 })}
                              className="w-14 text-center bg-white border border-slate-300 rounded-lg py-1 text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </td>

                          {/* View Transcript Action */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setTranscriptStudentId(student.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md border border-purple-200 transition-colors cursor-pointer"
                              title="ดูประวัติผลการเรียนสะสมย้อนหลังทุกปี"
                            >
                              <Eye className="w-3 h-3" />
                              <span>ดูคะแนน</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom summary note */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p>
                * ข้อมูลปีเดิมจะถูกบันทึกลงในประวัติการศึกษา (Academic History) ของนักเรียนแต่ละคนอย่างถาวร สามารถเรียกดูคะแนนย้อนหลังได้ทุกเมื่อ
              </p>
              <span className="font-semibold text-slate-700">
                เตรียมบันทึกเข้าปีการศึกษา {toYear}
              </span>
            </div>

          </div>
        </>
      )}

      {/* VIEW 2: PROMOTION HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  บันทึกประวัติการเลื่อนชั้นเรียนที่ผ่านมา
                </h3>
                <p className="text-xs text-slate-500">
                  ตรวจสอบรายการเลื่อนชั้นเรียนที่เคยดำเนินการในระบบทั้งหมด
                </p>
              </div>
            </div>

            {promotionHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">ยังไม่มีประวัติการเลื่อนชั้นเรียนที่บันทึกไว้</p>
                <p className="text-xs text-slate-400 mt-1">เมื่อท่านดำเนินการเลื่อนชั้นเรียน รายการจะแสดงที่นี่โดยละเอียด</p>
              </div>
            ) : (
              <div className="space-y-3">
                {promotionHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-slate-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-white hover:shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-800">
                              ปีการศึกษา {rec.fromAcademicYear} <span className="text-purple-600">➔</span> ปีการศึกษา {rec.toAcademicYear}
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {rec.totalStudents} คน
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>วันที่: {new Date(rec.timestamp).toLocaleString('th-TH')}</span>
                            <span>&bull;</span>
                            <span>ผู้ดำเนินการ: <strong className="text-slate-700">{rec.executedBy}</strong></span>
                            {rec.sourceClassKey && (
                              <>
                                <span>&bull;</span>
                                <span>ห้องเรียน: <strong>{rec.sourceClassKey}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Counts & Actions */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            เลื่อนชั้น {rec.promotedCount}
                          </span>
                          {rec.repeatedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                              ซ้ำชั้น {rec.repeatedCount}
                            </span>
                          )}
                          {rec.graduatedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              จบการศึกษา {rec.graduatedCount}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedHistoryRecord(rec)}
                          className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg border border-purple-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายละเอียด</span>
                        </button>

                        <button
                          onClick={() => handleDeleteHistoryRecord(rec.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                          title="ลบบันทึกประวัตินี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {rec.note && (
                      <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        หมายเหตุ: {rec.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* DETAIL MODAL FOR A PROMOTION RECORD */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  รายละเอียดการเลื่อนชั้นเรียน: {selectedHistoryRecord.fromAcademicYear} ➔ {selectedHistoryRecord.toAcademicYear}
                </h3>
                <p className="text-xs text-slate-500">
                  ดำเนินการเมื่อ {new Date(selectedHistoryRecord.timestamp).toLocaleString('th-TH')} โดย {selectedHistoryRecord.executedBy}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-20">รหัส</th>
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3 text-center">ห้องเดิม</th>
                    <th className="py-2.5 px-3 text-center">การดำเนินการ</th>
                    <th className="py-2.5 px-3 text-center">ห้องใหม่</th>
                    <th className="py-2.5 px-3 text-center">เลขที่ใหม่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedHistoryRecord.studentsDetail?.map((item, idx) => (
                    <tr key={item.studentId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{item.studentCode}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{item.fromClassKey}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          item.action === 'promote'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.action === 'repeat'
                            ? 'bg-amber-50 text-amber-700'
                            : item.action === 'graduated'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.action === 'promote' ? 'เลื่อนชั้น' : item.action === 'repeat' ? 'ซ้ำชั้น' : item.action === 'graduated' ? 'จบการศึกษา' : 'ย้ายสถานศึกษา'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-purple-700">{item.toClassKey}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">{item.toStudentNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedHistoryRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT CONFIRMATION MODAL */}
      {resultModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center space-y-4 animate-scaleUp">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900">
              ดำเนินการเลื่อนชั้นเรียนสำเร็จ!
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {resultModal.message}
            </p>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 text-left space-y-1 font-medium">
              <div className="flex justify-between">
                <span>ปีการศึกษาใหม่:</span>
                <strong className="text-purple-800">{toYear}</strong>
              </div>
              <div className="flex justify-between">
                <span>บันทึกคะแนนปีเดิม ({fromYear}):</span>
                <span className="text-emerald-700">เก็บบันทึกประวัติสมบูรณ์</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setResultModal({ isOpen: false, message: '' });
                  if (onNavigateToTab) {
                    onNavigateToTab('students');
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                ไปที่ทะเบียนนักเรียนปี {toYear}
              </button>
              <button
                onClick={() => setResultModal({ isOpen: false, message: '' })}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT TRANSCRIPT MODAL */}
      <StudentTranscriptModal
        isOpen={Boolean(transcriptStudentId)}
        studentId={transcriptStudentId || undefined}
        onClose={() => setTranscriptStudentId(null)}
      />

    </div>
  );
};
