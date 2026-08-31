import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Assignment, FirebaseCustomConfig, SchoolSettings, Student, StudentSubjectScore, Subject, User, StudentAttendanceRecord, AttendanceStatus } from '../types';
import { INITIAL_ASSIGNMENTS, INITIAL_SUBJECTS, INITIAL_USERS, generateInitialScores, generateInitialStudents } from './mockData';
import firebaseAppletConfig from '../../firebase-applet-config.json';

/**
 * ป้องกันปัญหารหัส Document ID ใน Firestore ที่มีเครื่องหมาย '/' (เช่น ป.3/1, ม.1/1)
 * ซึ่งจะทำให้ Firestore มองเป็น Subcollection path และเกิด Uncaught FirebaseError: Invalid document reference
 */
export function sanitizeDocId(id: string): string {
  if (!id) return 'doc_' + Math.random().toString(36).substring(2, 9);
  return id.replace(/[\/\\]/g, '-');
}

/**
 * ทำความสะอาด Object ก่อนส่งเข้า Firestore โดยกรองค่าที่เป็น undefined ทิ้งอย่างลึก (Recursive)
 * เพื่อป้องกันข้อผิดพลาด: FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

const LOCAL_STORAGE_KEYS = {
  STUDENTS: 'school_grading_students_v2',
  SUBJECTS: 'school_grading_subjects_v2',
  ASSIGNMENTS: 'school_grading_assignments_v2',
  SCORES: 'school_grading_scores_v2',
  USERS: 'school_grading_users_v2',
  CURRENT_USER: 'school_grading_current_user_v2',
  FIREBASE_CONFIG: 'school_grading_firebase_config_v2',
  SCHOOL_SETTINGS: 'school_grading_settings_v2',
  ATTENDANCE: 'school_grading_attendance_v2',
  AUTH_SESSION: 'school_grading_auth_session_v2',
};

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'โรงเรียนสาธิตวิทยาคม',
  schoolNameEn: 'Satit Wittayakom School',
  affiliation: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)',
  province: 'กรุงเทพมหานคร',
  academicYear: '2568',
  currentSemester: 1,
  directorName: 'ดร.วิชาการ พัฒนาการศึกษา',
  evaluationNote: 'เกณฑ์การประเมินตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ฉบับปรับปรุง 2560)',
};

class StorageService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private firebaseConnected: boolean = false;

  constructor() {
    this.cleanLegacyDemoData();
    this.initializeLocalDataIfEmpty();
    this.tryInitFirebaseFromStorage();
  }

  // Clear older version demo caches if any exist
  private cleanLegacyDemoData() {
    const legacyKeys = [
      'school_grading_students_v1',
      'school_grading_subjects_v1',
      'school_grading_assignments_v1',
      'school_grading_scores_v1',
      'school_grading_users_v1',
      'school_grading_current_user_v1',
      'school_grading_firebase_config_v1',
    ];
    legacyKeys.forEach((k) => {
      if (localStorage.getItem(k)) {
        localStorage.removeItem(k);
      }
    });
  }

  // Initial Seed
  private initializeLocalDataIfEmpty() {
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.USERS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    } else {
      // Ensure admin password is updated to 213894120 if present
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.USERS);
        if (raw) {
          const currentUsers: User[] = JSON.parse(raw);
          let modified = false;
          const updated = currentUsers.map((u) => {
            if (u.role === 'admin' && (!u.password || u.password === '05072525' || u.username === 'admin')) {
              if (u.password !== '213894120') {
                modified = true;
                return { ...u, password: '213894120' };
              }
            }
            return u;
          });
          if (modified) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(updated));
          }
        }
      } catch (e) {
        console.error('Failed to verify admin password', e);
      }
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.SUBJECTS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS)) {
      const initStudents = generateInitialStudents();
      localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(initStudents));
      
      const initScores = generateInitialScores(initStudents, INITIAL_ASSIGNMENTS, INITIAL_SUBJECTS);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(initScores));
    }
  }

  public tryInitFirebaseFromStorage(): boolean {
    try {
      // 1. First priority: Check auto-provisioned Firebase applet config
      if (firebaseAppletConfig && firebaseAppletConfig.apiKey && firebaseAppletConfig.projectId) {
        const autoConfig: FirebaseCustomConfig = {
          apiKey: firebaseAppletConfig.apiKey,
          projectId: firebaseAppletConfig.projectId,
          authDomain: firebaseAppletConfig.authDomain || undefined,
          storageBucket: firebaseAppletConfig.storageBucket || undefined,
          messagingSenderId: firebaseAppletConfig.messagingSenderId || undefined,
          appId: firebaseAppletConfig.appId || undefined,
        };
        const ok = this.initFirebase(autoConfig);
        if (ok) {
          return true;
        }
      }

      // 2. Second priority: Check custom stored config in localStorage
      const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.FIREBASE_CONFIG);
      if (storedConfig) {
        const config: FirebaseCustomConfig = JSON.parse(storedConfig);
        if (config.apiKey && config.projectId) {
          return this.initFirebase(config);
        }
      }
    } catch (err) {
      console.warn('Could not initialize Firebase from storage:', err);
    }
    return false;
  }

  public initFirebase(config: FirebaseCustomConfig): boolean {
    try {
      if (getApps().length > 0) {
        this.app = getApps()[0];
      } else {
        this.app = initializeApp(config);
      }
      this.db = getFirestore(this.app);
      try {
        const auth = getAuth(this.app);
        if (!auth.currentUser) {
          signInAnonymously(auth).catch((authErr) => {
            console.warn('Anonymous auth note (unauthenticated access permitted by rules):', authErr);
          });
        }
      } catch (authErr) {
        // Ignore auth init error if unauthenticated access is used
      }
      this.firebaseConnected = true;
      localStorage.setItem(LOCAL_STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
      return true;
    } catch (err) {
      console.error('Firebase initialization failed:', err);
      this.firebaseConnected = false;
      return false;
    }
  }

  public async ensureAuth(): Promise<void> {
    if (!this.app) return;
    try {
      const auth = getAuth(this.app);
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch (e) {
      // ignore
    }
  }

  public getFirebaseStatus(): { connected: boolean; projectId?: string } {
    if (this.firebaseConnected && this.app) {
      const projId = this.app.options.projectId || firebaseAppletConfig?.projectId;
      return { connected: true, projectId: projId };
    }
    const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.FIREBASE_CONFIG);
    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig);
        return { connected: this.firebaseConnected, projectId: parsed.projectId };
      } catch (e) {
        // ignore
      }
    }
    return { connected: this.firebaseConnected };
  }

  /**
   * ดึงข้อมูลทั้งหมดจาก Cloud Firestore มายังเครื่องนี้
   * เพื่อให้เครื่องอื่นๆ ที่เข้าใช้งานระบบสามารถเห็นและทำงานบนชุดข้อมูลจริงเดียวกัน
   */
  public async pullAllDataFromFirebase(): Promise<{
    success: boolean;
    counts: {
      students: number;
      subjects: number;
      assignments: number;
      scores: number;
      users: number;
      attendance: number;
    };
    isEmptyRemote?: boolean;
    error?: string;
  }> {
    if (!this.db || !this.firebaseConnected) {
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return {
          success: false,
          counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0 },
          error: 'ยังไม่ได้เชื่อมต่อฐานข้อมูล Firebase Firestore',
        };
      }
    }

    try {
      await this.ensureAuth();
      const [
        studentsSnap,
        subjectsSnap,
        assignmentsSnap,
        scoresSnap,
        attendanceSnap,
        usersSnap,
        settingsSnap,
      ] = await Promise.all([
        getDocs(collection(this.db, 'students')),
        getDocs(collection(this.db, 'subjects')),
        getDocs(collection(this.db, 'assignments')),
        getDocs(collection(this.db, 'scores')),
        getDocs(collection(this.db, 'attendance')),
        getDocs(collection(this.db, 'users')),
        getDocs(collection(this.db, 'settings')),
      ]);

      const totalRemoteDocs =
        studentsSnap.size +
        subjectsSnap.size +
        assignmentsSnap.size +
        scoresSnap.size +
        attendanceSnap.size +
        usersSnap.size;

      // หากบน Cloud Firestore ยังว่างเปล่า (เพิ่งสร้าง Database ใหม่) ให้อัปโหลดข้อมูลตั้งต้นขึ้น Cloud
      if (totalRemoteDocs === 0) {
        console.log('Cloud Firestore is empty, auto seeding current dataset to Cloud...');
        await this.syncAllLocalDataToFirebase();
        return {
          success: true,
          isEmptyRemote: true,
          counts: {
            students: this.getStudents().length,
            subjects: this.getSubjects().length,
            assignments: this.getAssignments().length,
            scores: this.getScores().length,
            users: this.getUsers().length,
            attendance: this.getAttendanceRecords().length,
          },
        };
      }

      // หากบน Cloud มีข้อมูล ให้อัปเดตลงเครื่องนี้ เพื่อให้ทุกเครื่องแสดงข้อมูลตรงกัน
      if (!studentsSnap.empty) {
        const remoteStudents: Student[] = [];
        studentsSnap.forEach((d) => remoteStudents.push(d.data() as Student));
        localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(remoteStudents));
      }

      if (!subjectsSnap.empty) {
        const remoteSubjects: Subject[] = [];
        subjectsSnap.forEach((d) => remoteSubjects.push(d.data() as Subject));
        localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(remoteSubjects));
      }

      if (!assignmentsSnap.empty) {
        const remoteAssignments: Assignment[] = [];
        assignmentsSnap.forEach((d) => remoteAssignments.push(d.data() as Assignment));
        localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(remoteAssignments));
      }

      if (!scoresSnap.empty) {
        const remoteScores: StudentSubjectScore[] = [];
        scoresSnap.forEach((d) => remoteScores.push(d.data() as StudentSubjectScore));
        localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(remoteScores));
      }

      if (!attendanceSnap.empty) {
        const remoteAttendance: StudentAttendanceRecord[] = [];
        attendanceSnap.forEach((d) => remoteAttendance.push(d.data() as StudentAttendanceRecord));
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(remoteAttendance));
      }

      if (!usersSnap.empty) {
        const remoteUsers: User[] = [];
        usersSnap.forEach((d) => remoteUsers.push(d.data() as User));
        localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(remoteUsers));
      }

      if (!settingsSnap.empty) {
        settingsSnap.forEach((d) => {
          if (d.id === 'school_settings') {
            localStorage.setItem(LOCAL_STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(d.data()));
          }
        });
      }

      return {
        success: true,
        counts: {
          students: studentsSnap.size,
          subjects: subjectsSnap.size,
          assignments: assignmentsSnap.size,
          scores: scoresSnap.size,
          attendance: attendanceSnap.size,
          users: usersSnap.size,
        },
      };
    } catch (err: any) {
      console.error('Error pulling data from Firebase Firestore:', err);
      return {
        success: false,
        counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0 },
        error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore',
      };
    }
  }

  /**
   * นำข้อมูลทั้งหมดในระบบปัจจุบัน (นักเรียน, รายวิชา, ใบงาน, คะแนน, ผู้ใช้งาน, การเช็คชื่อ, การตั้งค่า)
   * ส่งขึ้นไปยัง Cloud Firestore ในครั้งเดียว (Sync All Data to Firebase)
   */
  public async syncAllLocalDataToFirebase(): Promise<{
    success: boolean;
    counts: {
      students: number;
      subjects: number;
      assignments: number;
      scores: number;
      users: number;
      attendance: number;
      settings: number;
    };
    error?: string;
  }> {
    if (!this.db || !this.firebaseConnected) {
      // Try init first
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return {
          success: false,
          counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0, settings: 0 },
          error: 'ยังไม่ได้เชื่อมต่อฐานข้อมูล Firebase Firestore',
        };
      }
    }

    try {
      await this.ensureAuth();
      const students = this.getStudents();
      const subjects = this.getSubjects();
      const assignments = this.getAssignments();
      const scores = this.getScores();
      const users = this.getUsers();
      const attendance = this.getAttendanceRecords();
      const settings = this.getSchoolSettings();

      // Chunk write batches (Firestore has 500 operations per batch limit)
      const allOperations: Array<{ collection: string; id: string; data: any }> = [];

      students.forEach((s) => allOperations.push({ collection: 'students', id: sanitizeDocId(s.id), data: s }));
      subjects.forEach((s) => allOperations.push({ collection: 'subjects', id: sanitizeDocId(s.id), data: s }));
      assignments.forEach((a) => allOperations.push({ collection: 'assignments', id: sanitizeDocId(a.id), data: a }));
      scores.forEach((sc) => allOperations.push({ collection: 'scores', id: sanitizeDocId(sc.id), data: sc }));
      users.forEach((u) => allOperations.push({ collection: 'users', id: sanitizeDocId(u.id), data: u }));
      attendance.forEach((att) => allOperations.push({ collection: 'attendance', id: sanitizeDocId(att.id), data: att }));
      allOperations.push({ collection: 'settings', id: 'school_settings', data: settings });

      // Execute batches in chunks of 400
      const CHUNK_SIZE = 400;
      for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
        const chunk = allOperations.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(this.db!);
        chunk.forEach((op) => {
          const docRef = doc(this.db!, op.collection, op.id);
          batch.set(docRef, cleanForFirestore(op.data), { merge: true });
        });
        await batch.commit();
      }

      return {
        success: true,
        counts: {
          students: students.length,
          subjects: subjects.length,
          assignments: assignments.length,
          scores: scores.length,
          users: users.length,
          attendance: attendance.length,
          settings: 1,
        },
      };
    } catch (err: any) {
      console.error('Failed to sync all local data to Firebase:', err);
      return {
        success: false,
        counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0, settings: 0 },
        error: err.message || 'เกิดข้อผิดพลาดในการนำข้อมูลขึ้น Firebase',
      };
    }
  }

  // --- USER AUTHENTICATION & SESSIONS ---
  public getUsers(): User[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.USERS);
    if (!data) return INITIAL_USERS;
    try {
      const parsed: User[] = JSON.parse(data);
      if (parsed.length === 0) return INITIAL_USERS;
      return parsed;
    } catch {
      return INITIAL_USERS;
    }
  }

  public saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(users));

    // Also update current user if modifying self
    const currentUser = this.getCurrentUser();
    if (currentUser.id === user.id) {
      this.setCurrentUser(user);
    }

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'users', sanitizeDocId(user.id)), cleanForFirestore(user)).catch(console.error);
    }
  }

  public deleteUser(userId: string): { success: boolean; message?: string } {
    const users = this.getUsers();
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) {
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };
    }

    // Protect last admin
    if (userToDelete.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return { success: false, message: 'ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้' };
      }
    }

    const filtered = users.filter((u) => u.id !== userId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(filtered));

    // If current logged in user was deleted, switch to first user
    const current = this.getCurrentUser();
    if (current.id === userId) {
      this.setCurrentUser(filtered[0] || INITIAL_USERS[0]);
    }

    if (this.db && this.firebaseConnected) {
      deleteDoc(doc(this.db, 'users', sanitizeDocId(userId))).catch(console.error);
    }

    return { success: true };
  }

  public getTeachers(): User[] {
    return this.getUsers().filter((u) => u.role === 'teacher');
  }

  public getCurrentUser(): User {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_USER);
    if (data) {
      try {
        const user = JSON.parse(data);
        // Verify user still exists in current user list
        const all = this.getUsers();
        const exists = all.find(u => u.id === user.id);
        if (exists) return exists;
      } catch (e) {
        // fallback
      }
    }
    const defaultUser = this.getUsers()[0] || INITIAL_USERS[0];
    this.setCurrentUser(defaultUser);
    return defaultUser;
  }

  public setCurrentUser(user: User): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  // Session Authentication state
  public isAuthenticated(): boolean {
    const session = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_SESSION);
    return session === 'true';
  }

  public setAuthenticatedSession(isAuth: boolean, user?: User): void {
    if (isAuth) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_SESSION, 'true');
      if (user) {
        this.setCurrentUser(user);
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_SESSION);
    }
  }

  public logout(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_SESSION);
  }

  public authenticate(usernameOrEmail: string, passwordAttempt: string): { success: boolean; user?: User; message?: string } {
    const input = usernameOrEmail.trim().toLowerCase();
    const pass = passwordAttempt.trim();
    
    if (!input) {
      return { success: false, message: 'กรุณากรอกชื่อผู้ใช้หรืออีเมล' };
    }
    if (!pass) {
      return { success: false, message: 'กรุณากรอกรหัสผ่าน' };
    }

    const users = this.getUsers();
    const user = users.find(
      u => u.email.toLowerCase() === input || (u.username && u.username.toLowerCase() === input)
    );

    if (!user) {
      return { success: false, message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };
    }

    // Default password check
    const userPassword = user.password || (user.role === 'admin' ? '213894120' : 'password123');
    if (userPassword !== pass) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง' };
    }

    this.setAuthenticatedSession(true, user);
    return { success: true, user };
  }

  // --- STUDENTS ---
  public getStudents(): Student[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.STUDENTS);
    const students: Student[] = data ? JSON.parse(data) : [];
    // เรียงลำดับจากเลขที่น้อยไปหามากตามความต้องการ
    return students.sort((a, b) => a.studentNumber - b.studentNumber);
  }

  public saveStudent(student: Student): void {
    const students = this.getStudents();
    const idx = students.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      students[idx] = student;
    } else {
      students.push(student);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    
    // Firestore async sync
    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'students', sanitizeDocId(student.id)), cleanForFirestore(student)).catch(console.error);
    }
  }

  public bulkSaveStudents(newStudents: Student[]): void {
    const existing = this.getStudents();
    const map = new Map<string, Student>();
    existing.forEach((s) => map.set(s.id, s));
    newStudents.forEach((s) => map.set(s.id, s));
    const combined = Array.from(map.values()).sort((a, b) => a.studentNumber - b.studentNumber);
    localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(combined));

    if (this.db && this.firebaseConnected) {
      const batch = writeBatch(this.db);
      newStudents.forEach((s) => {
        const ref = doc(this.db!, 'students', sanitizeDocId(s.id));
        batch.set(ref, cleanForFirestore(s));
      });
      batch.commit().catch(console.error);
    }
  }

  public deleteStudent(studentId: string): void {
    const students = this.getStudents().filter((s) => s.id !== studentId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    
    // ลบคะแนนที่ผูกกับนักเรียนคนนี้ด้วย
    const scores = this.getScores().filter((sc) => sc.studentId !== studentId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(scores));

    if (this.db && this.firebaseConnected) {
      deleteDoc(doc(this.db, 'students', sanitizeDocId(studentId))).catch(console.error);
    }
  }

  // --- SUBJECTS ---
  public getSubjects(): Subject[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SUBJECTS);
    return data ? JSON.parse(data) : INITIAL_SUBJECTS;
  }

  public saveSubject(subject: Subject): void {
    const subjects = this.getSubjects();
    const idx = subjects.findIndex((s) => s.id === subject.id);
    if (idx >= 0) {
      subjects[idx] = subject;
    } else {
      subjects.push(subject);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'subjects', sanitizeDocId(subject.id)), cleanForFirestore(subject)).catch(console.error);
    }
  }

  public deleteSubject(subjectId: string): void {
    const subjects = this.getSubjects().filter((s) => s.id !== subjectId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    
    // ลบใบงานและคะแนนของวิชานี้
    const asgs = this.getAssignments().filter((a) => a.subjectId !== subjectId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(asgs));
    
    const scores = this.getScores().filter((sc) => sc.subjectId !== subjectId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(scores));

    if (this.db && this.firebaseConnected) {
      deleteDoc(doc(this.db, 'subjects', sanitizeDocId(subjectId))).catch(console.error);
    }
  }

  // --- ASSIGNMENTS ---
  public getAssignments(): Assignment[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : INITIAL_ASSIGNMENTS;
  }

  public saveAssignment(assignment: Assignment): void {
    const assignments = this.getAssignments();
    const idx = assignments.findIndex((a) => a.id === assignment.id);
    if (idx >= 0) {
      assignments[idx] = assignment;
    } else {
      assignments.push(assignment);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'assignments', sanitizeDocId(assignment.id)), cleanForFirestore(assignment)).catch(console.error);
    }
  }

  public saveAllAssignments(assignments: Assignment[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));

    if (this.db && this.firebaseConnected) {
      const batch = writeBatch(this.db);
      assignments.forEach((a) => {
        batch.set(doc(this.db!, 'assignments', sanitizeDocId(a.id)), cleanForFirestore(a));
      });
      batch.commit().catch(console.error);
    }
  }

  public deleteAssignment(assignmentId: string): void {
    const assignments = this.getAssignments().filter((a) => a.id !== assignmentId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));

    if (this.db && this.firebaseConnected) {
      deleteDoc(doc(this.db, 'assignments', sanitizeDocId(assignmentId))).catch(console.error);
    }
  }

  // --- SCORES ---
  public getScores(): StudentSubjectScore[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SCORES);
    return data ? JSON.parse(data) : [];
  }

  public saveScore(score: StudentSubjectScore): void {
    const scores = this.getScores();
    const idx = scores.findIndex((s) => s.id === score.id);
    if (idx >= 0) {
      scores[idx] = score;
    } else {
      scores.push(score);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(scores));

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'scores', sanitizeDocId(score.id)), cleanForFirestore(score)).catch(console.error);
    }
  }

  public bulkSaveScores(newScores: StudentSubjectScore[]): void {
    const existing = this.getScores();
    const map = new Map<string, StudentSubjectScore>();
    existing.forEach((sc) => map.set(sc.id, sc));
    newScores.forEach((sc) => map.set(sc.id, sc));
    const combined = Array.from(map.values());
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(combined));

    if (this.db && this.firebaseConnected) {
      const batch = writeBatch(this.db);
      newScores.forEach((sc) => {
        const ref = doc(this.db!, 'scores', sanitizeDocId(sc.id));
        batch.set(ref, cleanForFirestore(sc));
      });
      batch.commit().catch(console.error);
    }
  }

  // --- ATTENDANCE (ใบเช็คยอดนักเรียน / บันทึกการมาเรียน) ---
  public calculateAttendanceStats(days: Record<number, AttendanceStatus>): {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    sickCount: number;
    totalRecordedDays: number;
    attendanceRate: number;
  } {
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let sickCount = 0;

    Object.values(days).forEach((status) => {
      if (status === 'present') presentCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'leave') leaveCount++;
      else if (status === 'sick') sickCount++;
    });

    const totalRecordedDays = presentCount + absentCount + leaveCount + sickCount;
    const attendanceRate = totalRecordedDays > 0 ? Number(((presentCount / totalRecordedDays) * 100).toFixed(1)) : 100;

    return {
      presentCount,
      absentCount,
      leaveCount,
      sickCount,
      totalRecordedDays,
      attendanceRate,
    };
  }

  public getAttendanceRecords(): StudentAttendanceRecord[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.ATTENDANCE);
    if (!data) return [];
    try {
      const records: StudentAttendanceRecord[] = JSON.parse(data);
      return records.map((r) => ({
        ...r,
        id: sanitizeDocId(r.id),
      }));
    } catch {
      return [];
    }
  }

  public saveAttendanceRecord(record: StudentAttendanceRecord): void {
    const records = this.getAttendanceRecords();
    const stats = this.calculateAttendanceStats(record.days);
    const updatedRecord = { 
      ...record, 
      id: sanitizeDocId(record.id),
      ...stats, 
      updatedAt: new Date().toISOString() 
    };
    
    const idx = records.findIndex((r) => r.id === updatedRecord.id);
    if (idx >= 0) {
      records[idx] = updatedRecord;
    } else {
      records.push(updatedRecord);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'attendance', updatedRecord.id), cleanForFirestore(updatedRecord)).catch(console.error);
    }
  }

  public bulkSaveAttendanceRecords(newRecords: StudentAttendanceRecord[]): void {
    const existing = this.getAttendanceRecords();
    const map = new Map<string, StudentAttendanceRecord>();
    existing.forEach((r) => map.set(r.id, r));
    
    const sanitizedNewRecords = newRecords.map((r) => {
      const stats = this.calculateAttendanceStats(r.days);
      const safeId = sanitizeDocId(r.id);
      return { ...r, id: safeId, ...stats, updatedAt: new Date().toISOString() };
    });

    sanitizedNewRecords.forEach((r) => {
      map.set(r.id, r);
    });

    const combined = Array.from(map.values());
    localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(combined));

    if (this.db && this.firebaseConnected) {
      const batch = writeBatch(this.db);
      sanitizedNewRecords.forEach((r) => {
        const ref = doc(this.db!, 'attendance', r.id);
        batch.set(ref, cleanForFirestore(r));
      });
      batch.commit().catch(console.error);
    }
  }

  public getOrInitAttendanceForClass(
    classStudents: Student[],
    subjectId: string,
    classKey: string,
    academicYear: string,
    semester: 1 | 2,
    month: number
  ): StudentAttendanceRecord[] {
    const allRecords = this.getAttendanceRecords();
    const result: StudentAttendanceRecord[] = [];
    const missingToCreate: StudentAttendanceRecord[] = [];
    const safeClassKey = classKey.replace(/[\/\\]/g, '-');

    classStudents.forEach((student) => {
      const id = sanitizeDocId(`${subjectId}_${safeClassKey}_${academicYear}_S${semester}_M${month}_${student.id}`);
      const found = allRecords.find((r) => 
        sanitizeDocId(r.id) === id || 
        (r.studentId === student.id && 
         r.subjectId === subjectId && 
         r.classKey === classKey && 
         r.month === month && 
         r.semester === semester &&
         (r.academicYear === academicYear || !r.academicYear))
      );
      
      if (found) {
        result.push({
          ...found,
          id: sanitizeDocId(found.id),
        });
      } else {
        const newRecord: StudentAttendanceRecord = {
          id,
          studentId: student.id,
          subjectId,
          classKey,
          academicYear,
          semester,
          month,
          days: {},
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          sickCount: 0,
          totalRecordedDays: 0,
          attendanceRate: 100,
          updatedAt: new Date().toISOString(),
        };
        result.push(newRecord);
        missingToCreate.push(newRecord);
      }
    });

    if (missingToCreate.length > 0) {
      this.bulkSaveAttendanceRecords(missingToCreate);
    }

    return result;
  }

  // --- DATA MANAGEMENT: CLEAR / RESET ONLY STUDENT & SCORE DATA ---
  /**
   * ล้างข้อมูลนักเรียน คะแนน ใบงาน โดย "ไม่ลบข้อมูลผู้ใช้งานและครูในระบบ" ตามข้อกำหนด
   */
  public clearStudentAndGradeDataOnly(): void {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SCORES);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ATTENDANCE);
    localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify([]));
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify([]));
    localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));

    if (this.db && this.firebaseConnected) {
      // Async clear collections if needed
    }
  }

  /**
   * รีเซ็ตข้อมูลเป็นชุดสาธิตตั้งต้น (โรงเรียนจำลอง)
   */
  public resetToDemoData(): void {
    const initStudents = generateInitialStudents();
    const initScores = generateInitialScores(initStudents, INITIAL_ASSIGNMENTS, INITIAL_SUBJECTS);
    
    localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(initStudents));
    localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
    localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(initScores));
    localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
  }

  // --- EXPORT & IMPORT FULL BACKUP ---
  public exportBackupJSON(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      students: this.getStudents(),
      subjects: this.getSubjects(),
      assignments: this.getAssignments(),
      scores: this.getScores(),
      attendance: this.getAttendanceRecords(),
      // We exclude confidential user credentials if needed
    };
    return JSON.stringify(backup, null, 2);
  }

  public importBackupJSON(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (data.students && Array.isArray(data.students)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
      }
      if (data.subjects && Array.isArray(data.subjects)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(data.subjects));
      }
      if (data.assignments && Array.isArray(data.assignments)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(data.assignments));
      }
      if (data.scores && Array.isArray(data.scores)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(data.scores));
      }
      if (data.attendance && Array.isArray(data.attendance)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(data.attendance));
      }
      return { success: true, message: 'นำเข้าข้อมูลสำรองเรียบร้อยสมบูรณ์' };
    } catch (err: any) {
      return { success: false, message: 'รูปแบบไฟล์ไม่ถูกต้อง: ' + err.message };
    }
  }

  // --- SCHOOL GENERAL SETTINGS ---
  public getSchoolSettings(): SchoolSettings {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SCHOOL_SETTINGS);
    if (!data) return DEFAULT_SCHOOL_SETTINGS;
    try {
      return { ...DEFAULT_SCHOOL_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SCHOOL_SETTINGS;
    }
  }

  public saveSchoolSettings(settings: Partial<SchoolSettings>): SchoolSettings {
    const current = this.getSchoolSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(updated));

    if (this.db && this.firebaseConnected) {
      setDoc(doc(this.db, 'settings', 'school_settings'), cleanForFirestore(updated)).catch(console.error);
    }

    return updated;
  }
}

export const storage = new StorageService();
