import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sliders, 
  BookOpen, 
  Award, 
  ClipboardCheck, 
  GraduationCap, 
  Save, 
  RotateCcw, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  PieChart, 
  FileText, 
  ArrowRight,
  Info,
  Check,
  Percent,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { 
  Subject, 
  SubjectGradingRatio, 
  Assignment, 
  Exam, 
  User 
} from '../types';
import { storage } from '../services/storage';
import { getSubjectRatio, ResolvedSubjectRatio } from '../utils/grading';

interface ScoreRatioManagementProps {
  currentUser: User;
  subjects: Subject[];
  assignments: Assignment[];
  onUpdateSubjects: (updatedSubjects: Subject[]) => void;
  onNavigateToGrading?: (subjectId: string, classKey?: string) => void;
  onNavigateToExams?: (subjectId: string, classKey?: string) => void;
  onNavigateToCutGrade?: (subjectId: string, classKey?: string) => void;
  initialSubjectId?: string;
}

interface RatioPresetOption {
  id: '70:30' | '80:20' | '60:40' | '50:50';
  name: string;
  badge: string;
  coursework: number; // 1. คะแนนเก็บใบงาน/ภาระงาน
  exam: number;       // 2. คะแนนสอบ (เมื่อแบ่งคะแนนเก็บจากใบงานแล้ว ที่เหลือคือคะแนนสอบ)
  midterm: number;    // คะแนนสอบกลางภาค (ย่อย)
  final: number;      // คะแนนสอบปลายภาค (ย่อย)
  description: string;
}

const PRESET_OPTIONS: RatioPresetOption[] = [
  {
    id: '70:30',
    name: '70 : 30 (มาตรฐาน กพฐ.)',
    badge: 'นิยมสูงสุด',
    coursework: 70,
    exam: 30,
    midterm: 10,
    final: 20,
    description: '1. คะแนนเก็บใบงาน/ภาระงาน 70 คะแนน : 2. คะแนนสอบ 30 คะแนน',
  },
  {
    id: '80:20',
    name: '80 : 20 (เน้นภาระงาน/ปฏิบัติ)',
    badge: 'วิชาปฏิบัติการ',
    coursework: 80,
    exam: 20,
    midterm: 10,
    final: 10,
    description: '1. คะแนนเก็บใบงาน/ภาระงาน 80 คะแนน : 2. คะแนนสอบ 20 คะแนน',
  },
  {
    id: '60:40',
    name: '60 : 40 (เน้นการทดสอบ)',
    badge: 'วิชาทฤษฎี',
    coursework: 60,
    exam: 40,
    midterm: 20,
    final: 20,
    description: '1. คะแนนเก็บใบงาน/ภาระงาน 60 คะแนน : 2. คะแนนสอบ 40 คะแนน',
  },
  {
    id: '50:50',
    name: '50 : 50 (สัดส่วนเท่ากัน)',
    badge: 'สัดส่วนเท่า',
    coursework: 50,
    exam: 50,
    midterm: 25,
    final: 25,
    description: '1. คะแนนเก็บใบงาน/ภาระงาน 50 คะแนน : 2. คะแนนสอบ 50 คะแนน',
  },
];

export const ScoreRatioManagement: React.FC<ScoreRatioManagementProps> = ({
  currentUser,
  subjects,
  assignments,
  onUpdateSubjects,
  onNavigateToGrading,
  onNavigateToExams,
  onNavigateToCutGrade,
  initialSubjectId,
}) => {
  // Filter subjects accessible to current user
  const accessibleSubjects = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'executive') return subjects;
    const mySubjects = subjects.filter((s) => s.teacherId === currentUser.id || s.teacherName === currentUser.name);
    return mySubjects.length > 0 ? mySubjects : subjects;
  }, [subjects, currentUser]);

  // Selected Subject ID
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && accessibleSubjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return accessibleSubjects.length > 0 ? accessibleSubjects[0].id : '';
  });

  useEffect(() => {
    if (initialSubjectId && accessibleSubjects.some((s) => s.id === initialSubjectId)) {
      setSelectedSubjectId(initialSubjectId);
    } else if (accessibleSubjects.length > 0 && !accessibleSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(accessibleSubjects[0].id);
    }
  }, [initialSubjectId, accessibleSubjects]);

  const selectedSubject = useMemo(() => {
    return accessibleSubjects.find((s) => s.id === selectedSubjectId) || accessibleSubjects[0];
  }, [accessibleSubjects, selectedSubjectId]);

  // Active Semester: 1 or 2
  const [activeSemester, setActiveSemester] = useState<1 | 2>(1);

  // Form State for current subject & semester: Divided into 2 Parts
  // ส่วนที่ 1: คะแนนเก็บใบงาน/ภาระงาน
  const [courseworkWeight, setCourseworkWeight] = useState<number>(70);
  // ส่วนที่ 2: คะแนนสอบ (เมื่อแบ่งคะแนนเก็บจากใบงานแล้ว ที่เหลือคือคะแนนสอบ = 100 - courseworkWeight)
  const [examWeight, setExamWeight] = useState<number>(30);
  // การจำแนกคะแนนสอบย่อย (กลางภาค + ปลายภาค = examWeight)
  const [midtermWeight, setMidtermWeight] = useState<number>(10);
  const [finalExamWeight, setFinalExamWeight] = useState<number>(20);
  const [enableExamBreakdown, setEnableExamBreakdown] = useState<boolean>(true);
  const [ratioNote, setRatioNote] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('70:30');
  const [showApplyAllModal, setShowApplyAllModal] = useState<boolean>(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync state whenever selectedSubject or activeSemester changes
  useEffect(() => {
    if (!selectedSubject) return;
    const resolved = getSubjectRatio(selectedSubject, activeSemester);
    setCourseworkWeight(resolved.courseworkWeight);
    setExamWeight(resolved.examWeight);
    setMidtermWeight(resolved.midtermWeight);
    setFinalExamWeight(resolved.finalExamWeight);

    const ratioData = activeSemester === 2 ? selectedSubject.ratioSemester2 : selectedSubject.ratioSemester1;
    setRatioNote(ratioData?.description || '');
    setActivePreset(resolved.presetName || '70:30');
  }, [selectedSubject, activeSemester]);

  // Calculations: 2 Parts sum to 100
  const totalWeight = useMemo(() => {
    return (Number(courseworkWeight) || 0) + (Number(examWeight) || 0);
  }, [courseworkWeight, examWeight]);

  const isComplete100 = totalWeight === 100;

  // Assignments in selected subject and semester
  const subjectAssignments = useMemo(() => {
    if (!selectedSubject) return [];
    return assignments.filter(
      (a) => a.subjectId === selectedSubject.id && (a.semester === activeSemester || Number(a.semester) === activeSemester)
    );
  }, [assignments, selectedSubject, activeSemester]);

  const rawAssignmentTotalMax = useMemo(() => {
    return subjectAssignments.reduce((sum, a) => sum + a.maxScore, 0);
  }, [subjectAssignments]);

  // Exams in selected subject and semester
  const [allExams, setAllExams] = useState<Exam[]>(() => storage.getExams());
  useEffect(() => {
    setAllExams(storage.getExams());
  }, [selectedSubjectId, activeSemester]);

  const subjectExams = useMemo(() => {
    if (!selectedSubject) return [];
    return allExams.filter(
      (e) => e.subjectId === selectedSubject.id && (e.semester === activeSemester || Number(e.semester) === activeSemester)
    );
  }, [allExams, selectedSubject, activeSemester]);

  const midtermExam = useMemo(() => {
    return subjectExams.find((e) => e.examType === 'midterm' || e.title.includes('กลางภาค') || e.title.toLowerCase().includes('midterm'));
  }, [subjectExams]);

  const finalExam = useMemo(() => {
    return subjectExams.find((e) => e.examType === 'final' || e.title.includes('ปลายภาค') || e.title.toLowerCase().includes('final'));
  }, [subjectExams]);

  // Handle Preset Selection
  const applyPreset = (preset: RatioPresetOption) => {
    setCourseworkWeight(preset.coursework);
    setExamWeight(preset.exam);
    setMidtermWeight(preset.midterm);
    setFinalExamWeight(preset.final);
    setActivePreset(preset.id);
    showToast(`เลือกสัดส่วน 2 ส่วน: ${preset.name} (ใบงาน ${preset.coursework} : สอบ ${preset.exam}) เรียบร้อย`, 'info');
  };

  // เปลี่ยนแปลงคะแนนเก็บใบงาน/ภาระงาน -> ที่เหลือคือคะแนนสอบโดยอัตโนมัติ (100 - coursework)
  const handleCourseworkChange = (val: number) => {
    const cw = Math.max(0, Math.min(100, val));
    setCourseworkWeight(cw);
    const remaining = Math.max(0, 100 - cw);
    setExamWeight(remaining);

    // ซิงก์คะแนนสอบกลางภาคและปลายภาคให้เท่ากับคะแนนสอบที่เหลือ
    if (remaining === 30) {
      setMidtermWeight(10);
      setFinalExamWeight(20);
    } else if (remaining === 20) {
      setMidtermWeight(10);
      setFinalExamWeight(10);
    } else if (remaining === 40) {
      setMidtermWeight(20);
      setFinalExamWeight(20);
    } else {
      const half = Math.round(remaining / 2);
      setMidtermWeight(half);
      setFinalExamWeight(remaining - half);
    }
    setActivePreset('custom');
  };

  // เปลี่ยนแปลงคะแนนสอบ -> ที่เหลือคือคะแนนเก็บใบงาน
  const handleExamChange = (val: number) => {
    const ex = Math.max(0, Math.min(100, val));
    setExamWeight(ex);
    const remaining = Math.max(0, 100 - ex);
    setCourseworkWeight(remaining);

    const half = Math.round(ex / 2);
    setMidtermWeight(half);
    setFinalExamWeight(ex - half);
    setActivePreset('custom');
  };

  // เปลี่ยนแปลงสอบกลางภาค (ในคะแนนสอบ)
  const handleMidtermChange = (val: number) => {
    const m = Math.max(0, Math.min(examWeight, val));
    setMidtermWeight(m);
    setFinalExamWeight(Math.max(0, examWeight - m));
    setActivePreset('custom');
  };

  // เปลี่ยนแปลงสอบปลายภาค (ในคะแนนสอบ)
  const handleFinalExamChange = (val: number) => {
    const f = Math.max(0, Math.min(examWeight, val));
    setFinalExamWeight(f);
    setMidtermWeight(Math.max(0, examWeight - f));
    setActivePreset('custom');
  };

  // Save Ratio for Current Subject & Semester
  const handleSaveRatio = () => {
    if (!selectedSubject) return;

    const newRatio: SubjectGradingRatio = {
      courseworkWeight: Number(courseworkWeight) || 0,
      examWeight: Number(examWeight) || Math.max(0, 100 - (Number(courseworkWeight) || 0)),
      midtermWeight: Number(midtermWeight) || 0,
      finalExamWeight: Number(finalExamWeight) || 0,
      totalTargetScore: 100,
      ratioPreset: (activePreset as any) || 'custom',
      description: ratioNote.trim(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSubject: Subject = {
      ...selectedSubject,
      ...(activeSemester === 1 
        ? { 
            ratioSemester1: newRatio, 
            semester1TargetScore: newRatio.courseworkWeight 
          } 
        : { 
            ratioSemester2: newRatio, 
            semester2TargetScore: newRatio.courseworkWeight 
          }
      ),
    };

    storage.saveSubject(updatedSubject);
    const allUpdated = storage.getSubjects();
    onUpdateSubjects(allUpdated);

    showToast(`บันทึกสัดส่วน 2 ส่วน: วิชา ${selectedSubject.code} (${selectedSubject.name}) ใบงาน ${courseworkWeight} : สอบ ${examWeight} เรียบร้อยแล้ว`);
  };

  // Copy current semester ratio to the other semester
  const handleCopyToOtherSemester = () => {
    if (!selectedSubject) return;
    const targetSem = activeSemester === 1 ? 2 : 1;

    const newRatio: SubjectGradingRatio = {
      courseworkWeight: Number(courseworkWeight) || 0,
      examWeight: Number(examWeight) || Math.max(0, 100 - (Number(courseworkWeight) || 0)),
      midtermWeight: Number(midtermWeight) || 0,
      finalExamWeight: Number(finalExamWeight) || 0,
      totalTargetScore: 100,
      ratioPreset: (activePreset as any) || 'custom',
      description: ratioNote.trim(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSubject: Subject = {
      ...selectedSubject,
      ratioSemester1: activeSemester === 1 ? newRatio : (selectedSubject.ratioSemester1 || newRatio),
      ratioSemester2: activeSemester === 2 ? newRatio : newRatio,
      semester1TargetScore: activeSemester === 1 ? newRatio.courseworkWeight : (selectedSubject.semester1TargetScore || newRatio.courseworkWeight),
      semester2TargetScore: activeSemester === 2 ? newRatio.courseworkWeight : newRatio.courseworkWeight,
    };

    storage.saveSubject(updatedSubject);
    const allUpdated = storage.getSubjects();
    onUpdateSubjects(allUpdated);

    showToast(`คัดลอกสัดส่วนไปยังภาคเรียนที่ ${targetSem} เรียบร้อยแล้ว (ทั้งสองภาคเรียนมีสัดส่วนตรงกัน)`, 'success');
  };

  // Copy current ratio to ALL accessible subjects
  const handleApplyToAllSubjects = () => {
    if (!selectedSubject || accessibleSubjects.length <= 1) return;
    setShowApplyAllModal(true);
  };

  const confirmApplyToAllSubjects = () => {
    if (!selectedSubject) return;

    const ratioToApply: SubjectGradingRatio = {
      courseworkWeight: Number(courseworkWeight) || 0,
      examWeight: Number(examWeight) || Math.max(0, 100 - (Number(courseworkWeight) || 0)),
      midtermWeight: Number(midtermWeight) || 0,
      finalExamWeight: Number(finalExamWeight) || 0,
      totalTargetScore: 100,
      ratioPreset: (activePreset as any) || 'custom',
      description: ratioNote.trim(),
      updatedAt: new Date().toISOString(),
    };

    accessibleSubjects.forEach((sub) => {
      const updated: Subject = {
        ...sub,
        ...(activeSemester === 1
          ? { ratioSemester1: ratioToApply, semester1TargetScore: ratioToApply.courseworkWeight }
          : { ratioSemester2: ratioToApply, semester2TargetScore: ratioToApply.courseworkWeight }
        ),
      };
      storage.saveSubject(updated);
    });

    const allUpdated = storage.getSubjects();
    onUpdateSubjects(allUpdated);
    setShowApplyAllModal(false);
    showToast(`นำสัดส่วนคะแนน 2 ส่วน (ใบงาน ${courseworkWeight} : สอบ ${examWeight}) ไปใช้กับทุกวิชาที่สอนเรียบร้อยแล้ว`, 'success');
  };

  if (accessibleSubjects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-4 shadow-xs">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto">
          <BookOpen className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">ยังไม่มีข้อมูลรายวิชาในระบบ</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          กรุณาเพิ่มรายวิชาในเมนู "รายวิชา" ก่อน จึงจะสามารถกำหนดสัดส่วนคะแนนของแต่ละวิชาได้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-slideUp ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-700'
            : toastMessage.type === 'error'
            ? 'bg-rose-600 text-white border-rose-700'
            : 'bg-slate-800 text-white border-slate-900'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 shrink-0 text-amber-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0 border border-amber-200/60">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                  สัดส่วนคะแนนรายวิชาและภาคเรียน
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  เกณฑ์หลักในการเก็บคะแนน
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                กำหนดโครงสร้างคะแนนรวม 100 คะแนน (คะแนนเก็บใบงาน, สอบกลางภาค, สอบปลายภาค) แยกตามแต่ละวิชาและภาคเรียน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleSaveRatio}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกสัดส่วนคะแนน</span>
            </button>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">หลักการเชื่อมโยงระบบ:</span> สัดส่วนคะแนนในหน้านี้จะถูกส่งไปเป็น <strong>เกณฑ์หลักในการคำนวณคะแนนใบงาน</strong> (ในหน้าบันทึกคะแนนใบงาน) และ <strong>เกณฑ์คะแนนเต็มแบบทดสอบกลางภาค/ปลายภาค</strong> (ในหน้าเก็บคะแนนสอบ และหน้าตัดเกรด) โดยอัตโนมัติ เพื่อให้คะแนนทุกส่วนสอดคล้องตามโครงสร้างหลักสูตรสถานศึกษา
          </div>
        </div>
      </div>

      {/* Subject & Semester Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Subject Dropdown */}
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>เลือกรายวิชาที่ต้องการตั้งค่า:</span>
            </label>
            <div className="relative">
              <select
                id="select-ratio-subject"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors cursor-pointer"
              >
                {accessibleSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name} ({sub.gradeLevel} | {sub.credits} หน่วยกิต | ครูผู้สอน: {sub.teacherName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Semester Toggle */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>เลือกภาคเรียน:</span>
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                id="btn-ratio-sem-1"
                type="button"
                onClick={() => setActiveSemester(1)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  activeSemester === 1
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 1
              </button>
              <button
                id="btn-ratio-sem-2"
                type="button"
                onClick={() => setActiveSemester(2)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  activeSemester === 2
                    ? 'bg-white text-indigo-800 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ภาคเรียนที่ 2
              </button>
            </div>
          </div>

        </div>

        {/* Active Subject Meta Summary */}
        {selectedSubject && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800">{selectedSubject.code} {selectedSubject.name}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">ระดับชั้น {selectedSubject.gradeLevel}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">ห้องเรียนเป้าหมาย: {selectedSubject.targetClasses?.join(', ') || '-'}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">ครูประจำวิชา: {selectedSubject.teacherName}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyToOtherSemester}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                title={`คัดลอกสัดส่วนปัจจุบันไปใช้กับภาคเรียนที่ ${activeSemester === 1 ? 2 : 1}`}
              >
                <Copy className="w-3 h-3" />
                <span>คัดลอกสัดส่วนไปภาคเรียนที่ {activeSemester === 1 ? 2 : 1}</span>
              </button>

              {accessibleSubjects.length > 1 && (
                <button
                  type="button"
                  onClick={handleApplyToAllSubjects}
                  className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="ใช้สัดส่วนนี้กับทุกวิชาที่สอน"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>ใช้กับทุกวิชาที่สอน</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Preset & Weight Adjustment (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Preset Buttons Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>เลือกรูปแบบสัดส่วนมาตรฐาน (Presets):</span>
              </h2>
              {activePreset && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  สัดส่วนปัจจุบัน: {activePreset}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = activePreset === opt.id && courseworkWeight === opt.coursework && examWeight === opt.exam;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyPreset(opt)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-800">{opt.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                        {opt.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {opt.description}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-mono font-bold">
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        1. ใบงาน {opt.coursework}
                      </span>
                      <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        2. สอบ {opt.exam}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper Inputs for Custom Weights: 2-Part Structure */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                  <span>แบ่งสัดส่วนคะแนนเป็น 2 ส่วน (รวมเต็ม 100 คะแนน)</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เมื่อกำหนดคะแนนเก็บจากใบงานแล้ว ส่วนที่เหลือจะเป็นคะแนนสอบโดยอัตโนมัติ
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isComplete100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                }`}>
                  {isComplete100 ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>รวม: {totalWeight} / 100 คะแนน</span>
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* ส่วนที่ 1: คะแนนเก็บใบงาน / ภาระงาน */}
              <div className="bg-emerald-50/40 border border-emerald-200/70 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-emerald-950">
                      1. คะแนนเก็บใบงาน / ชิ้นงาน / ภาระงานระหว่างเรียน
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                    {courseworkWeight} คะแนน ({courseworkWeight}%)
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  อ้างอิงเป็นเกณฑ์เต็มหลักในการคำนวณคะแนนรวมใบงานในหน้า "บันทึกคะแนนใบงาน"
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={courseworkWeight}
                    onChange={(e) => handleCourseworkChange(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      id="input-weight-coursework"
                      type="number"
                      min="0"
                      max="100"
                      value={courseworkWeight}
                      onChange={(e) => handleCourseworkChange(Number(e.target.value) || 0)}
                      className="w-16 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-emerald-700 font-bold">คะแนน</span>
                  </div>
                </div>
              </div>

              {/* ส่วนที่ 2: คะแนนสอบ (คำนวณที่เหลือโดยอัตโนมัติ) */}
              <div className="bg-indigo-50/40 border border-indigo-200/70 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-xs font-bold text-indigo-950">
                      2. คะแนนสอบ (Exam Score)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded border border-indigo-200">
                    {examWeight} คะแนน ({examWeight}%)
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-indigo-900 bg-indigo-100/50 px-3 py-1.5 rounded-lg border border-indigo-200/60">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>คะแนนสอบคำนวณจากที่เหลือ: 100 - {courseworkWeight} (ใบงาน) = <strong>{examWeight} คะแนน</strong></span>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">คำนวณอัตโนมัติ</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={examWeight}
                    onChange={(e) => handleExamChange(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      id="input-weight-exam"
                      type="number"
                      min="0"
                      max="100"
                      value={examWeight}
                      onChange={(e) => handleExamChange(Number(e.target.value) || 0)}
                      className="w-16 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-indigo-700 font-bold">คะแนน</span>
                  </div>
                </div>

                {/* Sub-breakdown: กลางภาค / ปลายภาค ภายในคะแนนสอบ */}
                <div className="pt-2.5 border-t border-indigo-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700">
                      จำแนกสัดส่วนการสอบย่อย (กลางภาค / ปลายภาค):
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-indigo-700">
                      กลาง {midtermWeight} + ปลาย {finalExamWeight} = {examWeight} คะแนน
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Midterm inside Exam */}
                    <div className="bg-white/90 p-2.5 rounded-lg border border-indigo-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700">สอบกลางภาค</span>
                        <span className="font-mono font-bold text-indigo-700">{midtermWeight} คะแนน</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max={examWeight}
                          step="1"
                          value={midtermWeight}
                          onChange={(e) => handleMidtermChange(Number(e.target.value))}
                          className="w-full accent-indigo-600 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max={examWeight}
                          value={midtermWeight}
                          onChange={(e) => handleMidtermChange(Number(e.target.value) || 0)}
                          className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-center text-indigo-900"
                        />
                      </div>
                    </div>

                    {/* Final inside Exam */}
                    <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700">สอบปลายภาค</span>
                        <span className="font-mono font-bold text-purple-700">{finalExamWeight} คะแนน</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max={examWeight}
                          step="1"
                          value={finalExamWeight}
                          onChange={(e) => handleFinalExamChange(Number(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max={examWeight}
                          value={finalExamWeight}
                          onChange={(e) => handleFinalExamChange(Number(e.target.value) || 0)}
                          className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-center text-purple-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note / Description */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-600">
                คำอธิบาย / บันทึกเพิ่มเติมโครงสร้างสัดส่วนคะแนน:
              </label>
              <input
                type="text"
                value={ratioNote}
                onChange={(e) => setRatioNote(e.target.value)}
                placeholder="เช่น อิงตามหลักสูตรแกนกลางฯ สาระวิทยาการคำนวณ"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* Right Column: Visual Breakdown & Direct System Alignments (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Graphical Ratio Breakdown Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-600" />
              <span>ภาพรวมสัดส่วน 2 ส่วน (รวมเต็ม 100%)</span>
            </h2>

            {/* 2-Segment Bar */}
            <div className="space-y-1.5">
              <div className="h-6 rounded-xl overflow-hidden flex bg-slate-100 border border-slate-200 p-0.5">
                {courseworkWeight > 0 && (
                  <div 
                    style={{ width: `${(courseworkWeight / (totalWeight || 100)) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all duration-300 first:rounded-l-lg last:rounded-r-lg flex items-center justify-center text-[11px] font-bold text-white shadow-2xs"
                    title={`1. ใบงาน/ภาระงาน: ${courseworkWeight} คะแนน`}
                  >
                    {courseworkWeight >= 15 && `ใบงาน ${courseworkWeight}%`}
                  </div>
                )}
                {examWeight > 0 && (
                  <div 
                    style={{ width: `${(examWeight / (totalWeight || 100)) * 100}%` }}
                    className="bg-indigo-600 h-full transition-all duration-300 first:rounded-l-lg last:rounded-r-lg flex items-center justify-center text-[11px] font-bold text-white shadow-2xs"
                    title={`2. คะแนนสอบ: ${examWeight} คะแนน`}
                  >
                    {examWeight >= 15 && `สอบ ${examWeight}%`}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>0 คะแนน</span>
                <span>เต็ม 100 คะแนน</span>
              </div>
            </div>

            {/* Legend & Breakdown Table */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-emerald-950">1. คะแนนเก็บใบงาน / ภาระงาน</span>
                </div>
                <div className="font-mono font-bold text-emerald-800">
                  {courseworkWeight} คะแนน ({((courseworkWeight / (totalWeight || 100)) * 100).toFixed(0)}%)
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                  <div>
                    <span className="font-semibold text-indigo-950">2. คะแนนสอบ</span>
                    <span className="text-[10px] text-indigo-700 block font-normal">(กลางภาค {midtermWeight} + ปลายภาค {finalExamWeight})</span>
                  </div>
                </div>
                <div className="font-mono font-bold text-indigo-800">
                  {examWeight} คะแนน ({((examWeight / (totalWeight || 100)) * 100).toFixed(0)}%)
                </div>
              </div>
            </div>
          </div>

          {/* System Alignment & Quick Link Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>ความเชื่อมโยงในระบบ (วิชานี้):</span>
            </h2>

            {/* 1. Worksheet Status */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">1. การเก็บคะแนนใบงาน</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  เต็ม {courseworkWeight} คะแนน
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                สร้างไว้แล้ว: <strong>{subjectAssignments.length} ช่อง</strong> (คะแนนดิบรวม {rawAssignmentTotalMax} คะแนน)
              </p>
              {onNavigateToGrading && (
                <button
                  type="button"
                  onClick={() => onNavigateToGrading(selectedSubject.id)}
                  className="w-full text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>ไปหน้าบันทึกคะแนนใบงาน</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. Exam Status */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">2. การเก็บคะแนนสอบ</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  เต็ม {examWeight} คะแนน
                </span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>สอบกลางภาค: <strong>{midtermWeight} คะแนน</strong> {midtermExam ? `(สร้างแล้ว: ${midtermExam.title})` : '(ยังไม่มี)'}</div>
                <div>สอบปลายภาค: <strong>{finalExamWeight} คะแนน</strong> {finalExam ? `(สร้างแล้ว: ${finalExam.title})` : '(ยังไม่มี)'}</div>
              </div>
              {onNavigateToExams && (
                <button
                  type="button"
                  onClick={() => onNavigateToExams(selectedSubject.id)}
                  className="w-full text-center text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>ไปหน้าเก็บคะแนนสอบ</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 3. Grade Calculation Link */}
            {onNavigateToCutGrade && (
              <button
                type="button"
                onClick={() => onNavigateToCutGrade(selectedSubject.id)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                <span>ไปหน้าตัดเกรดวิชานี้ (สัดส่วน ใบงาน {courseworkWeight} : สอบ {examWeight})</span>
              </button>
            )}

          </div>

        </div>

      </div>

      {/* Overview Table of All Subjects */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              ตารางสรุปสัดส่วนคะแนนทุกรายวิชา (1.ใบงาน : 2.สอบ)
            </h2>
            <p className="text-xs text-slate-500">
              เปรียบเทียบสัดส่วนคะแนน ภาคเรียนที่ 1 และ ภาคเรียนที่ 2 ของแต่ละวิชาในระบบ
            </p>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 font-mono px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            ทั้งหมด {accessibleSubjects.length} รายวิชา
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3 w-28">รหัสวิชา</th>
                <th className="p-3">ชื่อรายวิชา</th>
                <th className="p-3 w-24">ระดับชั้น</th>
                <th className="p-3">ครูประจำวิชา</th>
                <th className="p-3 text-center bg-emerald-50/50 border-l border-r border-slate-200">
                  สัดส่วน ภาค 1<br />
                  <span className="text-[10px] font-normal text-slate-500">(1.ใบงาน : 2.สอบ)</span>
                </th>
                <th className="p-3 text-center bg-indigo-50/50 border-r border-slate-200">
                  สัดส่วน ภาค 2<br />
                  <span className="text-[10px] font-normal text-slate-500">(1.ใบงาน : 2.สอบ)</span>
                </th>
                <th className="p-3 text-right w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accessibleSubjects.map((sub) => {
                const r1 = getSubjectRatio(sub, 1);
                const r2 = getSubjectRatio(sub, 2);
                const isCurrent = sub.id === selectedSubjectId;

                return (
                  <tr 
                    key={sub.id} 
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCurrent ? 'bg-amber-50/40 font-semibold' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-bold text-slate-800">{sub.code}</td>
                    <td className="p-3 font-medium text-slate-800">
                      {sub.name}
                      <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({sub.credits} นก.)</span>
                    </td>
                    <td className="p-3 text-slate-600">{sub.gradeLevel}</td>
                    <td className="p-3 text-slate-600">{sub.teacherName}</td>
                    
                    {/* S1 Ratio */}
                    <td className="p-3 text-center font-mono bg-emerald-50/20 border-l border-r border-slate-200">
                      <span className="text-emerald-700 font-bold">{r1.courseworkWeight}</span> : <span className="text-indigo-700 font-bold">{r1.examWeight}</span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        (กลาง {r1.midtermWeight} + ปลาย {r1.finalExamWeight})
                      </span>
                    </td>

                    {/* S2 Ratio */}
                    <td className="p-3 text-center font-mono bg-indigo-50/20 border-r border-slate-200">
                      <span className="text-emerald-700 font-bold">{r2.courseworkWeight}</span> : <span className="text-indigo-700 font-bold">{r2.examWeight}</span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        (กลาง {r2.midtermWeight} + ปลาย {r2.finalExamWeight})
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubjectId(sub.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isCurrent ? 'กำลังเลือก' : 'เลือกตั้งค่า'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Applying to All Subjects */}
      {showApplyAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">ยืนยันนำสัดส่วนไปใช้กับทุกรายวิชา</h3>
                <p className="text-xs text-slate-500">ภาคเรียนที่ {activeSemester}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <p>
                คุณกำลังจะนำสัดส่วนคะแนนนี้ไปปรับใช้กับรายวิชาที่คุณรับผิดชอบทั้งหมด <span className="font-bold text-slate-800">({accessibleSubjects.length} วิชา)</span>:
              </p>
              <div className="flex items-center justify-around py-2 bg-white rounded-lg border border-slate-200 text-center font-bold">
                <div>
                  <div className="text-[10px] text-slate-400">ใบงาน/เก็บ</div>
                  <div className="text-emerald-700 text-sm">{courseworkWeight}</div>
                </div>
                <div className="text-slate-300">:</div>
                <div>
                  <div className="text-[10px] text-slate-400">กลางภาค</div>
                  <div className="text-amber-700 text-sm">{midtermWeight}</div>
                </div>
                <div className="text-slate-300">:</div>
                <div>
                  <div className="text-[10px] text-slate-400">ปลายภาค</div>
                  <div className="text-indigo-700 text-sm">{finalExamWeight}</div>
                </div>
                <div className="text-slate-300">=</div>
                <div>
                  <div className="text-[10px] text-slate-400">รวม</div>
                  <div className="text-slate-800 text-sm">{totalWeight}</div>
                </div>
              </div>
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-md">
                ⚠️ การดำเนินการนี้จะมีผลกับทุกวิชาในภาคเรียนที่ {activeSemester} ทันที
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyAllModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmApplyToAllSubjects}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันนำไปใช้</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
