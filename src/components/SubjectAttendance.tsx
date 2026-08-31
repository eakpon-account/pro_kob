import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CalendarCheck, 
  Search, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Check, 
  UserCheck, 
  AlertTriangle,
  RotateCcw,
  Info,
  ShieldCheck,
  Eye,
  UserX,
  HeartPulse,
  Send,
  Flag,
  Sun,
  LayoutGrid,
  List,
  Filter,
  CheckCheck
} from 'lucide-react';
import { 
  Student, 
  Subject, 
  User, 
  StudentAttendanceRecord, 
  AttendanceStatus,
  SchoolSettings 
} from '../types';
import { storage } from '../services/storage';
import { PrintAttendanceModal } from './PrintAttendanceModal';
import { AttendanceCalendarPicker } from './AttendanceCalendarPicker';
import { CancelAttendanceModal } from './CancelAttendanceModal';
import { 
  getThaiHoliday, 
  isWeekend, 
  isDateInFuture, 
  formatThaiDateLong, 
  formatThaiDateShort 
} from '../utils/thaiHolidays';

interface SubjectAttendanceProps {
  currentUser: User;
  students: Student[];
  subjects: Subject[];
  initialSubjectId?: string;
  initialClassKey?: string;
}

const THAI_MONTHS = [
  { value: 1, label: 'มกราคม', days: 31 },
  { value: 2, label: 'กุมภาพันธ์', days: 28 },
  { value: 3, label: 'มีนาคม', days: 31 },
  { value: 4, label: 'เมษายน', days: 30 },
  { value: 5, label: 'พฤษภาคม', days: 31 },
  { value: 6, label: 'มิถุนายน', days: 30 },
  { value: 7, label: 'กรกฎาคม', days: 31 },
  { value: 8, label: 'สิงหาคม', days: 31 },
  { value: 9, label: 'กันยายน', days: 30 },
  { value: 10, label: 'ตุลาคม', days: 31 },
  { value: 11, label: 'พฤศจิกายน', days: 30 },
  { value: 12, label: 'ธันวาคม', days: 31 },
];

export const SubjectAttendance: React.FC<SubjectAttendanceProps> = ({
  currentUser,
  students,
  subjects,
  initialSubjectId,
  initialClassKey,
}) => {
  const schoolSettings = storage.getSchoolSettings();

  // Subject filtering: "My Subjects" vs "All Subjects"
  const [filterMySubjectsOnly, setFilterMySubjectsOnly] = useState<boolean>(() => {
    return currentUser.role === 'teacher';
  });

  const availableSubjects = useMemo(() => {
    if (filterMySubjectsOnly && currentUser.role === 'teacher') {
      const my = subjects.filter((s) => s.teacherId === currentUser.id || s.teacherName === currentUser.name);
      return my.length > 0 ? my : subjects;
    }
    return subjects;
  }, [subjects, filterMySubjectsOnly, currentUser]);

  // Selected Subject State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && subjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    if (availableSubjects.length > 0) {
      return availableSubjects[0].id;
    }
    return subjects.length > 0 ? subjects[0].id : '';
  });

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  }, [subjects, selectedSubjectId]);

  // Target Classes for selected subject
  const availableClasses = useMemo(() => {
    if (!selectedSubject) return [];
    return selectedSubject.targetClasses || [];
  }, [selectedSubject]);

  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => {
    if (initialClassKey && availableClasses.includes(initialClassKey)) {
      return initialClassKey;
    }
    return availableClasses.length > 0 ? availableClasses[0] : 'ม.1/1';
  });

  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClassKey)) {
      setSelectedClassKey(availableClasses[0]);
    }
  }, [availableClasses, selectedClassKey]);

  // Academic Year & Semester
  const [academicYear, setAcademicYear] = useState<string>(schoolSettings.academicYear || '2568');
  const [semester, setSemester] = useState<1 | 2>(schoolSettings.currentSemester || 1);

  // Selected Real Date for attendance checking (Defaults to Today)
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Calendar display toggle
  const [showCalendarView, setShowCalendarView] = useState<boolean>(false);

  // Quick absence batch modal
  const [showQuickAbsentModal, setShowQuickAbsentModal] = useState<boolean>(false);
  const [batchAbsentStatus, setBatchAbsentStatus] = useState<'absent' | 'leave' | 'sick'>('absent');
  const [selectedStudentIdsForBatch, setSelectedStudentIdsForBatch] = useState<string[]>([]);
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unattended' | 'present' | 'absent' | 'leave' | 'sick'>('all');
  const [viewLayout, setViewLayout] = useState<'list' | 'grid'>('list');

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Cancel Attendance Modal State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // Derive month & day from selectedDate
  const currentMonthNum = selectedDate.getMonth() + 1; // 1-12
  const currentDayNum = Math.min(selectedDate.getDate(), 30); // 1-30 mapping for monthly sheet

  // Filter students for current class
  const classStudents = useMemo(() => {
    return students
      .filter((s) => s.classKey === selectedClassKey && s.status === 'active')
      .sort((a, b) => a.studentNumber - b.studentNumber);
  }, [students, selectedClassKey]);

  // Load Attendance Records for current selection
  const loadAttendance = useCallback(() => {
    if (!selectedSubject) return;
    const records = storage.getOrInitAttendanceForClass(
      classStudents,
      selectedSubject.id,
      selectedClassKey,
      academicYear,
      semester,
      currentMonthNum
    );
    setAttendanceRecords(records);
  }, [classStudents, selectedSubject, selectedClassKey, academicYear, semester, currentMonthNum]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Map student ID to their attendance record
  const recordMap = useMemo(() => {
    const map = new Map<string, StudentAttendanceRecord>();
    attendanceRecords.forEach((r) => map.set(r.studentId, r));
    return map;
  }, [attendanceRecords]);

  // Holiday and Weekend Information for selected date
  const selectedHoliday = useMemo(() => {
    return getThaiHoliday(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
  }, [selectedDate]);

  const isSelectedWeekend = useMemo(() => {
    return isWeekend(selectedDate);
  }, [selectedDate]);

  // Check if date can navigate forward (cannot exceed today)
  const isTodaySelected = useMemo(() => {
    return (
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate()
    );
  }, [selectedDate, today]);

  // Navigation handlers for date
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    if (isDateInFuture(next, today)) {
      setStatusMessage({
        type: 'error',
        text: '🔒 ไม่สามารถเลือกวันล่วงหน้าเกินกว่าวันที่ปัจจุบันได้',
      });
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }
    setSelectedDate(next);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
  };

  // Helper: Get student status on the selected date
  // By default, if not set, student is regarded as 'present' (✓ มาเรียน) for exception-based workflow
  const getStudentStatus = (studentId: string): AttendanceStatus => {
    const rec = recordMap.get(studentId);
    const val = rec?.days?.[currentDayNum];
    if (!val || val === 'unrecorded') {
      return 'present'; // Default to มาเรียน
    }
    return val;
  };

  // Handle setting student status
  const handleSetStudentStatus = (studentId: string, newStatus: AttendanceStatus) => {
    if (isDateInFuture(selectedDate, today)) {
      setStatusMessage({
        type: 'error',
        text: '🔒 ไม่สามารถเช็คชื่อวันล่วงหน้าได้',
      });
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    const currentRec = recordMap.get(studentId);
    if (!currentRec) return;

    const updatedDays = { ...currentRec.days, [currentDayNum]: newStatus };
    const stats = storage.calculateAttendanceStats(updatedDays);
    const updatedRec: StudentAttendanceRecord = {
      ...currentRec,
      days: updatedDays,
      ...stats,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAttendanceRecord(updatedRec);
    setAttendanceRecords((prev) => prev.map((r) => (r.studentId === studentId ? updatedRec : r)));
  };

  // Batch: Mark all students present for current selected date
  const handleMarkAllPresent = () => {
    if (isDateInFuture(selectedDate, today)) {
      setStatusMessage({
        type: 'error',
        text: '🔒 ไม่สามารถเช็คชื่อวันล่วงหน้าได้',
      });
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    const updatedList: StudentAttendanceRecord[] = [];

    classStudents.forEach((st) => {
      const rec = recordMap.get(st.id);
      if (rec) {
        const updatedDays = { ...rec.days, [currentDayNum]: 'present' as AttendanceStatus };
        const stats = storage.calculateAttendanceStats(updatedDays);
        updatedList.push({
          ...rec,
          days: updatedDays,
          ...stats,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    storage.bulkSaveAttendanceRecords(updatedList);
    setAttendanceRecords(updatedList);
    setStatusMessage({
      type: 'success',
      text: `บันทึก "มาเรียนครบทุกคน (✓)" สำหรับ ${formatThaiDateShort(selectedDate)} เรียบร้อยแล้ว`,
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Batch apply absence to selected students from quick modal
  const handleApplyBatchAbsences = () => {
    if (selectedStudentIdsForBatch.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คนที่ต้องการบันทึกสถานะ',
      });
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    const updatedList: StudentAttendanceRecord[] = [];

    classStudents.forEach((st) => {
      const rec = recordMap.get(st.id);
      if (rec) {
        const isSelected = selectedStudentIdsForBatch.includes(st.id);
        const newStatus = isSelected ? batchAbsentStatus : (rec.days?.[currentDayNum] || 'present');
        const updatedDays = { ...rec.days, [currentDayNum]: newStatus as AttendanceStatus };
        const stats = storage.calculateAttendanceStats(updatedDays);
        updatedList.push({
          ...rec,
          days: updatedDays,
          ...stats,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    storage.bulkSaveAttendanceRecords(updatedList);
    setAttendanceRecords(updatedList);
    setShowQuickAbsentModal(false);
    setSelectedStudentIdsForBatch([]);
    setStatusMessage({
      type: 'success',
      text: `บันทึกสถานะให้นักเรียน ${selectedStudentIdsForBatch.length} คน เรียบร้อยแล้ว`,
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Handle Cancel / Reset Attendance for a selected date
  const handleCancelAttendance = (targetDate: Date, targetStudentIds?: string[]) => {
    if (!selectedSubject) return;

    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = Math.min(targetDate.getDate(), 30);

    // Get current records for this month
    const existingMonthRecords = storage.getOrInitAttendanceForClass(
      classStudents,
      selectedSubject.id,
      selectedClassKey,
      academicYear,
      semester,
      targetMonth
    );

    const updatedList: StudentAttendanceRecord[] = [];

    existingMonthRecords.forEach((rec) => {
      // Check if this student is in scope
      const shouldCancel = !targetStudentIds || targetStudentIds.includes(rec.studentId);
      if (shouldCancel) {
        const updatedDays = { ...rec.days };
        delete updatedDays[targetDay];
        const stats = storage.calculateAttendanceStats(updatedDays);
        updatedList.push({
          ...rec,
          days: updatedDays,
          ...stats,
          updatedAt: new Date().toISOString(),
        });
      } else {
        updatedList.push(rec);
      }
    });

    storage.bulkSaveAttendanceRecords(updatedList);

    // If currently viewing the canceled month, update active attendanceRecords in state
    if (targetMonth === currentMonthNum) {
      setAttendanceRecords(updatedList);
    } else {
      loadAttendance();
    }

    setStatusMessage({
      type: 'info',
      text: `ยกเลิกการเช็คชื่อ ${formatThaiDateShort(targetDate)} เรียบร้อยแล้ว (ล้างข้อมูลและคำนวณสถิติใหม่แล้ว)`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Clear single student status for current day
  const handleClearStudentAttendance = (studentId: string) => {
    const currentRec = recordMap.get(studentId);
    if (!currentRec) return;

    const updatedDays = { ...currentRec.days };
    delete updatedDays[currentDayNum];
    const stats = storage.calculateAttendanceStats(updatedDays);
    const updatedRec: StudentAttendanceRecord = {
      ...currentRec,
      days: updatedDays,
      ...stats,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAttendanceRecord(updatedRec);
    setAttendanceRecords((prev) => prev.map((r) => (r.studentId === studentId ? updatedRec : r)));

    setStatusMessage({
      type: 'info',
      text: `ล้างข้อมูลการเช็คชื่อในวันที่ ${currentDayNum} ของนักเรียนเรียบร้อยแล้ว`,
    });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Daily Statistics on Selected Date
  const currentDayStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let sick = 0;

    classStudents.forEach((st) => {
      const stStatus = getStudentStatus(st.id);
      if (stStatus === 'present') present++;
      else if (stStatus === 'absent') absent++;
      else if (stStatus === 'leave') leave++;
      else if (stStatus === 'sick') sick++;
    });

    const unattended = absent + leave + sick;
    const total = classStudents.length;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '100.0';

    return { present, absent, leave, sick, unattended, total, rate };
  }, [classStudents, recordMap, currentDayNum]);

  // Filtered student list by search & status
  const filteredStudents = useMemo(() => {
    return classStudents.filter((st) => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        query === '' ||
        st.studentCode.toLowerCase().includes(query) ||
        st.firstName.toLowerCase().includes(query) ||
        st.lastName.toLowerCase().includes(query) ||
        st.studentNumber.toString() === query;

      if (!matchQuery) return false;

      const stStatus = getStudentStatus(st.id);

      if (statusFilter === 'all') return true;
      if (statusFilter === 'unattended') return stStatus === 'absent' || stStatus === 'leave' || stStatus === 'sick';
      return stStatus === statusFilter;
    });
  }, [classStudents, searchQuery, statusFilter, recordMap, currentDayNum]);

  // Month object for labels
  const selectedMonthObj = THAI_MONTHS.find((m) => m.value === currentMonthNum) || THAI_MONTHS[7];

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn">
      
      {/* Top Header Card: Title, Controls, Subject & Classroom Selection */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        
        {/* Header Title Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  ใบเช็คยอดนักเรียนประจำรายวิชา (Attendance Sheet)
                </h1>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  ระบบเช็คชื่อรายบุคคล
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกวันที่จากปฏิทิน (พร้อมไฮไลท์วันหยุด/เสาร์-อาทิตย์) • ระบบตั้งค่ามาเรียนทุกคนอัตโนมัติ • คลิกเลือกเฉพาะนักเรียนที่ไม่มา (ขาด/ลา/ป่วย)
              </p>
            </div>
          </div>

          {/* Action Buttons: Print & Excel */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              id="btn-toggle-calendar"
              onClick={() => setShowCalendarView(!showCalendarView)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border shadow-2xs ${
                showCalendarView 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="เปิด/ปิด ปฏิทินแสดงวันหยุดและประวัติ"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>{showCalendarView ? 'ซ่อนปฏิทิน' : 'ปฏิทินเช็คชื่อ'}</span>
            </button>

            {selectedSubject && (
              <>
                <button
                  id="btn-open-cancel-attendance-modal"
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="ยกเลิกการเช็คชื่อนักเรียน / เลือกวันที่ต้องการยกเลิก"
                >
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <span className="hidden sm:inline">ยกเลิกการเช็คชื่อ</span>
                </button>

                <button
                  id="btn-print-attendance-sheet"
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                  title="พิมพ์แบบรายงานเช็คชื่อและบันทึกเวลาเรียน A4 แนวนอน (บพ.)"
                >
                  <Printer className="w-4 h-4 text-indigo-100" />
                  <span>พิมพ์รายงาน (A4 แนวนอน)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Selection Bar: Subject, Class, Academic Year, Semester */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Subject Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>รายวิชาที่สอน</span>
              </span>
              {currentUser.role === 'teacher' && (
                <button
                  type="button"
                  onClick={() => setFilterMySubjectsOnly(!filterMySubjectsOnly)}
                  className="text-[10px] text-indigo-600 hover:underline font-normal cursor-pointer"
                >
                  {filterMySubjectsOnly ? 'ดูวิชาทั้งหมด' : 'ดูเฉพาะวิชาของฉัน'}
                </button>
              )}
            </label>
            <select
              id="select-attendance-subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name} ({s.teacherName})
                </option>
              ))}
            </select>
          </div>

          {/* Classroom Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>ระดับชั้น / ห้องเรียน</span>
            </label>
            <select
              id="select-attendance-class"
              value={selectedClassKey}
              onChange={(e) => setSelectedClassKey(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  ห้อง {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ปีการศึกษา
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              placeholder="เช่น 2568"
            />
          </div>

          {/* Semester */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ภาคเรียน
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              <option value={1}>ภาคเรียนที่ 1</option>
              <option value={2}>ภาคเรียนที่ 2</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Date Bar with Calendar Trigger, Lock Indicator & Thai Holidays */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Current Selected Date Display */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">
                วันที่กำลังเช็คชื่อนักเรียน
              </span>
              {isTodaySelected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ● วันนี้
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{formatThaiDateLong(selectedDate)}</span>
            </div>

            {/* Holiday / Weekend Warning Banner */}
            {selectedHoliday ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold mt-1">
                <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>วันหยุดนักขัตฤกษ์: {selectedHoliday.name}</span>
              </div>
            ) : isSelectedWeekend ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold mt-1">
                <Sun className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>วันหยุดสุดสัปดาห์ (วันเสาร์ - อาทิตย์)</span>
              </div>
            ) : (
              <div className="text-xs text-slate-300">
                วันทำการเรียนการสอนปกติ (สัปดาห์ที่ {Math.ceil(selectedDate.getDate() / 7)})
              </div>
            )}
          </div>

          {/* Quick Date Navigation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrevDay}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition-colors border border-white/10"
              title="วันก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>วันก่อนหน้า</span>
            </button>

            <button
              type="button"
              onClick={handleGoToday}
              disabled={isTodaySelected}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                isTodaySelected
                  ? 'bg-white/5 text-slate-400 border-white/5 cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-xs'
              }`}
              title="เลือกวันนี้"
            >
              วันนี้
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              disabled={isTodaySelected}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border ${
                isTodaySelected
                  ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
              }`}
              title={isTodaySelected ? '🔒 ไม่สามารถเลือกวันล่วงหน้าได้' : 'วันถัดไป'}
            >
              <span>วันถัดไป</span>
              {isTodaySelected ? <Lock className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Quick Button: Everyone Present */}
            <button
              id="btn-mark-all-present"
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ml-1"
              title="บันทึกนักเรียนทุกคนเป็น มาเรียน (✓)"
            >
              <CheckCheck className="w-4 h-4" />
              <span>บันทึกทุกคนมาเรียน (✓)</span>
            </button>

            {/* Quick Button: Cancel / Reset Attendance */}
            <button
              id="btn-quick-cancel-attendance"
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ml-1 cursor-pointer"
              title="ยกเลิกการเช็คชื่อนักเรียน / เลือกวันที่ต้องการยกเลิก"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>ยกเลิกการเช็คชื่อ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Calendar View with Holidays & Weekends */}
      {showCalendarView && (
        <div className="animate-fadeIn">
          <AttendanceCalendarPicker
            selectedDate={selectedDate}
            onSelectDate={(newDate) => setSelectedDate(newDate)}
            maxDate={today}
            attendanceRecords={attendanceRecords}
            classStudentCount={classStudents.length}
          />
        </div>
      )}

      {/* Summary KPI Cards for Selected Date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Students */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">นักเรียนทั้งหมด</div>
            <div className="text-base font-bold text-slate-900">{currentDayStats.total} คน</div>
          </div>
        </div>

        {/* Present (✓) */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700">มาเรียน (✓)</div>
            <div className="text-base font-bold text-emerald-900">
              {currentDayStats.present} คน <span className="text-xs font-normal text-emerald-700">({currentDayStats.rate}%)</span>
            </div>
          </div>
        </div>

        {/* Absent (ข) */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-rose-700">ขาดเรียน (ข)</div>
            <div className="text-base font-bold text-rose-900">{currentDayStats.absent} คน</div>
          </div>
        </div>

        {/* Leave (ล) */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-700">ลากิจ (ล)</div>
            <div className="text-base font-bold text-amber-900">{currentDayStats.leave} คน</div>
          </div>
        </div>

        {/* Sick (ป) */}
        <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-sky-700">ลาป่วย (ป)</div>
            <div className="text-base font-bold text-sky-900">{currentDayStats.sick} คน</div>
          </div>
        </div>

        {/* Total Unattended */}
        <div className={`p-3.5 rounded-2xl border shadow-2xs flex items-center gap-3 ${
          currentDayStats.unattended > 0 
            ? 'bg-rose-50/50 border-rose-300 text-rose-900' 
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
            currentDayStats.unattended > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold">ยอดไม่มาเรียน</div>
            <div className="text-base font-bold">
              {currentDayStats.unattended} คน
            </div>
          </div>
        </div>
      </div>

      {/* Notification status bar */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-100 text-rose-900 border border-rose-200'
              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-700" />}
            {statusMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-700" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Student Roster Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Roster Controls: Search, Exception Filter, Quick Absent Multi-Picker */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/70">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, นามสกุล, เลขที่, รหัสนักเรียน..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Absence Tool & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-quick-absence-modal"
              onClick={() => {
                setSelectedStudentIdsForBatch([]);
                setShowQuickAbsentModal(true);
              }}
              className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="เปิดกล่องเช็คเฉพาะนักเรียนที่ ขาด/ลา/ป่วย แบบหลายคนพร้อมกัน"
            >
              <UserX className="w-4 h-4 text-rose-600" />
              <span>เช็คไม่มาเรียนแบบชุดด่วน</span>
            </button>

            {/* Layout Toggle */}
            <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setViewLayout('list')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewLayout === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองรายการแถว"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewLayout === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองการ์ด (Grid)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills (All, Unattended, Present, Absent, Leave, Sick) */}
        <div className="px-4 py-2.5 bg-slate-50/40 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            ตัวกรอง:
          </span>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            ทั้งหมด ({classStudents.length})
          </button>

          <button
            onClick={() => setStatusFilter('unattended')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 flex items-center gap-1 ${
              statusFilter === 'unattended'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>เฉพาะผู้ไม่มาเรียน ({currentDayStats.unattended})</span>
          </button>

          <button
            onClick={() => setStatusFilter('absent')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              statusFilter === 'absent'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200'
            }`}
          >
            ขาด ({currentDayStats.absent})
          </button>

          <button
            onClick={() => setStatusFilter('leave')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              statusFilter === 'leave'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white text-amber-700 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            ลากิจ ({currentDayStats.leave})
          </button>

          <button
            onClick={() => setStatusFilter('sick')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              statusFilter === 'sick'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-white text-sky-700 hover:bg-sky-50 border border-slate-200'
            }`}
          >
            ลาป่วย ({currentDayStats.sick})
          </button>

          <button
            onClick={() => setStatusFilter('present')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              statusFilter === 'present'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
            }`}
          >
            มาเรียน ({currentDayStats.present})
          </button>
        </div>

        {/* Student Roster Body: No Students State */}
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-700">ไม่พบรายชื่อนักเรียนตามเงื่อนไข</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? `ลองค้นหาด้วยคำค้นอื่น หรือล้างช่องค้นหา` : `ไม่มีนักเรียนในตัวกรองนี้`}
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="mt-3 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                ดูนักเรียนทั้งหมด ({classStudents.length} คน)
              </button>
            )}
          </div>
        ) : viewLayout === 'list' ? (
          /* List View */
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((st) => {
              const currentStatus = getStudentStatus(st.id);
              const rec = recordMap.get(st.id);
              const isMale = st.gender === 'M' || st.prefix.includes('ช.');

              return (
                <div
                  key={st.id}
                  id={`student-attendance-row-${st.id}`}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    currentStatus === 'absent'
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : currentStatus === 'leave'
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : currentStatus === 'sick'
                      ? 'bg-sky-50/40 hover:bg-sky-50/70'
                      : 'hover:bg-slate-50/70 bg-white'
                  }`}
                >
                  {/* Left Column: Number, Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Number Badge */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                      {st.studentNumber}
                    </div>

                    {/* Avatar with fallback */}
                    <div className="relative shrink-0">
                      {st.photoUrl ? (
                        <img
                          src={st.photoUrl}
                          alt={st.firstName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border ${
                            isMale
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-pink-100 text-pink-800 border-pink-200'
                          }`}
                        >
                          {st.firstName.charAt(0)}
                        </div>
                      )}

                      {/* Status indicator dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white flex items-center justify-center text-[8px] font-bold text-white ${
                          currentStatus === 'present'
                            ? 'bg-emerald-500'
                            : currentStatus === 'absent'
                            ? 'bg-rose-600'
                            : currentStatus === 'leave'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        {currentStatus === 'present'
                          ? '✓'
                          : currentStatus === 'absent'
                          ? 'ข'
                          : currentStatus === 'leave'
                          ? 'ล'
                          : 'ป'}
                      </span>
                    </div>

                    {/* Student Names & Historical Stats */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {st.prefix}{st.firstName} {st.lastName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {st.studentCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span>ห้อง {st.classKey}</span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-500">
                          สถิติเดือนนี้: <span className="text-emerald-700 font-semibold">มา {rec?.presentCount ?? 0}</span>,{' '}
                          <span className="text-rose-700 font-semibold">ขาด {rec?.absentCount ?? 0}</span>,{' '}
                          <span className="text-amber-700 font-semibold">ลา {rec?.leaveCount ?? 0}</span>,{' '}
                          <span className="text-sky-700 font-semibold">ป่วย {rec?.sickCount ?? 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 4 Status Action Buttons (มา, ขาด, ลา, ป่วย) */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    
                    {/* มาเรียน (✓) */}
                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'present')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        currentStatus === 'present'
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30 shadow-xs'
                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-transparent'
                      }`}
                      title="มาเรียน (✓)"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>มาเรียน</span>
                    </button>

                    {/* ขาดเรียน (ข) */}
                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'absent')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        currentStatus === 'absent'
                          ? 'bg-rose-600 text-white ring-2 ring-rose-600/30 shadow-xs scale-105'
                          : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-transparent'
                      }`}
                      title="ขาดเรียน (ข)"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>ขาด</span>
                    </button>

                    {/* ลากิจ (ล) */}
                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'leave')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        currentStatus === 'leave'
                          ? 'bg-amber-600 text-white ring-2 ring-amber-600/30 shadow-xs scale-105'
                          : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-transparent'
                      }`}
                      title="ลากิจ (ล)"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>ลา</span>
                    </button>

                    {/* ลาป่วย (ป) */}
                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'sick')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        currentStatus === 'sick'
                          ? 'bg-sky-600 text-white ring-2 ring-sky-600/30 shadow-xs scale-105'
                          : 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-transparent'
                      }`}
                      title="ลาป่วย (ป)"
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>ป่วย</span>
                    </button>

                    {/* ปุ่มล้างสถานะ/ยกเลิกเฉพาะคนนี้ */}
                    {rec?.days?.[currentDayNum] && (
                      <button
                        type="button"
                        onClick={() => handleClearStudentAttendance(st.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer ml-0.5"
                        title="ล้างสถานะการเช็คชื่อของนักเรียนคนนี้ (กลับเป็นยังไม่ได้เช็ค)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid Card View */
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredStudents.map((st) => {
              const currentStatus = getStudentStatus(st.id);
              const rec = recordMap.get(st.id);
              const isMale = st.gender === 'M' || st.prefix.includes('ช.');

              return (
                <div
                  key={st.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    currentStatus === 'absent'
                      ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300 shadow-2xs'
                      : currentStatus === 'leave'
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300 shadow-2xs'
                      : currentStatus === 'sick'
                      ? 'bg-sky-50/70 border-sky-300 ring-1 ring-sky-300 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Top: Number & Avatar */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                      {st.studentNumber}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {st.prefix}{st.firstName} {st.lastName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        รหัส: {st.studentCode}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge Indicator */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">สถานะวันนี้:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                        currentStatus === 'present'
                          ? 'bg-emerald-100 text-emerald-800'
                          : currentStatus === 'absent'
                          ? 'bg-rose-100 text-rose-800'
                          : currentStatus === 'leave'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {currentStatus === 'present'
                        ? '✓ มาเรียน'
                        : currentStatus === 'absent'
                        ? 'ข ขาดเรียน'
                        : currentStatus === 'leave'
                        ? 'ล ลากิจ'
                        : 'ป ลาป่วย'}
                    </span>
                  </div>

                  {/* 4 Status Buttons in Grid */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'present')}
                      className={`py-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                        currentStatus === 'present'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-600'
                      }`}
                      title="มาเรียน (✓)"
                    >
                      <span>✓</span>
                      <span className="text-[9px]">มา</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'absent')}
                      className={`py-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                        currentStatus === 'absent'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-rose-50 text-slate-600'
                      }`}
                      title="ขาดเรียน (ข)"
                    >
                      <span>ข</span>
                      <span className="text-[9px]">ขาด</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'leave')}
                      className={`py-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                        currentStatus === 'leave'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-amber-50 text-slate-600'
                      }`}
                      title="ลากิจ (ล)"
                    >
                      <span>ล</span>
                      <span className="text-[9px]">ลา</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetStudentStatus(st.id, 'sick')}
                      className={`py-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                        currentStatus === 'sick'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-sky-50 text-slate-600'
                      }`}
                      title="ลาป่วย (ป)"
                    >
                      <span>ป</span>
                      <span className="text-[9px]">ป่วย</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Roster Bottom Bar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            แสดงนักเรียน <b>{filteredStudents.length}</b> จากทั้งหมด <b>{classStudents.length}</b> คน ในห้อง {selectedClassKey}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              มาเรียน: {currentDayStats.present} คน
            </span>
            <span className="flex items-center gap-1 text-rose-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              ขาด/ลา/ป่วย: {currentDayStats.unattended} คน
            </span>
          </div>
        </div>
      </div>

      {/* Quick Absent Batch Modal */}
      {showQuickAbsentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    บันทึกนักเรียนที่ไม่มาเรียนแบบชุดด่วน
                  </h3>
                  <p className="text-xs text-slate-500">
                    ประจำ{formatThaiDateShort(selectedDate)} • ห้อง {selectedClassKey}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickAbsentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Select Status to Assign */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  1. เลือกสถานะที่ต้องการบันทึก:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchAbsentStatus('absent')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      batchAbsentStatus === 'absent'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-base mb-0.5">🔴</div>
                    <div>ขาดเรียน (ข)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchAbsentStatus('leave')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      batchAbsentStatus === 'leave'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-base mb-0.5">🟠</div>
                    <div>ลากิจ (ล)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchAbsentStatus('sick')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      batchAbsentStatus === 'sick'
                        ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-base mb-0.5">🔵</div>
                    <div>ลาป่วย (ป)</div>
                  </button>
                </div>
              </div>

              {/* Select Students */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    2. เลือกนักเรียนที่มีสถานะนี้ ({selectedStudentIdsForBatch.length} คนที่เลือก):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIdsForBatch(classStudents.map((s) => s.id))}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentIdsForBatch([])}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      ล้างที่เลือก
                    </button>
                  </div>
                </div>

                {/* Filter Input */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อ หรือเลขที่เพื่อหา..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                {/* Student Checkbox List */}
                <div className="border border-slate-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {classStudents
                    .filter((st) => {
                      if (!batchSearchQuery.trim()) return true;
                      const q = batchSearchQuery.toLowerCase();
                      return (
                        st.firstName.toLowerCase().includes(q) ||
                        st.lastName.toLowerCase().includes(q) ||
                        st.studentNumber.toString() === q ||
                        st.studentCode.includes(q)
                      );
                    })
                    .map((st) => {
                      const isChecked = selectedStudentIdsForBatch.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                            isChecked ? 'bg-indigo-50/60 font-semibold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIdsForBatch((prev) => [...prev, st.id]);
                                } else {
                                  setSelectedStudentIdsForBatch((prev) => prev.filter((id) => id !== st.id));
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="w-6 font-bold text-slate-500 text-[11px]">
                              #{st.studentNumber}
                            </span>
                            <span>
                              {st.prefix}{st.firstName} {st.lastName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {st.studentCode}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowQuickAbsentModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleApplyBatchAbsences}
                disabled={selectedStudentIdsForBatch.length === 0}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs ${
                  selectedStudentIdsForBatch.length > 0
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                บันทึกสถานะ ({selectedStudentIdsForBatch.length} คน)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Attendance Report Modal */}
      {selectedSubject && (
        <PrintAttendanceModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          subject={selectedSubject}
          classKey={selectedClassKey}
          academicYear={academicYear}
          semester={semester}
          month={currentMonthNum}
          monthName={selectedMonthObj.label}
          students={classStudents}
          attendanceRecords={attendanceRecords}
        />
      )}

      {/* Cancel Attendance Modal (เลือกวันที่ยกเลิกการเช็คชื่อ) */}
      {selectedSubject && (
        <CancelAttendanceModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          selectedDate={selectedDate}
          subject={selectedSubject}
          classKey={selectedClassKey}
          academicYear={academicYear}
          semester={semester}
          students={classStudents}
          onConfirmCancel={handleCancelAttendance}
        />
      )}
    </div>
  );
};
