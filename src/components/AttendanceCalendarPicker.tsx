import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Sun,
  Flag,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  getThaiHoliday, 
  isWeekend, 
  isDateInFuture, 
  formatThaiDateLong, 
  formatThaiDateShort,
  ThaiHoliday 
} from '../utils/thaiHolidays';
import { StudentAttendanceRecord } from '../types';

interface AttendanceCalendarPickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  maxDate?: Date; // Default to today
  attendanceRecords?: StudentAttendanceRecord[];
  classStudentCount?: number;
}

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const WEEK_DAYS = [
  { short: 'อา.', full: 'วันอาทิตย์', isWeekend: true },
  { short: 'จ.', full: 'วันจันทร์', isWeekend: false },
  { short: 'อ.', full: 'วันอังคาร', isWeekend: false },
  { short: 'พ.', full: 'วันพุธ', isWeekend: false },
  { short: 'พฤ.', full: 'วันพฤหัสบดี', isWeekend: false },
  { short: 'ศ.', full: 'วันศุกร์', isWeekend: false },
  { short: 'ส.', full: 'วันเสาร์', isWeekend: true },
];

export const AttendanceCalendarPicker: React.FC<AttendanceCalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  maxDate = new Date(),
  attendanceRecords = [],
  classStudentCount = 0,
}) => {
  // Current view month & year in calendar
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth()); // 0-11

  // Set today reference
  const today = useMemo(() => new Date(), []);

  // Jump to today
  const handleGoToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelectDate(now);
  };

  // Previous month
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  // Next month (prevent going too far into future if desired, but allow browsing with disabled dates)
  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Compute days in current view month
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 6 = Sat

    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      holiday: ThaiHoliday | null;
      isFuture: boolean;
      isSelected: boolean;
      isToday: boolean;
      dayIndex: number;
    }> = [];

    // Padding for previous month days
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(viewYear, viewMonth - 1, prevMonthLastDay - i);
      const isFut = isDateInFuture(prevDate, maxDate);
      days.push({
        date: prevDate,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isWeekend: isWeekend(prevDate),
        holiday: getThaiHoliday(prevDate.getFullYear(), prevDate.getMonth() + 1, prevDate.getDate()),
        isFuture: isFut,
        isSelected: false,
        isToday: false,
        dayIndex: prevDate.getDate(),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const currentDate = new Date(viewYear, viewMonth, d);
      const isFut = isDateInFuture(currentDate, maxDate);
      const isSel = 
        selectedDate.getFullYear() === viewYear &&
        selectedDate.getMonth() === viewMonth &&
        selectedDate.getDate() === d;
      const isTod = 
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === d;

      days.push({
        date: currentDate,
        dayNumber: d,
        isCurrentMonth: true,
        isWeekend: isWeekend(currentDate),
        holiday: getThaiHoliday(viewYear, viewMonth + 1, d),
        isFuture: isFut,
        isSelected: isSel,
        isToday: isTod,
        dayIndex: d,
      });
    }

    // Padding for next month days to complete 7-day grid
    const remainingDays = 42 - days.length; // 6 rows of 7
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        const nextDate = new Date(viewYear, viewMonth + 1, i);
        const isFut = isDateInFuture(nextDate, maxDate);
        days.push({
          date: nextDate,
          dayNumber: i,
          isCurrentMonth: false,
          isWeekend: isWeekend(nextDate),
          holiday: getThaiHoliday(nextDate.getFullYear(), nextDate.getMonth() + 1, i),
          isFuture: isFut,
          isSelected: false,
          isToday: false,
          dayIndex: i,
        });
      }
    }

    return days;
  }, [viewYear, viewMonth, selectedDate, maxDate, today]);

  // Selected date holiday or weekend status info
  const selectedDateHoliday = useMemo(() => {
    return getThaiHoliday(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
  }, [selectedDate]);

  const isSelectedDateWeekend = useMemo(() => {
    return isWeekend(selectedDate);
  }, [selectedDate]);

  // Status for selected date across records
  const dayIndexForSelected = selectedDate.getDate();
  const selectedDayStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let sick = 0;
    let recorded = 0;

    attendanceRecords.forEach((r) => {
      const status = r.days?.[dayIndexForSelected];
      if (status === 'present') { present++; recorded++; }
      else if (status === 'absent') { absent++; recorded++; }
      else if (status === 'leave') { leave++; recorded++; }
      else if (status === 'sick') { sick++; recorded++; }
    });

    return { present, absent, leave, sick, recorded };
  }, [attendanceRecords, dayIndexForSelected]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Calendar Header */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base tracking-tight">
              {THAI_MONTH_NAMES[viewMonth]} {viewYear + 543}
            </h3>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            เลือกวันที่เช็คชื่อ (ไม่เกินวันที่ {today.getDate()} {THAI_MONTH_NAMES[today.getMonth()]})
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            title="กลับสู่วันนี้"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="เดือนถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend & Note for Holidays / Weekends */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-rose-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200"></span>
            เสาร์ - อาทิตย์
          </span>
          <span className="flex items-center gap-1 text-amber-700 font-medium">
            <Flag className="w-3 h-3 text-amber-600" />
            วันหยุดนักขัตฤกษ์
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>วันล่วงหน้า (ล็อค)</span>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b border-slate-200/60 bg-slate-100/50 text-center py-2">
        {WEEK_DAYS.map((w, idx) => (
          <div
            key={idx}
            className={`text-xs font-bold ${
              w.isWeekend ? 'text-rose-600' : 'text-slate-700'
            }`}
          >
            {w.short}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 p-px">
        {calendarGrid.map((item, idx) => {
          const isClickable = !item.isFuture;
          const isSelected = item.isSelected;
          const isHoliday = !!item.holiday;
          const isWk = item.isWeekend;

          // Attendance quick indicator for this day (if in current month & not future)
          let dayHasAbsent = false;
          let dayRecorded = false;
          if (item.isCurrentMonth && !item.isFuture) {
            attendanceRecords.forEach((r) => {
              const st = r.days?.[item.dayNumber];
              if (st && st !== 'unrecorded') {
                dayRecorded = true;
                if (st === 'absent' || st === 'leave' || st === 'sick') {
                  dayHasAbsent = true;
                }
              }
            });
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={!isClickable}
              onClick={() => {
                if (isClickable) {
                  onSelectDate(item.date);
                }
              }}
              title={
                item.isFuture
                  ? `🔒 วันที่ ${item.dayNumber} เป็นวันล่วงหน้า (ไม่สามารถเลือกได้)`
                  : item.holiday
                  ? `🚩 ${item.holiday.name}`
                  : item.isWeekend
                  ? `เสาร์-อาทิตย์`
                  : `เลือกวันที่ ${item.dayNumber}`
              }
              className={`min-h-[58px] p-1.5 flex flex-col justify-between text-left transition-all relative select-none ${
                !item.isCurrentMonth
                  ? 'bg-slate-50 text-slate-300 opacity-60'
                  : item.isFuture
                  ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed'
                  : isSelected
                  ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-600 ring-offset-1 z-10 shadow-sm'
                  : isHoliday
                  ? 'bg-amber-50/90 hover:bg-amber-100 text-amber-950 border border-amber-300/60'
                  : isWk
                  ? 'bg-rose-50/70 hover:bg-rose-100 text-rose-950 border border-rose-200/50'
                  : 'bg-white hover:bg-indigo-50/70 text-slate-800'
              }`}
            >
              {/* Day Number and Badges */}
              <div className="flex items-start justify-between w-full">
                <span
                  className={`text-xs font-semibold rounded-md w-5 h-5 flex items-center justify-center ${
                    isSelected
                      ? 'bg-white text-indigo-700 font-bold'
                      : item.isToday
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400'
                      : isHoliday
                      ? 'text-amber-800 font-bold'
                      : isWk
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  {item.dayNumber}
                </span>

                {/* Status Icons */}
                <div className="flex items-center gap-0.5">
                  {item.isFuture && (
                    <Lock className="w-3 h-3 text-slate-400" />
                  )}
                  {isHoliday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-amber-300" title={item.holiday?.name} />
                  )}
                  {dayRecorded && !item.isFuture && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        dayHasAbsent ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      title={dayHasAbsent ? 'มีนักเรียนขาด/ลา/ป่วย' : 'มาเรียนครบ'}
                    />
                  )}
                </div>
              </div>

              {/* Holiday / Weekend Caption or Attendance Tag */}
              <div className="mt-1 overflow-hidden">
                {isHoliday ? (
                  <p
                    className={`text-[9px] leading-tight truncate font-medium ${
                      isSelected ? 'text-indigo-100' : 'text-amber-700'
                    }`}
                  >
                    {item.holiday?.name}
                  </p>
                ) : isWk && item.isCurrentMonth ? (
                  <p
                    className={`text-[9px] leading-tight font-medium ${
                      isSelected ? 'text-indigo-100' : 'text-rose-600'
                    }`}
                  >
                    {item.date.getDay() === 0 ? 'วันอาทิตย์' : 'วันเสาร์'}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Date Summary & Holiday Alert Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-slate-500">วันที่เลือกบันทึก:</div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>{formatThaiDateLong(selectedDate)}</span>
              {selectedDate.getDate() === today.getDate() &&
                selectedDate.getMonth() === today.getMonth() &&
                selectedDate.getFullYear() === today.getFullYear() && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    (วันนี้)
                  </span>
                )}
            </div>
          </div>

          {/* Holiday / Weekend Tag */}
          {selectedDateHoliday ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold">
              <Flag className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>{selectedDateHoliday.name}</span>
            </div>
          ) : isSelectedDateWeekend ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 text-xs font-semibold">
              <Sun className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span>วันหยุดสุดสัปดาห์ (โรงเรียนปิด)</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
