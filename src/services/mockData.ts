import { Assignment, Student, StudentSubjectScore, Subject, User } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin-1',
    name: 'ผู้ดูแลระบบ (Admin)',
    email: 'admin@school.ac.th',
    username: 'admin',
    password: '213894120',
    role: 'admin',
    subjectSpecialty: 'ผู้ดูแลระบบและฝ่ายทะเบียนวิชาการ',
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString().split('T')[0],
  },
];

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'sub-p1-thai',
    code: 'ท11101',
    name: 'ภาษาไทย 1',
    credits: 2.5,
    gradeLevel: 'ป.1',
    targetClasses: ['ป.1/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้ภาษาไทย ทักษะการอ่าน การเขียน การฟัง การดู และการพูด สำหรับนักเรียนชั้นประถมศึกษาปีที่ 1',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p1-math',
    code: 'ค11101',
    name: 'คณิตศาสตร์ 1',
    credits: 2.5,
    gradeLevel: 'ป.1',
    targetClasses: ['ป.1/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้คณิตศาสตร์ จำนวนและการดำเนินการ การวัด เรขาคณิต สำหรับนักเรียนชั้นประถมศึกษาปีที่ 1',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p2-thai',
    code: 'ท12101',
    name: 'ภาษาไทย 2',
    credits: 2.5,
    gradeLevel: 'ป.2',
    targetClasses: ['ป.2/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้ภาษาไทย ชั้นประถมศึกษาปีที่ 2',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p3-sci',
    code: 'ว13101',
    name: 'วิทยาศาสตร์และเทคโนโลยี 3',
    credits: 2.0,
    gradeLevel: 'ป.3',
    targetClasses: ['ป.3/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี ชั้นประถมศึกษาปีที่ 3',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p4-eng',
    code: 'อ14101',
    name: 'ภาษาอังกฤษ 4',
    credits: 2.0,
    gradeLevel: 'ป.4',
    targetClasses: ['ป.4/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้ภาษาต่างประเทศ ภาษาอังกฤษ ชั้นประถมศึกษาปีที่ 4',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p5-soc',
    code: 'ส15101',
    name: 'สังคมศึกษา 5',
    credits: 2.0,
    gradeLevel: 'ป.5',
    targetClasses: ['ป.5/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม ชั้นประถมศึกษาปีที่ 5',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
  {
    id: 'sub-p6-math',
    code: 'ค16101',
    name: 'คณิตศาสตร์ 6',
    credits: 2.5,
    gradeLevel: 'ป.6',
    targetClasses: ['ป.6/1'],
    teacherId: 'user-admin-1',
    teacherName: 'ผู้ดูแลระบบ (Admin)',
    description: 'สาระการเรียนรู้คณิตศาสตร์ ชั้นประถมศึกษาปีที่ 6',
    ratioSemester1: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    ratioSemester2: { courseworkWeight: 70, examWeight: 30, ratioPreset: '70:30', totalTargetScore: 100 },
    academicYear: '2568',
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [];

export function generateInitialStudents(): Student[] {
  const currentYear = '2568';
  const gradeLevels = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];

  const sampleNames = [
    { prefix: 'ด.ช.', first: 'กิตติศักดิ์', last: 'รัตนโชติ', gender: 'M' as const },
    { prefix: 'ด.ญ.', first: 'กานดา', last: 'วงษ์สุวรรณ', gender: 'F' as const },
    { prefix: 'ด.ช.', first: 'ชินดนัย', last: 'ศิริโรจน์', gender: 'M' as const },
    { prefix: 'ด.ญ.', first: 'ณิชานันท์', last: 'บุญประเสริฐ', gender: 'F' as const },
    { prefix: 'ด.ช.', first: 'ธนกฤต', last: 'สมบูรณ์สุข', gender: 'M' as const },
  ];

  const students: Student[] = [];

  gradeLevels.forEach((grade, gIdx) => {
    const gradeNum = gIdx + 1; // 1 to 6
    sampleNames.forEach((person, pIdx) => {
      const studentNumber = pIdx + 1;
      const studentCode = `68${gradeNum}0${studentNumber}`;
      students.push({
        id: `std-p${gradeNum}-0${studentNumber}`,
        studentCode,
        studentNumber,
        prefix: person.prefix,
        firstName: person.first,
        lastName: person.last,
        gradeLevel: grade,
        classroom: '1',
        classKey: `${grade}/1`,
        academicYear: currentYear,
        gender: person.gender,
        status: 'active',
      });
    });
  });

  return students;
}

export function generateInitialScores(students: Student[], assignments: Assignment[], subjects: Subject[]): StudentSubjectScore[] {
  return [];
}
