export type UserRole = 'admin' | 'teacher' | 'staff' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  role: UserRole;
  subjectSpecialty?: string;
  phone?: string;
  avatar?: string;
  createdAt?: string;
}

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred' | 'repeated';

export interface StudentAcademicHistory {
  academicYear: string;
  gradeLevel: string; // เช่น ม.1
  classroom: string;  // เช่น 1
  classKey: string;   // เช่น ม.1/1
  studentNumber: number;
  status: StudentStatus;
  promotedAt?: string;
  promotedBy?: string;
  gpa?: number;
  totalCredits?: number;
  passedSubjectsCount?: number;
  totalSubjectsCount?: number;
  remark?: string;
}

export interface Student {
  id: string;
  studentCode: string; // รหัสนักเรียน เช่น 68001
  studentNumber: number; // เลขที่ 1, 2, 3...
  prefix: string; // ด.ช., ด.ญ., นาย, น.ส.
  firstName: string;
  lastName: string;
  gradeLevel: string; // ม.1, ม.2, ม.3, ป.4 ...
  classroom: string; // 1, 2, 3 (ประกอบเป็น ม.1/1)
  classKey: string; // e.g. "ม.1/1"
  academicYear: string; // เช่น 2568
  gender: 'M' | 'F';
  status: StudentStatus;
  academicHistory?: StudentAcademicHistory[];
  phone?: string;
  notes?: string;
}

export interface PromotionItemDetail {
  studentId: string;
  studentCode: string;
  name: string;
  fromGradeLevel: string;
  fromClassKey: string;
  fromStudentNumber: number;
  toGradeLevel: string;
  toClassKey: string;
  toStudentNumber: number;
  action: 'promote' | 'repeat' | 'graduated' | 'transferred';
  gpa?: number;
  passedAll?: boolean;
}

export interface PromotionRecord {
  id: string;
  timestamp: string;
  executedBy: string;
  fromAcademicYear: string;
  toAcademicYear: string;
  sourceGradeLevel?: string;
  sourceClassKey?: string;
  totalStudents: number;
  promotedCount: number;
  repeatedCount: number;
  graduatedCount: number;
  transferredCount: number;
  studentsDetail: PromotionItemDetail[];
  copiedSubjectsCount?: number;
  note?: string;
}

export type AssignmentCategory = 
  | 'worksheet'     // ใบงาน
  | 'exercise'      // แบบฝึกหัด
  | 'project'       // โครงงาน
  | 'report'        // รายงาน
  | 'homework_book' // สมุดการบ้าน
  | 'test'          // แบบทดสอบ
  | 'custom';       // การให้คะแนนกรอกได้เอง / กำหนดเอง

export interface Assignment {
  id: string;
  subjectId: string;
  semester: 1 | 2;
  name: string; // เช่น ใบงานที่ 1, แบบฝึกหัดที่ 2, โครงงานกลุ่ม, สอบกลางภาค
  category: AssignmentCategory;
  maxScore: number; // คะแนนเต็ม ครูสามารถกำหนดได้เอง
  strand?: string; // สาระที่ เช่น 1 หรือ สาระที่ 1
  standard?: string; // มาตรฐาน เช่น ว 1.1, ค 1.1, ท 1.1
  indicator?: string; // ตัวชี้วัด เช่น ว 1.1 ป.1/1 หรือ ป.1/1 หรือ 1
  gradeLevel?: string; // ระดับชั้น (legacy)
  indicatorNo?: string; // ตัวชี้วัดข้อที่ (legacy)
  topic?: string; // เรื่อง เช่น การเปรียบเทียบเศษส่วน, แรงและการเคลื่อนที่, พืช
  description?: string;
  orderIndex?: number; // ลำดับการแสดงผลของช่องคะแนน
}

export interface SubjectGradingRatio {
  courseworkWeight?: number; // 1. คะแนนเก็บใบงาน/ภาระงานระหว่างเรียน เช่น 70, 80, 60, 50
  examWeight?: number;       // 2. คะแนนสอบ (เมื่อแบ่งคะแนนเก็บจากใบงานแล้ว ที่เหลือคือคะแนนสอบ) เช่น 30, 20, 40, 50
  finalExamWeight?: number;  // คะแนนสอบปลายภาค เช่น 30, 20 (ย่อยจากคะแนนสอบ)
  midtermWeight?: number;    // คะแนนสอบกลางภาค เช่น 20 (ย่อยจากคะแนนสอบ)
  totalTargetScore?: number; // คะแนนเต็มรวม เช่น 100
  ratioPreset?: '70:30' | '80:20' | '60:40' | '50:50' | 'custom';
  description?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  code: string; // เช่น ว21101, ค31101, ท11101
  name: string; // วิทยาการคำนวณ 1
  credits: number; // 1.0, 1.5
  gradeLevel: string; // ม.1, ม.2
  targetClasses: string[]; // ["ม.1/1", "ม.1/2"]
  academicYear: string; // 2568
  teacherId: string;
  teacherName: string;
  ratioSemester1?: SubjectGradingRatio;
  ratioSemester2?: SubjectGradingRatio;
  description?: string;
  semester1TargetScore?: number; // คะแนนเก็บทั้งหมด ภาคเรียนที่ 1 (แทนคะแนนเต็ม 100 ค่าเริ่มต้น 100)
  semester2TargetScore?: number; // คะแนนเก็บทั้งหมด ภาคเรียนที่ 2 (แทนคะแนนเต็ม 100 ค่าเริ่มต้น 100)
}

export interface SemesterScoreData {
  assignmentScores: Record<string, number>; // assignmentId -> score
  midtermScore?: number;
  finalExamScore?: number;
  
  // คำนวณสรุปตามสูตร: (คะแนนรวมที่ได้ ÷ คะแนนเต็มรวม) × 100
  totalRawAssignments: number; // คะแนนรวมที่ได้
  maxRawAssignments: number;   // คะแนนเต็มรวมทั้งหมด
  calculatedCoursework?: number;
  totalSemesterScore: number;  // คะแนนที่คำนวณได้เทียบเต็ม 100
  grade: number;               // เกรดจำนวนเต็ม: 0, 1, 2, 3, 4
}

export interface StudentSubjectScore {
  id: string;
  studentId: string;
  subjectId: string;
  academicYear: string;
  
  semester1: SemesterScoreData;
  semester2: SemesterScoreData;
  
  // สรุป 2 ภาคเรียน: (S1 + S2) / 2
  finalCombined: {
    s1Total: number;
    s2Total: number;
    combinedAverageScore: number; // (S1 + S2) / 2
    finalGrade: number; // เกรดจำนวนเต็ม: 0, 1, 2, 3, 4
    passed: boolean;
    remark?: string;
  };
  
  updatedAt: string;
}

export interface ClassroomSummary {
  classKey: string; // เช่น "ม.1/1"
  gradeLevel: string; // "ม.1"
  roomNumber: string; // "1"
  studentCount: number;
  semester1Avg: number;
  semester2Avg: number;
  finalAvg: number;
  minScore: number;
  maxScore: number;
  standardDeviation: number;
  gradeDistribution: Record<number, number>; // 4: count, 3: count, 2: count, 1: count, 0: count
  passRate: number; // % ที่ผ่าน (เกรด >= 1)
  highGradeRate: number; // % ที่ได้เกรด >= 3
}

export interface FirebaseCustomConfig {
  apiKey: string;
  projectId: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolNameEn?: string;
  affiliation?: string;
  province?: string;
  academicYear: string;
  currentSemester: 1 | 2;
  directorName?: string;
  evaluationNote?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'unrecorded';

export interface StudentAttendanceRecord {
  id: string; // `${subjectId}_${classKey}_${academicYear}_${semester}_${month}_${studentId}`
  studentId: string;
  subjectId: string;
  classKey: string;
  academicYear: string;
  semester: 1 | 2;
  month: number; // 1 - 12 (เช่น 8 = สิงหาคม) หรือรอบช่วงที่ 1-30
  days: Record<number, AttendanceStatus>; // วันที่ 1-30 -> 'present' | 'absent' | 'leave' | 'sick'
  presentCount: number; // จำนวนวันที่มาเรียน (✓)
  absentCount: number;  // จำนวนวันขาดเรียน (ข)
  leaveCount: number;   // จำนวนวันลา (ล)
  sickCount: number;    // จำนวนวันป่วย (ป)
  totalRecordedDays: number;
  attendanceRate: number; // ร้อยละการมาเรียน
  updatedAt: string;
}

export interface AttendanceSubjectSummary {
  subjectId: string;
  classKey: string;
  academicYear: string;
  semester: 1 | 2;
  month: number;
  totalStudents: number;
  activeDay: number;
  todayPresentCount: number;
  todayAbsentCount: number;
  todayLeaveCount: number;
  todaySickCount: number;
  overallAttendanceRate: number;
}

export type ExamType = 
  | 'unit_quiz'      // แบบทดสอบย่อย / ท้ายบท
  | 'midterm'        // สอบกลางภาคเรียน
  | 'final'          // สอบปลายภาคเรียน
  | 'practical'      // สอบปฏิบัติ / ทักษะ
  | 'retest'         // สอบแก้ตัว
  | 'custom';        // แบบทดสอบทั่วไป / กำหนดเอง

export interface Exam {
  id: string;
  subjectId: string;
  semester: 1 | 2;
  title: string;            // ชื่อแบบทดสอบ เช่น แบบทดสอบท้ายบทที่ 1, การสอบกลางภาค
  examType: ExamType;
  rawMaxScore?: number;     // คะแนนดิบเต็ม (เช่น 30, 40, 50, 60, 100) สำหรับเก็บคะแนนดิบและนำมาหารเทียบสัดส่วน
  maxScore: number;         // คะแนนเต็มตามสัดส่วน (เช่น 20, 30 หรือตามที่กำหนด)
  passingScore: number;     // เกณฑ์คะแนนผ่าน เช่น 10, 15, 50
  strand?: string;          // สาระ (เช่น 1. วิทยาศาสตร์ชีวภาพ)
  standard?: string;        // มาตรฐาน
  indicator?: string;       // ตัวชี้วัด
  topic?: string;           // เรื่อง / หน่วยการเรียนรู้
  examDate?: string;        // วันที่จัดสอบ (YYYY-MM-DD)
  description?: string;     // คำอธิบาย / หมายเหตุ
  targetClasses?: string[]; // กำหนดห้องเรียน หรือถ้าว่างหมายถึงทุกห้องของวิชา
  createdAt: string;
  updatedAt: string;
}

export type ExamStudentStatus = 'normal' | 'absent' | 'leave' | 'retested';

export interface StudentExamScore {
  studentId: string;
  score?: number;           // คะแนนดิบที่สอบได้ (ถ้ายังไม่ได้กรอกจะเป็น undefined)
  scaledScore?: number;     // คะแนนจริงตามสัดส่วนหลังหารเทียบ (เช่น ดิบ 32/40 -> สัดส่วน 16/20)
  status: ExamStudentStatus; // ปกติ, ขาดสอบ, ลา, สอบแก้ตัว
  retestScore?: number;     // คะแนนสอบแก้ตัว (ถ้ามี)
  note?: string;            // หมายเหตุ
  submittedAt?: string;
}

export interface ExamRecord {
  id: string;               // `exam_${examId}_${classKey}`
  examId: string;
  subjectId: string;
  classKey: string;
  academicYear: string;
  semester: 1 | 2;
  studentScores: Record<string, StudentExamScore>; // studentId -> StudentExamScore
  updatedBy?: string;
  updatedAt: string;
}

