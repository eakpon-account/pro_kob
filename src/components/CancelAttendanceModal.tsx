import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  X, 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HeartPulse, 
  Users, 
  BookOpen, 
  Check, 
  ShieldAlert,
  Search,
  Lock,
  Flag,
  Sun
} from 'lucide-react';
import { Student, Subject, StudentAttendanceRecord, AttendanceStatus } from '../types';
import { 
  formatThaiDateLong, 
  formatThaiDateShort, 
  isDateInFuture, 
  getThaiHoliday, 
  isWeekend 
} from '../utils/thaiHolidays';
import { storage } from '../services/storage';

interface CancelAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  subject: Subject;
  classKey: string;
  academicYear: string;
  semester: 1 | 2;
  students: Student[];
  onConfirmCancel: (targetDate: Date, targetStudentIds?: string[]) => void;
}

export const CancelAttendanceModal: React.FC<CancelAttendanceModalProps> = ({
  isOpen,
  onClose,
  selectedDate: initialSelectedDate,
  subject,
  classKey,
  academicYear,
  semester,
  students,
  onConfirmCancel,
}) => {
  // Target date to cancel
  const [targetDate, setTargetDate] = useState<Date>(initialSelectedDate);
  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);

  // Scope: 'all' = everyone in class, 'selected' = chosen students only
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Derive day number and month number for targetDate
  const targetDayNum = targetDate.getDate();
  const targetMonthNum = targetDate.getMonth() + 1;

  // Load records for the targetDate's month
  const targetMonthRecords = useMemo(() => {
    if (!isOpen) return [];
    const allRecords = storage.getAttendanceRecords();
    return allRecords.filter(
      (r) =>
        r.subjectId === subject.id &&
        r.classKey === classKey &&
        r.academicYear === academicYear &&
        r.semester === semester &&
        r.month === targetMonthNum
    );
  }, [isOpen, subject.id, classKey, academicYear, semester, targetMonthNum]);

  // Map student ID to their record for target date
  const targetRecordsMap = useMemo(() => {
    const map = new Map<string, StudentAttendanceRecord>();
    targetMonthRecords.forEach((r) => map.set(r.studentId, r));
    return map;
  }, [targetMonthRecords]);

  // Statistics on target date
  const targetDateStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let sick = 0;
    let recorded = 0;

    students.forEach((st) => {
      const rec = targetRecordsMap.get(st.id);
      const stStatus = rec?.days?.[targetDayNum];
      if (stStatus && stStatus !== 'unrecorded') {
        recorded++;
        if (stStatus === 'present') present++;
        else if (stStatus === 'absent') absent++;
        else if (stStatus === 'leave') leave++;
        else if (stStatus === 'sick') sick++;
      }
    });

    return { present, absent, leave, sick, recorded, total: students.length };
  }, [students, targetRecordsMap, targetDayNum]);

  // Check holiday/weekend status of target date
  const targetHoliday = useMemo(() => {
    return getThaiHoliday(targetDate.getFullYear(), targetMonthNum, targetDayNum);
  }, [targetDate, targetMonthNum, targetDayNum]);

  const isTargetWeekend = useMemo(() => {
    return isWeekend(targetDate);
  }, [targetDate]);

  // Check if date is in the future
  const isTargetFuture = useMemo(() => {
    return isDateInFuture(targetDate, today);
  }, [targetDate, today]);

  // Students list with current status on target date
  const studentsWithStatus = useMemo(() => {
    return students
      .map((st) => {
        const rec = targetRecordsMap.get(st.id);
        const status = rec?.days?.[targetDayNum] || 'unrecorded';
        return {
          ...st,
          currentStatus: status as AttendanceStatus,
        };
      })
      .sort((a, b) => a.studentNumber - b.studentNumber);
  }, [students, targetRecordsMap, targetDayNum]);

  // Filtered students for scope selection
  const filteredStudents = useMemo(() => {
    return studentsWithStatus.filter((st) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        st.studentCode.toLowerCase().includes(q) ||
        st.firstName.toLowerCase().includes(q) ||
        st.lastName.toLowerCase().includes(q) ||
        st.studentNumber.toString() === q
      );
    });
  }, [studentsWithStatus, searchQuery]);

  // Quick date change helper
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    const newD = new Date(y, m - 1, d);
    if (isDateInFuture(newD, today)) {
      alert('ไม่สามารถเลือกวันล่วงหน้าเกินกว่าวันที่ปัจจุบันได้');
      return;
    }
    setTargetDate(newD);
    setSelectedStudentIds([]);
  };

  // Toggle student selection
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Select all recorded students
  const handleSelectAllRecorded = () => {
    const recordedIds = studentsWithStatus
      .filter((s) => s.currentStatus !== 'unrecorded')
      .map((s) => s.id);
    setSelectedStudentIds(recordedIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
  };

  // Confirm cancel action
  const handleExecuteCancel = () => {
    if (isTargetFuture) {
      alert('ไม่สามารถยกเลิกการเช็คชื่อของวันล่วงหน้าได้');
      return;
    }

    if (targetDateStats.recorded === 0 && scope === 'all') {
      const proceed = window.confirm(
        `วันที่ ${formatThaiDateShort(targetDate)} ยังไม่มีประวัติการเช็คชื่อ ต้องการดำเนินการต่อเพื่อรีเซ็ตหรือไม่?`
      );
      if (!proceed) return;
    }

    if (scope === 'selected' && selectedStudentIds.length === 0) {
      alert('กรุณาเลือกนักเรียนอย่างน้อย 1 คนที่ต้องการยกเลิกการเช็คชื่อ');
      return;
    }

    setIsProcessing(true);
    try {
      onConfirmCancel(
        targetDate,
        scope === 'selected' ? selectedStudentIds : undefined
      );
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Format date input string YYYY-MM-DD
  const dateInputStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const maxDateInputStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 text-rose-300">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                ยกเลิกการเช็คชื่อนักเรียน (Reset Attendance)
              </h2>
              <p className="text-xs text-rose-200 mt-0.5">
                เลือกวันที่ต้องการยกเลิก เพื่อล้างข้อมูลการมาเรียนและคำนวณสถิติใหม่
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition-colors"
            title="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Class & Subject Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-slate-700">รายวิชา:</span>
              <span className="font-bold text-slate-900">
                {subject.code} {subject.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                ห้อง <strong className="text-slate-800">{classKey}</strong> ({students.length} คน)
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                ปีการศึกษา <strong className="text-slate-800">{academicYear}</strong> เทอม {semester}
              </span>
            </div>
          </div>

          {/* Section 1: Date Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-rose-600" />
                <span>1. เลือกวันที่ต้องการยกเลิกการเช็คชื่อ</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                (ไม่สามารถเลือกวันล่วงหน้าได้)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Input */}
              <div>
                <input
                  type="date"
                  value={dateInputStr}
                  max={maxDateInputStr}
                  onChange={handleDateChange}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-colors cursor-pointer"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTargetDate(initialSelectedDate)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    targetDate.toDateString() === initialSelectedDate.toDateString()
                      ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  วันที่เลือกปัจจุบัน ({formatThaiDateShort(initialSelectedDate)})
                </button>

                <button
                  type="button"
                  onClick={() => setTargetDate(new Date())}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    targetDate.toDateString() === today.toDateString()
                      ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  วันนี้
                </button>

                <button
                  type="button"
                  onClick={() => setTargetDate(yesterday)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    targetDate.toDateString() === yesterday.toDateString()
                      ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  เมื่อวาน
                </button>
              </div>
            </div>

            {/* Formatted Date Banner with Holiday / Weekend Info */}
            <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>{formatThaiDateLong(targetDate)}</span>
                {targetDate.toDateString() === today.toDateString() && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    (วันนี้)
                  </span>
                )}
              </div>

              {targetHoliday ? (
                <div className="flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                  <Flag className="w-3 h-3 text-amber-600" />
                  <span>{targetHoliday.name}</span>
                </div>
              ) : isTargetWeekend ? (
                <div className="flex items-center gap-1 text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                  <Sun className="w-3 h-3 text-rose-600" />
                  <span>วันหยุดสุดสัปดาห์</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Section 2: Attendance Status on Target Date */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. สถานะการเช็คชื่อในวันที่เลือก
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-semibold text-slate-500">บันทึกแล้ว</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {targetDateStats.recorded} / {targetDateStats.total} คน
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] font-semibold text-emerald-700">มาเรียน (✓)</div>
                <div className="text-sm font-bold text-emerald-900 mt-0.5">
                  {targetDateStats.present} คน
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-[10px] font-semibold text-rose-700">ขาดเรียน (ข)</div>
                <div className="text-sm font-bold text-rose-900 mt-0.5">
                  {targetDateStats.absent} คน
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-semibold text-amber-700">ลากิจ (ล)</div>
                <div className="text-sm font-bold text-amber-900 mt-0.5">
                  {targetDateStats.leave} คน
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                <div className="text-[10px] font-semibold text-sky-700">ลาป่วย (ป)</div>
                <div className="text-sm font-bold text-sky-900 mt-0.5">
                  {targetDateStats.sick} คน
                </div>
              </div>
            </div>

            {targetDateStats.recorded === 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>วันที่เลือกยังไม่มีข้อมูลการเช็คชื่อ หรือถูกยกเลิกไปแล้ว</span>
              </div>
            )}
          </div>

          {/* Section 3: Scope of Cancellation */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              3. ขอบเขตการยกเลิกการเช็คชื่อ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    ยกเลิกทั้งห้องเรียน (ทุกคน)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    ล้างสถานะของนักเรียนทั้งหมด {students.length} คน ในวันนี้กลับเป็นยังไม่ได้เช็ค
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('selected')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors cursor-pointer ${
                  scope === 'selected'
                    ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    เลือกล้างเฉพาะนักเรียนบางคน
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    เลือกเฉพาะนักเรียนที่ต้องการยกเลิกข้อมูล (เลือกแล้ว {selectedStudentIds.length} คน)
                  </div>
                </div>
              </button>
            </div>

            {/* If Scope === 'selected': Show student selector list */}
            {scope === 'selected' && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ, เลขที่..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllRecorded}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      เลือกผู้ที่มีประวัติเช็คชื่อทั้งหมด
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-slate-500 hover:underline"
                    >
                      ล้างการเลือก
                    </button>
                  </div>
                </div>

                {/* Students list */}
                <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 p-1">
                  {filteredStudents.map((st) => {
                    const isChecked = selectedStudentIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer text-xs ${
                          isChecked ? 'bg-rose-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(st.id)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span className="w-5 text-center font-bold text-slate-500">
                            {st.studentNumber}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {st.prefix}{st.firstName} {st.lastName}
                          </span>
                        </div>

                        {/* Current status tag */}
                        <div className="flex items-center gap-1">
                          {st.currentStatus === 'present' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              มาเรียน
                            </span>
                          ) : st.currentStatus === 'absent' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              ขาดเรียน
                            </span>
                          ) : st.currentStatus === 'leave' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              ลากิจ
                            </span>
                          ) : st.currentStatus === 'sick' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                              ลาป่วย
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100">
                              ยังไม่เช็ค
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Warning Note */}
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ข้อควรระวัง:</span> เมื่อยกเลิกการเช็คชื่อ ข้อมูลการมาเรียนในวันที่เลือกจะถูกล้างกลับเป็นค่าว่าง (ยังไม่ได้เช็ค) และระบบจะคำนวณยอดรวมวันมาเรียน ร้อยละการมาเรียนใหม่โดยอัตโนมัติ
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            ปิด / ยกเลิก
          </button>

          <button
            type="button"
            id="btn-confirm-cancel-attendance"
            onClick={handleExecuteCancel}
            disabled={isProcessing || isTargetFuture}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {scope === 'all'
                ? `ยืนยันยกเลิกการเช็คชื่อวันที่ ${targetDayNum}`
                : `ยืนยันยกเลิกให้นักเรียน (${selectedStudentIds.length} คน)`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
