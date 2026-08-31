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

export const INITIAL_SUBJECTS: Subject[] = [];

export const INITIAL_ASSIGNMENTS: Assignment[] = [];

export function generateInitialStudents(): Student[] {
  return [];
}

export function generateInitialScores(students: Student[], assignments: Assignment[], subjects: Subject[]): StudentSubjectScore[] {
  return [];
}

