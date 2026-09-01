import * as XLSX from 'xlsx';
import { Student, StudentSubjectScore, Subject } from '../types';

export function downloadStudentTemplate() {
  const sampleData = [
    {
      'เลขที่': 1,
      'รหัสนักเรียน': '68001',
      'คำนำหน้า': 'ด.ช.',
      'ชื่อ': 'กิตติศักดิ์',
      'นามสกุล': 'รัตนโชติ',
      'ระดับชั้น': 'ม.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'M',
      'เบอร์โทร': '0812345678',
    },
    {
      'เลขที่': 2,
      'รหัสนักเรียน': '68002',
      'คำนำหน้า': 'ด.ญ.',
      'ชื่อ': 'กานดา',
      'นามสกุล': 'วงษ์สุวรรณ',
      'ระดับชั้น': 'ม.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'F',
      'เบอร์โทร': '0898765432',
    },
    {
      'เลขที่': 3,
      'รหัสนักเรียน': '68003',
      'คำนำหน้า': 'ด.ช.',
      'ชื่อ': 'ชินดนัย',
      'นามสกุล': 'ศิริโรจน์',
      'ระดับชั้น': 'ม.1',
      'ห้อง': '1',
      'เพศ (M/F)': 'M',
      'เบอร์โทร': '0845678901',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักเรียน');
  XLSX.writeFile(wb, 'student_import_template.xlsx');
}

export function parseStudentsFromExcel(file: File): Promise<{ students: Student[]; errorCount: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const students: Student[] = [];
        const errors: string[] = [];
        let errorCount = 0;

        json.forEach((row, index) => {
          const rowNum = index + 2; // header is row 1
          const studentNumber = Number(row['เลขที่'] || row['No'] || row['number'] || (index + 1));
          const studentCode = String(row['รหัสนักเรียน'] || row['StudentCode'] || row['code'] || `ST${1000 + index}`);
          const prefix = String(row['คำนำหน้า'] || row['Prefix'] || 'ด.ช.');
          const firstName = String(row['ชื่อ'] || row['FirstName'] || row['name'] || '').trim();
          const lastName = String(row['นามสกุล'] || row['LastName'] || '').trim();
          const gradeLevel = String(row['ระดับชั้น'] || row['Grade'] || 'ม.1').trim();
          const classroom = String(row['ห้อง'] || row['Room'] || '1').trim();
          const genderInput = String(row['เพศ (M/F)'] || row['เพศ'] || row['Gender'] || 'M').toUpperCase();
          const gender = genderInput.startsWith('F') || genderInput.includes('ญ') ? 'F' : 'M';
          const phone = String(row['เบอร์โทร'] || row['Phone'] || '');

          if (!firstName) {
            errors.push(`แถวที่ ${rowNum}: ไม่พบชื่อนักเรียน`);
            errorCount++;
            return;
          }

          const classKey = `${gradeLevel}/${classroom}`;

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
            academicYear: '2568',
            gender,
            status: 'active',
            phone,
          });
        });

        // จัดเรียงตามเลขที่น้อยไปหามาก
        students.sort((a, b) => a.studentNumber - b.studentNumber);

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
      const colName = `${index + 1}. ${item.name} (เต็ม ${item.maxScore})`;
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

