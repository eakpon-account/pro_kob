import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Flag, 
  Sun, 
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Student, Subject, StudentAttendanceRecord } from '../types';
import { storage } from '../services/storage';
import { 
  getThaiHoliday, 
  isWeekend, 
  ThaiHoliday 
} from '../utils/thaiHolidays';

interface PrintAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  classKey: string;
  academicYear: string;
  semester: 1 | 2;
  month: number;
  monthName: string;
  students: Student[];
  attendanceRecords: StudentAttendanceRecord[];
}

const THAI_DAY_OF_WEEK_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export const PrintAttendanceModal: React.FC<PrintAttendanceModalProps> = ({
  isOpen,
  onClose,
  subject,
  classKey,
  academicYear,
  semester,
  month,
  monthName,
  students,
  attendanceRecords,
}) => {
  const schoolSettings = storage.getSchoolSettings();
  const printRef = useRef<HTMLDivElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);

  // Map student ID to record
  const recordMap = new Map<string, StudentAttendanceRecord>();
  attendanceRecords.forEach((r) => recordMap.set(r.studentId, r));

  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);

  // Compute Christian Era (CE) year from academic year for accurate holiday/weekend calculations
  const parsedYear = parseInt(academicYear, 10);
  const targetYearCE = parsedYear > 2400 
    ? parsedYear - 543 
    : parsedYear || new Date().getFullYear();

  // Number of days to display (Standard 1 to 30)
  const totalDays = 30;
  const dayIndices = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Compute Holiday and Weekend details for each day 1..30
  const dayMetaList = dayIndices.map((day) => {
    const dateObj = new Date(targetYearCE, month - 1, day);
    const holiday = getThaiHoliday(targetYearCE, month, day);
    const isWk = isWeekend(dateObj);
    const dayOfWeekIdx = dateObj.getDay(); // 0 = Sun, 6 = Sat
    const dayOfWeekShort = THAI_DAY_OF_WEEK_SHORT[dayOfWeekIdx];

    return {
      day,
      dateObj,
      holiday,
      isWeekend: isWk,
      dayOfWeekIdx,
      dayOfWeekShort,
    };
  });

  // Collect all holidays occurring in this month
  const monthHolidays = dayMetaList
    .filter((dm) => !!dm.holiday)
    .map((dm) => ({
      day: dm.day,
      holiday: dm.holiday as ThaiHoliday,
    }));

  // Determine which days have any recorded attendance in the class
  const dayRecordedMap: Record<number, boolean> = {};
  const dailyPresent: Record<number, number> = {};
  const dailyAbsent: Record<number, number> = {};
  const dailyLeave: Record<number, number> = {};
  const dailySick: Record<number, number> = {};

  dayIndices.forEach((d) => {
    let hasRecordOnDay = false;
    let p = 0;
    let a = 0;
    let l = 0;
    let s = 0;

    sortedStudents.forEach((st) => {
      const rec = recordMap.get(st.id);
      const status = rec?.days?.[d];
      if (status && status !== 'unrecorded') {
        hasRecordOnDay = true;
        if (status === 'present') p++;
        else if (status === 'absent') a++;
        else if (status === 'leave') l++;
        else if (status === 'sick') s++;
      }
    });

    dayRecordedMap[d] = hasRecordOnDay;
    dailyPresent[d] = p;
    dailyAbsent[d] = a;
    dailyLeave[d] = l;
    dailySick[d] = s;
  });

  // Calculate per-student stats counting ONLY recorded days (days not checked = '-' and excluded from stats)
  const studentStats = sortedStudents.map((st) => {
    const rec = recordMap.get(st.id);
    let present = 0;
    let absent = 0;
    let leave = 0;
    let sick = 0;

    dayIndices.forEach((d) => {
      const s = rec?.days?.[d];
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'leave') leave++;
      else if (s === 'sick') sick++;
      // unrecorded days or '-' are ignored!
    });

    const recordedDays = present + absent + leave + sick;
    const rate = recordedDays > 0 ? ((present / recordedDays) * 100).toFixed(1) : '-';

    return {
      student: st,
      present,
      absent,
      leave,
      sick,
      recordedDays,
      rate,
    };
  });

  // Overall class statistics (based on recorded days only)
  const totalClassPresent = Object.values(dailyPresent).reduce((acc, v) => acc + v, 0);
  const totalClassAbsent = Object.values(dailyAbsent).reduce((acc, v) => acc + v, 0);
  const totalClassLeave = Object.values(dailyLeave).reduce((acc, v) => acc + v, 0);
  const totalClassSick = Object.values(dailySick).reduce((acc, v) => acc + v, 0);
  const totalClassRecordedSlots = totalClassPresent + totalClassAbsent + totalClassLeave + totalClassSick;
  const classAvgRate = totalClassRecordedSlots > 0
    ? ((totalClassPresent / totalClassRecordedSlots) * 100).toFixed(1)
    : '-';
  const totalTaughtDaysInMonth = Object.values(dayRecordedMap).filter(Boolean).length;

  // Build complete standalone HTML document for printing and downloading
  const generateStandaloneHtml = (): string => {
    const docTitle = `แบบรายงานการเช็คชื่อ_${subject.code}_ห้อง${classKey}_${monthName}_${academicYear}`;
    const schoolName = schoolSettings.schoolName || 'โรงเรียนสาธิตวิทยาคม';
    const affiliation = schoolSettings.affiliation || 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)';

    // Generate Table Header Rows
    const thNumberCols = dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
      const isHoliday = !!holiday;
      let style = 'background:#f8fafc; color:#475569;';
      if (isHoliday) {
        style = 'background:#fde68a; color:#78350f; font-weight:800; border-color:#d97706;';
      } else if (isWk) {
        style = 'background:#fecdd3; color:#881337; font-weight:800; border-color:#e11d48;';
      } else if (dayRecordedMap[day]) {
        style = 'background:#e2e8f0; color:#0f172a; font-weight:800;';
      }
      return `<th style="border:1px solid #475569; padding:2px 1px; width:20px; font-size:9.5px; ${style}">${day}</th>`;
    }).join('');

    const thDayOfWeekCols = dayMetaList.map(({ day, holiday, isWeekend: isWk, dayOfWeekShort }) => {
      const isHoliday = !!holiday;
      let style = 'background:#f8fafc; color:#64748b;';
      if (isHoliday) {
        style = 'background:#fef3c7; color:#92400e; font-weight:bold; border-color:#d97706;';
      } else if (isWk) {
        style = 'background:#ffe4e6; color:#9f1239; font-weight:bold; border-color:#e11d48;';
      }
      return `<th style="border:1px solid #475569; padding:2px 1px; font-size:8px; ${style}">${isHoliday ? 'หยุด' : dayOfWeekShort}</th>`;
    }).join('');

    // Generate Student Rows
    const studentRows = studentStats.map((item, idx) => {
      const { student: st, present, absent, leave, sick, recordedDays, rate } = item;
      const rec = recordMap.get(st.id);
      const bg = idx % 2 === 1 ? 'background:#f8fafc;' : 'background:#ffffff;';

      const dayCells = dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
        const status = rec?.days?.[day];
        const isHoliday = !!holiday;
        let char = '-';
        let cellColor = '#94a3b8';
        let cellBg = '';

        if (isHoliday) {
          cellBg = 'background:#fef3c7;';
          cellColor = '#d97706;';
        } else if (isWk) {
          cellBg = 'background:#ffe4e6;';
          cellColor = '#f43f5e;';
        }

        if (status === 'present') {
          char = '✓';
          cellColor = '#047857; font-weight:bold;';
        } else if (status === 'absent') {
          char = 'ข';
          cellColor = '#b91c1c; font-weight:bold;';
          cellBg = 'background:#fee2e2;';
        } else if (status === 'leave') {
          char = 'ล';
          cellColor = '#b45309; font-weight:bold;';
          cellBg = 'background:#fef3c7;';
        } else if (status === 'sick') {
          char = 'ป';
          cellColor = '#0369a1; font-weight:bold;';
          cellBg = 'background:#e0f2fe;';
        }

        return `<td style="border:1px solid #475569; padding:2px 1px; font-size:9.5px; text-align:center; color:${cellColor}; ${cellBg}">${char}</td>`;
      }).join('');

      return `
        <tr style="${bg}">
          <td style="border:1px solid #475569; padding:2px 2px; font-weight:bold; text-align:center;">${st.studentNumber}</td>
          <td style="border:1px solid #475569; padding:2px 2px; font-family:monospace; font-size:9px; text-align:center; color:#475569;">${st.studentCode}</td>
          <td style="border:1px solid #475569; padding:2px 6px; text-align:left; white-space:nowrap; font-weight:500;">${st.prefix}${st.firstName} ${st.lastName}</td>
          ${dayCells}
          <td style="border:1px solid #475569; padding:2px 1px; font-weight:bold; text-align:center; color:#065f46; background:#ecfdf5;">${present}</td>
          <td style="border:1px solid #475569; padding:2px 1px; font-weight:bold; text-align:center; color:#991b1b; background:#fef2f2;">${absent}</td>
          <td style="border:1px solid #475569; padding:2px 1px; font-weight:600; text-align:center; color:#92400e; background:#fffbeb;">${leave}</td>
          <td style="border:1px solid #475569; padding:2px 1px; font-weight:600; text-align:center; color:#075985; background:#f0f9ff;">${sick}</td>
          <td style="border:1px solid #475569; padding:2px 2px; font-weight:bold; text-align:center; background:#f1f5f9;">${recordedDays}</td>
          <td style="border:1px solid #475569; padding:2px 2px; font-weight:800; text-align:center; background:#e2e8f0;">${rate !== '-' ? `${rate}%` : '-'}</td>
        </tr>
      `;
    }).join('');

    // Generate Holiday List Box if any
    const holidayNotice = monthHolidays.length > 0 ? `
      <div style="margin-top:6px; margin-bottom:6px; padding:4px 8px; border-radius:6px; background:#fffbeb; border:1px solid #fde68a; font-size:10px; color:#78350f;">
        <strong>🚩 วันหยุดนักขัตฤกษ์ในเดือนนี้:</strong>
        ${monthHolidays.map((h) => `<span style="margin-left:8px;"><strong>วันที่ ${h.day}:</strong> ${h.holiday.name}</span>`).join('')}
      </div>
    ` : '';

    // Daily summary footers
    const dailyPresentCols = dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
      let bg = '';
      if (holiday) bg = 'background:#fde68a;';
      else if (isWk) bg = 'background:#fecdd3;';
      return `<td style="border:1px solid #475569; padding:3px 1px; text-align:center; font-weight:bold; color:#065f46; ${bg}">${dayRecordedMap[day] ? dailyPresent[day] : '-'}</td>`;
    }).join('');

    const dailyOtherCols = dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
      const notPresentCount = (dailyAbsent[day] || 0) + (dailyLeave[day] || 0) + (dailySick[day] || 0);
      let bg = '';
      if (holiday) bg = 'background:#fde68a;';
      else if (isWk) bg = 'background:#fecdd3;';
      return `<td style="border:1px solid #475569; padding:3px 1px; text-align:center; font-weight:bold; color:#991b1b; ${bg}">${dayRecordedMap[day] ? notPresentCount : '-'}</td>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 5mm 6mm 5mm 6mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: 'Sarabun', 'TH Sarabun New', system-ui, -apple-system, sans-serif;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 20px;
      background: #0f172a;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .screen-toolbar button {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #4338ca;
    }
    .btn-close {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-close:hover {
      background: #475569;
    }
    .print-container {
      max-width: 297mm;
      margin: 16px auto;
      padding: 20px 24px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print, .screen-toolbar {
        display: none !important;
      }
      .print-container {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <!-- Floating Screen Control Bar (Hidden on Print) -->
  <div class="screen-toolbar no-print">
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:15px; font-weight:bold;">🖨️ หน้าต่างพิมพ์รายงาน (A4 แนวนอน)</span>
      <span style="font-size:12px; color:#94a3b8;">${subject.code} ${subject.name} (ห้อง ${classKey}) • ${monthName}</span>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <button class="btn-print" onclick="window.print();">
        <span>🖨️ สั่งพิมพ์เอกสาร / บันทึก PDF (Print)</span>
      </button>
      <button class="btn-close" onclick="window.close();">
        <span>✕ ปิดหน้านี้</span>
      </button>
    </div>
  </div>

  <div class="print-container">
    <!-- Header -->
    <div style="text-align:center; padding-bottom:8px; border-bottom:2px solid #1e293b;">
      <h1 style="margin:0; font-size:17px; font-weight:800; color:#0f172a;">${schoolName}</h1>
      <p style="margin:2px 0 0 0; font-size:11px; color:#475569;">${affiliation}</p>
      <h2 style="margin:4px 0 0 0; font-size:14px; font-weight:700; color:#1e293b;">
        แบบรายงานการเช็คชื่อและบันทึกเวลาเรียนประจำรายวิชา (บพ.)
      </h2>

      <div style="margin-top:8px; padding-top:6px; border-top:1px solid #cbd5e1; display:grid; grid-template-columns: repeat(4, 1fr); gap:4px 12px; font-size:11px; text-align:left;">
        <div><strong>รหัสวิชา:</strong> ${subject.code}</div>
        <div style="grid-column: span 2;"><strong>รายวิชา:</strong> ${subject.name} (${subject.credits} นก.)</div>
        <div><strong>ระดับชั้น/ห้อง:</strong> ${classKey}</div>
        <div><strong>ครูผู้สอน:</strong> ${subject.teacherName || '-'}</div>
        <div><strong>ประจำเดือน:</strong> ${monthName}</div>
        <div><strong>ภาคเรียน/ปีการศึกษา:</strong> ${semester}/${academicYear}</div>
        <div><strong>จำนวนนักเรียน:</strong> ${students.length} คน</div>
      </div>
    </div>

    <!-- Legend -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px; margin-bottom:4px; font-size:10px; color:#334155;">
      <div style="display:flex; align-items:center; gap:8px;">
        <strong>สัญลักษณ์:</strong>
        <span style="color:#047857; font-weight:bold;">✓ = มา</span>
        <span style="color:#b91c1c; font-weight:bold;">ข = ขาด</span>
        <span style="color:#b45309; font-weight:bold;">ล = ลากิจ</span>
        <span style="color:#0369a1; font-weight:bold;">ป = ลาป่วย</span>
        <span style="color:#64748b; font-weight:bold;">- = ไม่ได้เช็ค/ไม่นับรวม</span>
        <span style="color:#cbd5e1;">|</span>
        <span style="background:#fde68a; color:#78350f; font-weight:bold; padding:1px 4px; border-radius:3px; border:1px solid #d97706;">สีส้ม = วันหยุดนักขัตฤกษ์</span>
        <span style="background:#fecdd3; color:#881337; font-weight:bold; padding:1px 4px; border-radius:3px; border:1px solid #e11d48;">สีชมพู = วันเสาร์-อาทิตย์</span>
      </div>
      <div style="color:#64748b;">* วันที่แสดงเครื่องหมาย - ไม่นำมาคำนวณสถิติ</div>
    </div>

    ${holidayNotice}

    <!-- Table -->
    <table style="border:1px solid #475569; margin-top:4px;">
      <thead>
        <tr style="background:#f1f5f9; color:#0f172a; font-weight:bold;">
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:22px;">ที่</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:44px;">รหัส</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 6px; text-align:left; min-width:130px;">ชื่อ - สกุล</th>
          ${thNumberCols}
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:24px; color:#065f46; background:#d1fae5;">มา</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:24px; color:#991b1b; background:#fee2e2;">ขาด</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:22px; color:#92400e; background:#fef3c7;">ลา</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:22px; color:#075985; background:#e0f2fe;">ป่วย</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:28px; background:#e2e8f0;">รวม</th>
          <th rowspan="2" style="border:1px solid #475569; padding:2px 2px; width:34px; background:#e2e8f0;">% มา</th>
        </tr>
        <tr>
          ${thDayOfWeekCols}
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9; font-weight:bold; font-size:9.5px;">
          <td colspan="3" style="border:1px solid #475569; padding:3px 6px; text-align:right;">ยอดมาเรียนแต่ละวัน (✓):</td>
          ${dailyPresentCols}
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:800; color:#065f46; background:#a7f3d0;">${totalClassPresent}</td>
          <td colspan="5" style="border:1px solid #475569; padding:3px 2px; text-align:center; color:#475569; background:#f1f5f9;">รวมมาเรียน</td>
        </tr>
        <tr style="background:#f8fafc; font-weight:bold; font-size:9.5px;">
          <td colspan="3" style="border:1px solid #475569; padding:3px 6px; text-align:right; color:#991b1b;">ยอดขาด / ลา / ป่วย แต่ละวัน:</td>
          ${dailyOtherCols}
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; color:#94a3b8;">-</td>
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:800; color:#991b1b; background:#fecaca;">${totalClassAbsent}</td>
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:bold; color:#92400e; background:#fde68a;">${totalClassLeave}</td>
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:bold; color:#075985; background:#bae6fd;">${totalClassSick}</td>
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:bold; background:#cbd5e1;">${totalTaughtDaysInMonth} วัน</td>
          <td style="border:1px solid #475569; padding:3px 2px; text-align:center; font-weight:800; background:#cbd5e1;">${classAvgRate !== '-' ? `${classAvgRate}%` : '-'}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Monthly Summary Box -->
    <div style="margin-top:10px; padding:8px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; font-size:10.5px; display:grid; grid-template-columns: repeat(5, 1fr); text-align:center; gap:8px;">
      <div><span style="color:#64748b;">วันที่มีการสอนจริง:</span> <strong style="color:#0f172a;">${totalTaughtDaysInMonth} วัน</strong></div>
      <div><span style="color:#64748b;">ยอดมาเรียนรวม:</span> <strong style="color:#065f46;">${totalClassPresent} คน-ครั้ง</strong></div>
      <div><span style="color:#64748b;">ยอดขาดเรียนรวม:</span> <strong style="color:#991b1b;">${totalClassAbsent} คน-ครั้ง</strong></div>
      <div><span style="color:#64748b;">ยอดลากิจ/ป่วยรวม:</span> <strong style="color:#92400e;">${totalClassLeave + totalClassSick} คน-ครั้ง</strong></div>
      <div><span style="color:#64748b;">ร้อยละการมาเรียนเฉลี่ย:</span> <strong style="color:#0f172a; font-size:12px;">${classAvgRate !== '-' ? `${classAvgRate}%` : '-'}</strong></div>
    </div>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.warn('Auto print trigger error', err);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
  };

  // Re-generate Blob URL whenever parameters change
  useEffect(() => {
    if (!isOpen) return;

    try {
      const html = generateStandaloneHtml();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Failed to generate Blob URL', e);
    }
  }, [isOpen, subject, classKey, academicYear, semester, month, students, attendanceRecords]);

  // Handle direct print action
  const handlePrint = () => {
    setPopupBlocked(false);

    // Method 1: Try printing via clean new window with auto-print
    try {
      if (blobUrl) {
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
          printWindow.focus();
          return;
        }
      }
    } catch (err) {
      console.warn('Popup window.open failed, trying hidden iframe', err);
    }

    // Method 2: Fallback to hidden printing iframe inside same window
    try {
      const existingIframe = document.getElementById('attendance-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'attendance-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const html = generateStandaloneHtml();
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print failed, falling back to window.print', e);
            window.print();
          }
        }, 500);
        return;
      }
    } catch (err) {
      console.error('Hidden iframe printing failed', err);
    }

    // Method 3: Direct window.print()
    try {
      window.print();
    } catch (e) {
      setPopupBlocked(true);
    }
  };

  // Handle Download Standalone HTML file
  const handleDownloadHtml = () => {
    try {
      const html = generateStandaloneHtml();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `แบบรายงานการเช็คชื่อ_${subject.code}_ห้อง${classKey}_${monthName}_${academicYear}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download HTML', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      {/* Printable CSS Rules (A4 Landscape Form) with Explicit Color Enforcement */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm 6mm 5mm 6mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10px !important;
            font-family: 'Sarabun', 'TH Sarabun New', system-ui, -apple-system, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, nav, aside, header, .modal-backdrop {
            display: none !important;
          }
          .print-area-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-page {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #475569 !important;
          }
          /* Print Holiday Highlight (Warm Amber / Yellow) */
          .holiday-col-header {
            background-color: #fde68a !important;
            color: #78350f !important;
            border-color: #d97706 !important;
          }
          .holiday-col-cell {
            background-color: #fef3c7 !important;
          }
          .holiday-col-foot {
            background-color: #fde68a !important;
            color: #78350f !important;
          }
          /* Print Weekend Highlight (Soft Rose / Pink) */
          .weekend-col-header {
            background-color: #fecdd3 !important;
            color: #881337 !important;
            border-color: #e11d48 !important;
          }
          .weekend-col-cell {
            background-color: #ffe4e6 !important;
          }
          .weekend-col-foot {
            background-color: #fecdd3 !important;
            color: #881337 !important;
          }
        }
      `}} />

      <div className="bg-white rounded-2xl max-w-7xl w-full h-[96vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Modal Toolbar (Screen Only) */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-2">
                <span>พิมพ์รายงานเช็คชื่อนักเรียน (A4 แนวนอน)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  A4 Landscape
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  ไฮไลท์วันหยุด & เสาร์-อาทิตย์
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                วิชา {subject.code} {subject.name} • ห้อง {classKey} • {monthName} ภาคเรียนที่ {semester}/{academicYear}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Print Button */}
            <button
              id="btn-trigger-print"
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              title="พิมพ์เอกสารออกทางเครื่องพิมพ์ หรือ บันทึกเป็น PDF"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน (Print / PDF)</span>
            </button>

            {/* Direct Open in New Tab Button */}
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 text-xs font-bold text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 hover:text-white border border-indigo-500/40 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="เปิดหน้าพิมพ์แบบเต็มจอในแท็บใหม่เพื่อสั่งพิมพ์ (Ctrl+P)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เปิดในแท็บใหม่</span>
              </a>
            )}

            {/* Download Standalone HTML Button */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="ดาวน์โหลดไฟล์เอกสารรายงาน (.html) สำหรับเปิดดูหรือพิมพ์ภายหลัง"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">ดาวน์โหลด HTML</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/80 print:p-0 print:bg-white print-area-wrapper">
          <div 
            ref={printRef}
            className="print-page max-w-[297mm] mx-auto bg-white p-5 sm:p-7 shadow-xl rounded-xl border border-slate-300 text-slate-900 print:shadow-none print:border-none print:p-0 print:m-0"
            style={{ minWidth: '940px' }}
          >
            {/* Header: School & Official Form Title */}
            <div className="text-center pb-2.5 border-b-2 border-slate-800 space-y-1">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                {schoolSettings.schoolName || 'โรงเรียนสาธิตวิทยาคม'}
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                {schoolSettings.affiliation || 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)'}
              </p>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 pt-0.5">
                แบบรายงานการเช็คชื่อและบันทึกเวลาเรียนประจำรายวิชา (บพ.)
              </h2>

              {/* Metadata Grid */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-4 text-xs text-slate-800 border-t border-slate-200 mt-2">
                <div className="text-left">
                  <span className="font-semibold text-slate-600">รหัสวิชา: </span>
                  <span className="font-bold">{subject.code}</span>
                </div>
                <div className="text-left col-span-2">
                  <span className="font-semibold text-slate-600">รายวิชา: </span>
                  <span className="font-bold">{subject.name} ({subject.credits} นก.)</span>
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-600">ระดับชั้น/ห้อง: </span>
                  <span className="font-bold">{classKey}</span>
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-600">ครูผู้สอน: </span>
                  <span className="font-bold">{subject.teacherName || '-'}</span>
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-600">ประจำเดือน: </span>
                  <span className="font-bold">{monthName}</span>
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-600">ภาคเรียน/ปีการศึกษา: </span>
                  <span className="font-bold">{semester}/{academicYear}</span>
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-600">จำนวนนักเรียน: </span>
                  <span className="font-bold">{students.length} คน</span>
                </div>
              </div>
            </div>

            {/* Sub-Header: Symbol Legend & Color Highlight Indicators */}
            <div className="flex flex-wrap items-center justify-between text-[10.5px] text-slate-700 py-1.5 border-b border-slate-300 gap-2">
              <div className="flex flex-wrap items-center gap-2.5 font-medium">
                <span className="font-bold text-slate-900">สัญลักษณ์:</span>
                <span className="text-emerald-700 font-bold">✓ = มา</span>
                <span className="text-rose-700 font-bold">ข = ขาด</span>
                <span className="text-amber-700 font-bold">ล = ลากิจ</span>
                <span className="text-sky-700 font-bold">ป = ลาป่วย</span>
                <span className="text-slate-500 font-bold">- = วันที่ไม่ได้เช็ค/ไม่นับรวม</span>
                <span className="text-slate-300">|</span>
                {/* Highlight Badges */}
                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded border border-amber-400 text-[10px]">
                  <Flag className="w-3 h-3 text-amber-700 shrink-0" />
                  สีส้ม = วันหยุดนักขัตฤกษ์
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-rose-900 bg-rose-200/90 px-1.5 py-0.5 rounded border border-rose-300 text-[10px]">
                  <Sun className="w-3 h-3 text-rose-700 shrink-0" />
                  สีชมพู = วันเสาร์ - อาทิตย์
                </span>
              </div>
              
              <div className="text-[10px] text-slate-500">
                <span>* วันที่แสดงเครื่องหมาย <b>-</b> หมายถึงไม่มีการเช็คชื่อ/ไม่นำมาคำนวณสถิติ</span>
              </div>
            </div>

            {/* If there are public holidays in this month, display them explicitly */}
            {monthHolidays.length > 0 && (
              <div className="py-1 px-2 my-1.5 rounded-lg bg-amber-50 border border-amber-300 text-[10.5px] text-amber-950 flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-bold">วันหยุดนักขัตฤกษ์ในเดือนนี้:</span>
                <span className="flex-1">
                  {monthHolidays.map((h, i) => (
                    <span key={h.day} className="inline-block mr-3">
                      <strong>วันที่ {h.day}:</strong> {h.holiday.name}
                      {i < monthHolidays.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* Attendance Table */}
            <div className="mt-2 overflow-x-auto">
              <table className="print-table w-full text-[10px] border-collapse border border-slate-400 text-center">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                    <th className="border border-slate-400 py-1 px-1 w-6 text-center" rowSpan={2}>ที่</th>
                    <th className="border border-slate-400 py-1 px-1 w-12 text-center" rowSpan={2}>รหัส</th>
                    <th className="border border-slate-400 py-1 px-2 text-left min-w-[125px]" rowSpan={2}>ชื่อ - สกุล</th>
                    
                    {/* Day 1 - 30 Number Headers */}
                    {dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
                      const isHoliday = !!holiday;
                      let headerBg = 'bg-slate-100/50 text-slate-600';
                      let headerClass = '';

                      if (isHoliday) {
                        headerBg = 'bg-amber-200 text-amber-950 font-black border-amber-400 holiday-col-header';
                        headerClass = 'holiday-col-header';
                      } else if (isWk) {
                        headerBg = 'bg-rose-200/90 text-rose-950 font-black border-rose-300 weekend-col-header';
                        headerClass = 'weekend-col-header';
                      } else if (dayRecordedMap[day]) {
                        headerBg = 'bg-slate-200 text-slate-900 font-extrabold';
                      }

                      return (
                        <th 
                          key={day} 
                          className={`border border-slate-400 py-0.5 px-0.5 w-[21px] text-[9.5px] ${headerBg} ${headerClass}`}
                          title={isHoliday ? `วันหยุด: ${holiday?.name}` : isWk ? `วันหยุดสุดสัปดาห์ (เสาร์-อาทิตย์)` : `วันที่ ${day}`}
                        >
                          {day}
                        </th>
                      );
                    })}

                    <th className="border border-slate-400 py-1 px-0.5 w-7 text-emerald-900 bg-emerald-100 font-bold text-[9.5px]" rowSpan={2} title="มาเรียน">มา</th>
                    <th className="border border-slate-400 py-1 px-0.5 w-7 text-rose-900 bg-rose-100 font-bold text-[9.5px]" rowSpan={2} title="ขาดเรียน">ขาด</th>
                    <th className="border border-slate-400 py-1 px-0.5 w-6 text-amber-900 bg-amber-100 font-bold text-[9.5px]" rowSpan={2} title="ลากิจ">ลา</th>
                    <th className="border border-slate-400 py-1 px-0.5 w-6 text-sky-900 bg-sky-100 font-bold text-[9.5px]" rowSpan={2} title="ลาป่วย">ป่วย</th>
                    <th className="border border-slate-400 py-1 px-1 w-9 text-slate-900 bg-slate-200 font-bold text-[9.5px]" rowSpan={2} title="จำนวนวันที่เช็ค">รวมวัน</th>
                    <th className="border border-slate-400 py-1 px-1 w-10 text-slate-900 bg-slate-200 font-bold text-[9.5px]" rowSpan={2} title="ร้อยละการมาเรียน">% มา</th>
                  </tr>

                  {/* Day of Week Sub-Header Row (อา, จ, อ, พ, พฤ, ศ, ส) */}
                  <tr className="border-b border-slate-400 text-[8.5px]">
                    {dayMetaList.map(({ day, holiday, isWeekend: isWk, dayOfWeekShort }) => {
                      const isHoliday = !!holiday;
                      let subBg = 'bg-slate-50 text-slate-500';
                      let subClass = '';

                      if (isHoliday) {
                        subBg = 'bg-amber-100 text-amber-900 font-bold border-amber-400 holiday-col-header';
                        subClass = 'holiday-col-header';
                      } else if (isWk) {
                        subBg = 'bg-rose-100 text-rose-900 font-bold border-rose-300 weekend-col-header';
                        subClass = 'weekend-col-header';
                      }

                      return (
                        <th 
                          key={`sub-${day}`} 
                          className={`border border-slate-400 py-0.5 px-0.5 ${subBg} ${subClass}`}
                        >
                          {isHoliday ? 'หยุด' : dayOfWeekShort}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {studentStats.map((item, idx) => {
                    const { student: st, present, absent, leave, sick, recordedDays, rate } = item;
                    const rec = recordMap.get(st.id);

                    return (
                      <tr key={st.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="border border-slate-400 py-0.5 font-bold text-slate-800">{st.studentNumber}</td>
                        <td className="border border-slate-400 py-0.5 font-mono text-[9px] text-slate-600">{st.studentCode}</td>
                        <td className="border border-slate-400 py-0.5 px-2 text-left font-medium whitespace-nowrap">
                          {st.prefix}{st.firstName} {st.lastName}
                        </td>

                        {/* Day 1 - 30 Data Cells with Holiday & Weekend Highlights */}
                        {dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
                          const status = rec?.days?.[day];
                          const isHoliday = !!holiday;
                          let char = '-';
                          let cellClass = 'text-slate-400 font-normal';
                          let cellBgClass = '';

                          // Column Highlight Colors
                          if (isHoliday) {
                            cellBgClass = 'bg-amber-50/80 holiday-col-cell';
                          } else if (isWk) {
                            cellBgClass = 'bg-rose-50/80 weekend-col-cell';
                          }

                          // Status Text Colors
                          if (status === 'present') {
                            char = '✓';
                            cellClass = 'text-emerald-700 font-bold';
                          } else if (status === 'absent') {
                            char = 'ข';
                            cellClass = 'text-rose-700 font-bold bg-rose-100/50';
                          } else if (status === 'leave') {
                            char = 'ล';
                            cellClass = 'text-amber-700 font-bold bg-amber-100/50';
                          } else if (status === 'sick') {
                            char = 'ป';
                            cellClass = 'text-sky-700 font-bold bg-sky-100/50';
                          } else {
                            // Unrecorded '-'
                            if (isHoliday) {
                              cellClass = 'text-amber-400 font-normal';
                            } else if (isWk) {
                              cellClass = 'text-rose-300 font-normal';
                            }
                          }

                          return (
                            <td 
                              key={day} 
                              className={`border border-slate-400 py-0.5 px-0.5 text-[9.5px] ${cellBgClass} ${cellClass}`}
                            >
                              {char}
                            </td>
                          );
                        })}

                        {/* Student Statistics (Counting ONLY recorded days) */}
                        <td className="border border-slate-400 py-0.5 font-bold text-emerald-800 bg-emerald-50/40">
                          {present}
                        </td>
                        <td className="border border-slate-400 py-0.5 font-bold text-rose-800 bg-rose-50/40">
                          {absent}
                        </td>
                        <td className="border border-slate-400 py-0.5 font-semibold text-amber-800 bg-amber-50/40">
                          {leave}
                        </td>
                        <td className="border border-slate-400 py-0.5 font-semibold text-sky-800 bg-sky-50/40">
                          {sick}
                        </td>
                        <td className="border border-slate-400 py-0.5 font-bold text-slate-800 bg-slate-100/60">
                          {recordedDays}
                        </td>
                        <td className="border border-slate-400 py-0.5 font-bold text-slate-900 bg-slate-100/80">
                          {rate !== '-' ? `${rate}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer: Daily & Monthly Summary */}
                <tfoot>
                  {/* Daily Present Row */}
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400 text-[9.5px]">
                    <td colSpan={3} className="border border-slate-400 py-1 px-2 text-right">
                      ยอดมาเรียนแต่ละวัน (✓):
                    </td>
                    {dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
                      const isHoliday = !!holiday;
                      let footBg = '';
                      if (isHoliday) footBg = 'bg-amber-100/90 holiday-col-foot';
                      else if (isWk) footBg = 'bg-rose-100/90 weekend-col-foot';

                      return (
                        <td key={day} className={`border border-slate-400 py-1 text-emerald-900 ${footBg}`}>
                          {dayRecordedMap[day] ? dailyPresent[day] : '-'}
                        </td>
                      );
                    })}
                    <td className="border border-slate-400 py-1 text-emerald-900 font-extrabold bg-emerald-100">
                      {totalClassPresent}
                    </td>
                    <td colSpan={5} className="border border-slate-400 py-1 text-center bg-slate-100 text-slate-600">
                      รวมมาเรียน
                    </td>
                  </tr>

                  {/* Daily Absent / Leave / Sick Row */}
                  <tr className="bg-slate-50 font-bold text-slate-900 text-[9.5px]">
                    <td colSpan={3} className="border border-slate-400 py-1 px-2 text-right text-rose-900">
                      ยอดขาด / ลา / ป่วย แต่ละวัน:
                    </td>
                    {dayMetaList.map(({ day, holiday, isWeekend: isWk }) => {
                      const notPresentCount = (dailyAbsent[day] || 0) + (dailyLeave[day] || 0) + (dailySick[day] || 0);
                      const isHoliday = !!holiday;
                      let footBg = '';
                      if (isHoliday) footBg = 'bg-amber-100/90 holiday-col-foot';
                      else if (isWk) footBg = 'bg-rose-100/90 weekend-col-foot';

                      return (
                        <td key={day} className={`border border-slate-400 py-1 text-rose-800 ${footBg}`}>
                          {dayRecordedMap[day] ? notPresentCount : '-'}
                        </td>
                      );
                    })}
                    <td className="border border-slate-400 py-1 text-center text-slate-400">-</td>
                    <td className="border border-slate-400 py-1 text-rose-900 font-extrabold bg-rose-100">
                      {totalClassAbsent}
                    </td>
                    <td className="border border-slate-400 py-1 text-amber-900 font-bold bg-amber-100">
                      {totalClassLeave}
                    </td>
                    <td className="border border-slate-400 py-1 text-sky-900 font-bold bg-sky-100">
                      {totalClassSick}
                    </td>
                    <td className="border border-slate-400 py-1 text-slate-900 font-bold bg-slate-200">
                      {totalTaughtDaysInMonth} วัน
                    </td>
                    <td className="border border-slate-400 py-1 text-slate-900 font-extrabold bg-slate-200">
                      {classAvgRate !== '-' ? `${classAvgRate}%` : '-'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Monthly Summary Statistics Box */}
            <div className="mt-3 p-2.5 rounded-lg border border-slate-300 bg-slate-50/80 text-[10.5px] grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div>
                <span className="text-slate-500">วันที่มีการบันทึกสอน: </span>
                <strong className="text-slate-900">{totalTaughtDaysInMonth} วัน</strong>
              </div>
              <div>
                <span className="text-slate-500">ยอดมาเรียนรวม: </span>
                <strong className="text-emerald-800">{totalClassPresent} คน-ครั้ง</strong>
              </div>
              <div>
                <span className="text-slate-500">ยอดขาดเรียนรวม: </span>
                <strong className="text-rose-800">{totalClassAbsent} คน-ครั้ง</strong>
              </div>
              <div>
                <span className="text-slate-500">ยอดลากิจ/ป่วยรวม: </span>
                <strong className="text-amber-800">{totalClassLeave + totalClassSick} คน-ครั้ง</strong>
              </div>
              <div>
                <span className="text-slate-500">ร้อยละการมาเรียนเฉลี่ย: </span>
                <strong className="text-slate-900 text-xs">{classAvgRate !== '-' ? `${classAvgRate}%` : '-'}</strong>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
