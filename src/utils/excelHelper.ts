import * as XLSX from 'xlsx';
import { Student, StudentSubjectScore, Subject } from '../types';
import { formatStrandDisplay } from './grading';

/**
 * ช่วยแยกคำนำหน้า, ชื่อ, นามสกุล จากข้อความชื่อเต็ม หรือคอลัมน์ชื่อ-สกุล
 */
export function parseThaiFullName(rawName: string, defaultPrefix = 'ด.ช.') {
  let text = (rawName || '').trim();
  let prefix = defaultPrefix;
  let firstName = '';
  let lastName = '';

  // ตรวจจับคำนำหน้าทั่วไปในไทย
  const prefixes = [
    'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นาย', 'น.ส.', 'นางสาว', 'นาง'
  ];

  for (const p of prefixes) {
    if (text.startsWith(p)) {
      prefix = p === 'เด็กชาย' ? 'ด.ช.' : p === 'เด็กหญิง' ? 'ด.ญ.' : p === 'นางสาว' ? 'น.ส.' : p;
      text = text.substring(p.length).trim();
      break;
    }
  }

  // แยกชื่อและนามสกุลด้วยช่องว่าง
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    firstName = parts[0];
  } else if (parts.length >= 2) {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  return { prefix, firstName, lastName };
}

/**
 * ช่วยจัดรูปแบบระดับชั้นและห้องเรียน เช่น "ป.1/1", "ประถมศึกษาปีที่ 1", "มัธยมศึกษาปีที่ 2"
 */
export function parseGradeAndRoom(rawGrade?: string, rawRoom?: string) {
  let grade = (rawGrade || '').trim();
  let room = (rawRoom || '').trim();

  // หากในช่องระดับชั้นมีเครื่องหมาย slash เช่น "ป.1/2" หรือ "ม.3/1"
  if (grade.includes('/')) {
    const slashParts = grade.split('/');
    grade = slashParts[0].trim();
    if (!room) {
      room = slashParts[1].trim();
    }
  }

  // แปลงชื่อระดับชั้นแบบยาวเป็นชื่อย่อมาตรฐาน
  if (grade.includes('ประถมศึกษาปีที่')) {
    const num = grade.replace(/[^0-9]/g, '');
    grade = `ป.${num || '1'}`;
  } else if (grade.includes('ประถม')) {
    const num = grade.replace(/[^0-9]/g, '');
    grade = `ป.${num || '1'}`;
  } else if (grade.includes('มัธยมศึกษาปีที่')) {
    const num = grade.replace(/[^0-9]/g, '');
    grade = `ม.${num || '1'}`;
  } else if (grade.includes('มัธยม')) {
    const num = grade.replace(/[^0-9]/g, '');
    grade = `ม.${num || '1'}`;
  } else if (grade.includes('อนุบาล')) {
    const num = grade.replace(/[^0-9]/g, '');
    grade = `อ.${num || '1'}`;
  }

  if (!grade) grade = 'ป.1';
  if (!room) room = '1';

  return { gradeLevel: grade, classroom: room, classKey: `${grade}/${room}` };
}

/**
 * ตรวจสอบเพศจากข้อความ หรือคำนำหน้า
 */
export function detectGender(genderInput: string, prefix: string): 'M' | 'F' {
  const g = (genderInput || '').trim().toUpperCase();
  if (g.startsWith('F') || g.includes('ญ') || g.includes('หญิง') || g.includes('FEMALE')) {
    return 'F';
  }
  if (g.startsWith('M') || g.includes('ช') || g.includes('ชาย') || g.includes('MALE')) {
    return 'M';
  }
  // Auto-detect from prefix
  const p = (prefix || '').trim();
  if (p === 'ด.ญ.' || p === 'เด็กหญิง' || p === 'น.ส.' || p === 'นางสาว' || p === 'นาง') {
    return 'F';
  }
  return 'M';
}

export function downloadStudentTemplate() {
  const sampleData = [
    {
      'เลขที่': 1,
      'รหัสนักเรียน': '68101',
      'คำนำหน้า': 'ด.ช.',
      'ชื่อ': 'กิตติศักดิ์',
      'นามสกุล': 'รัตนโชติ',
      'ระดับชั้น': 'ป.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'M',
      'เบอร์โทร': '0812345678',
      'ปีการศึกษา': '2568',
    },
    {
      'เลขที่': 2,
      'รหัสนักเรียน': '68102',
      'คำนำหน้า': 'ด.ญ.',
      'ชื่อ': 'กานดา',
      'นามสกุล': 'วงษ์สุวรรณ',
      'ระดับชั้น': 'ป.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'F',
      'เบอร์โทร': '0898765432',
      'ปีการศึกษา': '2568',
    },
    {
      'เลขที่': 3,
      'รหัสนักเรียน': '68103',
      'คำนำหน้า': 'ด.ช.',
      'ชื่อ': 'ชินดนัย',
      'นามสกุล': 'ศิริโรจน์',
      'ระดับชั้น': 'ป.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'M',
      'เบอร์โทร': '0845678901',
      'ปีการศึกษา': '2568',
    },
    {
      'เลขที่': 1,
      'รหัสนักเรียน': '68201',
      'คำนำหน้า': 'นาย',
      'ชื่อ': 'ธนกฤต',
      'นามสกุล': 'สมบูรณ์สุข',
      'ระดับชั้น': 'ม.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'M',
      'เบอร์โทร': '0819998877',
      'ปีการศึกษา': '2568',
    },
    {
      'เลขที่': 2,
      'รหัสนักเรียน': '68202',
      'คำนำหน้า': 'น.ส.',
      'ชื่อ': 'ณิชานันท์',
      'นามสกุล': 'บุญประเสริฐ',
      'ระดับชั้น': 'ม.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'F',
      'เบอร์โทร': '0823456789',
      'ปีการศึกษา': '2568',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักเรียน');
  XLSX.writeFile(wb, 'student_import_template.xlsx');
}

export function downloadStudentCsvTemplate() {
  const csvContent = "\uFEFF" + [
    "เลขที่,รหัสนักเรียน,คำนำหน้า,ชื่อ,นามสกุล,ระดับชั้น,ห้อง,เพศ (M/F),เบอร์โทร,ปีการศึกษา",
    "1,68101,ด.ช.,กิตติศักดิ์,รัตนโชติ,ป.1,1,M,0812345678,2568",
    "2,68102,ด.ญ.,กานดา,วงษ์สุวรรณ,ป.1,1,F,0898765432,2568",
    "3,68103,ด.ช.,ชินดนัย,ศิริโรจน์,ป.1,1,M,0845678901,2568",
    "1,68201,นาย,ธนกฤต,สมบูรณ์สุข,ม.1,1,M,0819998877,2568"
  ].join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'student_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseStudentsFromExcel(
  file: File,
  targetAcademicYear?: string
): Promise<{ students: Student[]; errorCount: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const students: Student[] = [];
        const errors: string[] = [];
        let errorCount = 0;

        const getRowVal = (row: any, keys: string[]): string => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
              return String(row[k]).trim();
            }
            const foundKey = Object.keys(row).find(
              (rk) => rk.trim().toLowerCase() === k.trim().toLowerCase()
            );
            if (
              foundKey &&
              row[foundKey] !== undefined &&
              row[foundKey] !== null &&
              String(row[foundKey]).trim() !== ''
            ) {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        const defaultYear = targetAcademicYear || '2568';

        json.forEach((row, index) => {
          const rowNum = index + 2; // row 1 is header

          // Ignore completely empty rows
          const hasAnyValue = Object.values(row).some((val) => String(val).trim() !== '');
          if (!hasAnyValue) return;

          const numStr = getRowVal(row, ['เลขที่', 'ลำดับ', 'ลำดับที่', 'ที่', 'No', 'No.', 'no', 'number', 'Number']);
          const studentNumber = Number(numStr) || (index + 1);

          const studentCode = getRowVal(row, [
            'รหัสนักเรียน',
            'รหัสประจำตัว',
            'เลขประจำตัว',
            'เลขประจำตัวนักเรียน',
            'รหัส',
            'StudentCode',
            'Student Code',
            'StudentID',
            'code',
            'Code',
            'id',
            'ID',
          ]) || `ST${1000 + index}`;

          let prefix = getRowVal(row, ['คำนำหน้า', 'คำนำหน้านาม', 'คำนำ', 'Prefix', 'prefix', 'Title', 'title']) || '';
          let firstName = getRowVal(row, ['ชื่อ', 'ชื่อตัว', 'FirstName', 'First Name', 'fname', 'name']) || '';
          let lastName = getRowVal(row, ['นามสกุล', 'สกุล', 'LastName', 'Last Name', 'Surname', 'lname']) || '';

          // If firstName is empty, try extracting from full name column (ชื่อ-สกุล)
          if (!firstName) {
            const combinedFullName = getRowVal(row, [
              'ชื่อ-สกุล',
              'ชื่อ - สกุล',
              'ชื่อ-นามสกุล',
              'ชื่อ - นามสกุล',
              'ชื่อ นามสกุล',
              'ชื่อสกุล',
              'ชื่อและนามสกุล',
              'FullName',
              'Full Name',
              'Name',
            ]);

            if (combinedFullName) {
              const parsedName = parseThaiFullName(combinedFullName, prefix || 'ด.ช.');
              if (!prefix) prefix = parsedName.prefix;
              firstName = parsedName.firstName;
              if (!lastName) lastName = parsedName.lastName;
            }
          }

          if (!firstName) {
            errors.push(`แถวที่ ${rowNum}: ไม่พบชื่อนักเรียน (กรุณาระบุในคอลัมน์ "ชื่อ" หรือ "ชื่อ-สกุล")`);
            errorCount++;
            return;
          }

          if (!prefix) {
            prefix = 'ด.ช.';
          }

          const rawGrade = getRowVal(row, ['ระดับชั้น', 'ชั้น', 'ชั้นเรียน', 'ชั้นปี', 'Grade', 'grade', 'Level', 'level', 'Class', 'class']);
          const rawRoom = getRowVal(row, ['ห้อง', 'ห้องเรียน', 'ห้องที่', 'Room', 'room', 'Classroom', 'classroom']);
          const { gradeLevel, classroom, classKey } = parseGradeAndRoom(rawGrade, rawRoom);

          const genderRaw = getRowVal(row, ['เพศ (M/F)', 'เพศ (ช/ญ)', 'เพศ', 'Gender', 'gender', 'Sex', 'sex']);
          const gender = detectGender(genderRaw, prefix);

          const phone = getRowVal(row, ['เบอร์โทร', 'เบอร์โทรศัพท์', 'โทรศัพท์', 'โทร', 'Phone', 'phone', 'Tel', 'tel', 'Mobile']);
          const rowYear = getRowVal(row, ['ปีการศึกษา', 'ปี', 'AcademicYear', 'Year', 'year']) || defaultYear;

          students.push({
            id: `std-import-${studentCode}-${Date.now()}-${index}`,
            studentCode,
            studentNumber,
            prefix,
            firstName,
            lastName,
            gradeLevel,
            classroom,
            classKey,
            academicYear: rowYear,
            gender,
            status: 'active',
            phone,
          });
        });

        // จัดเรียงตามระดับชั้นและเลขที่น้อยไปหามาก
        students.sort((a, b) => {
          if (a.classKey !== b.classKey) return a.classKey.localeCompare(b.classKey);
          return a.studentNumber - b.studentNumber;
        });

        resolve({ students, errorCount, errors });
      } catch (err: any) {
        reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportGradeReportExcel(
  subject: Subject,
  classKey: string,
  students: Student[],
  scores: StudentSubjectScore[]
) {
  const scoreMap = new Map<string, StudentSubjectScore>();
  scores.forEach((s) => scoreMap.set(s.studentId, s));

  // เรียงลำดับจากเลขที่น้อยไปหามาก
  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);

  const exportRows = sortedStudents.map((st) => {
    const sc = scoreMap.get(st.id);
    const s1 = sc?.semester1?.totalSemesterScore ?? 0;
    const s2 = sc?.semester2?.totalSemesterScore ?? 0;
    const combined = sc?.finalCombined?.combinedAverageScore ?? ((s1 + s2) / 2);
    const grade = sc?.finalCombined?.finalGrade ?? 0;

    return {
      'เลขที่': st.studentNumber,
      'รหัสนักเรียน': st.studentCode,
      'คำนำหน้า': st.prefix,
      'ชื่อ': st.firstName,
      'นามสกุล': st.lastName,
      'ห้องเรียน': st.classKey,
      'วิชา': `${subject.code} ${subject.name}`,
      'คะแนนเทอม 1 (100)': s1,
      'คะแนนเทอม 2 (100)': s2,
      'คะแนนรวมเฉลี่ย 2 เทอม (หาร 2)': Number(combined.toFixed(2)),
      'เกรดตัดสิน (0-4)': grade,
      'ผลการประเมิน': grade >= 1 ? 'ผ่าน' : 'ไม่ผ่าน (สอบซ่อม)',
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  const safeTitle = `${subject.code}_${classKey.replace('/', '_')}_สรุปเกรด`.substring(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, safeTitle);
  XLSX.writeFile(wb, `${subject.code}_${classKey.replace('/', '_')}_รายงานผลคะแนนและตัดเกรด.xlsx`);
}

export function exportAttendanceExcel(
  subject: Subject,
  classKey: string,
  academicYear: string,
  semester: 1 | 2,
  monthName: string,
  students: Student[],
  attendanceRecords: import('../types').StudentAttendanceRecord[]
) {
  const recordMap = new Map<string, import('../types').StudentAttendanceRecord>();
  attendanceRecords.forEach((r) => recordMap.set(r.studentId, r));

  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);

  const exportRows = sortedStudents.map((st) => {
    const rec = recordMap.get(st.id);
    const row: Record<string, any> = {
      'เลขที่': st.studentNumber,
      'รหัส': st.studentCode,
      'ชื่อ-สกุล': `${st.prefix}${st.firstName} ${st.lastName}`,
    };

    // Columns 1 to 30
    for (let day = 1; day <= 30; day++) {
      const status = rec?.days?.[day];
      let symbol = '';
      if (status === 'present') symbol = '✓';
      else if (status === 'absent') symbol = 'ข';
      else if (status === 'leave') symbol = 'ล';
      else if (status === 'sick') symbol = 'ป';
      row[`วันที่ ${day}`] = symbol;
    }

    row['วันที่มาเรียน'] = rec?.presentCount ?? 0;
    row['ขาดเรียน'] = rec?.absentCount ?? 0;
    row['ลา'] = rec?.leaveCount ?? 0;
    row['ป่วย'] = rec?.sickCount ?? 0;
    row['ร้อยละการมาเรียน'] = `${rec?.attendanceRate ?? 100}%`;

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  const sheetTitle = `${subject.code}_${classKey.replace('/', '_')}_เช็คชื่อ`.substring(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  XLSX.writeFile(wb, `ใบเช็คชื่อ_${subject.code}_${classKey.replace('/', '_')}_เทอม${semester}_${monthName}.xlsx`);
}

export function exportEvaluationReportExcel(
  subject: Subject,
  classKey: string,
  semester: 1 | 2,
  students: Student[],
  evaluationItems: import('../types').Assignment[],
  scores: StudentSubjectScore[]
) {
  const scoreMap = new Map<string, StudentSubjectScore>();
  scores.forEach((s) => scoreMap.set(s.studentId, s));

  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);
  const maxTotal = evaluationItems.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0);

  const exportRows = sortedStudents.map((st) => {
    const sc = scoreMap.get(st.id);
    const semKey = semester === 1 ? 'semester1' : 'semester2';
    const asgScores = sc?.[semKey]?.assignmentScores || {};

    const row: Record<string, any> = {
      'เลขที่': st.studentNumber,
      'รหัสนักเรียน': st.studentCode,
      'คำนำหน้า': st.prefix,
      'ชื่อ': st.firstName,
      'นามสกุล': st.lastName,
      'ห้องเรียน': st.classKey,
      'วิชา': `${subject.code} ${subject.name}`,
    };

    let studentRawTotal = 0;

    // Dynamic Assessment Item Columns
    evaluationItems.forEach((item, index) => {
      const val = asgScores[item.id] !== undefined ? asgScores[item.id] : '';
      if (typeof val === 'number') {
        studentRawTotal += val;
      }
      const strandVal = formatStrandDisplay(item.strand);
      const strandInfo = strandVal ? ` [สาระที่ ${strandVal}]` : '';
      const stdInfo = item.standard ? ` [มาตรฐาน ${item.standard}]` : '';
      const indInfo = item.indicator ? ` [ตัวชี้วัด ${item.indicator}]` : '';
      const colName = `${index + 1}. ${item.name}${strandInfo}${stdInfo}${indInfo} (เต็ม ${item.maxScore})`;
      row[colName] = val;
    });

    const percentage = maxTotal > 0 ? (studentRawTotal / maxTotal) * 100 : 0;
    let qualityLevel = 'ปรับปรุง';
    if (percentage >= 80) qualityLevel = 'ดีเยี่ยม';
    else if (percentage >= 70) qualityLevel = 'ดี';
    else if (percentage >= 50) qualityLevel = 'ผ่านเกณฑ์';

    row['คะแนนรวมที่ได้'] = studentRawTotal;
    row['คะแนนเต็มรวม'] = maxTotal;
    row['ร้อยละ (%)'] = Number(percentage.toFixed(2));
    row['ระดับคุณภาพ'] = qualityLevel;
    row['ผลการประเมิน'] = percentage >= 50 ? 'ผ่าน' : 'ไม่ผ่าน';

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  const safeTitle = `${subject.code}_${classKey.replace('/', '_')}_แบบประเมิน`.substring(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, safeTitle);
  XLSX.writeFile(wb, `แบบบันทึกการประเมินนักเรียนรายบุคคล_${subject.code}_${classKey.replace('/', '_')}_เทอม${semester}.xlsx`);
}

