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
  status: 'active' | 'inactive';
  phone?: string;
  notes?: string;
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
  description?: string;
  orderIndex?: number; // ลำดับการแสดงผลของช่องคะแนน
}

export interface SubjectGradingRatio {
  courseworkWeight?: number;
  finalExamWeight?: number;
  midtermWeight?: number; 
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
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
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

