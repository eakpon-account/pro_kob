import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch, onSnapshot, Unsubscribe } from 'firebase/firestore';
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

export const DEFAULT_FIREBASE_CONFIG: FirebaseCustomConfig = {
  apiKey: "AIzaSyDtEeZJ0IuEh-U28va9XRZBXd4iVPnMhB4",
  authDomain: "my-project-1505207518592.firebaseapp.com",
  projectId: "my-project-1505207518592",
  storageBucket: "my-project-1505207518592.firebasestorage.app",
  messagingSenderId: "425941727917",
  appId: "1:425941727917:web:b88a9baf3d21cbeb2ea424"
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

  public parseFirebaseConfigSnippet(snippet: string): FirebaseCustomConfig | null {
    if (!snippet || !snippet.trim()) return null;
    try {
      const trimmed = snippet.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }

      const extract = (key: string): string => {
        const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"\`]?([^'",\`\\n\\r}]+)['"\`]?`, 'i');
        const match = snippet.match(regex);
        return match ? match[1].trim() : '';
      };

      const apiKey = extract('apiKey');
      const projectId = extract('projectId');
      const authDomain = extract('authDomain');
      const storageBucket = extract('storageBucket');
      const messagingSenderId = extract('messagingSenderId');
      const appId = extract('appId');
      const measurementId = extract('measurementId');

      if (apiKey && projectId) {
        return {
          apiKey,
          projectId,
          authDomain: authDomain || undefined,
          storageBucket: storageBucket || undefined,
          messagingSenderId: messagingSenderId || undefined,
          appId: appId || undefined,
          measurementId: measurementId || undefined,
        };
      }
    } catch (e) {
      console.error('Error parsing config snippet:', e);
    }
    return null;
  }

  public tryInitFirebaseFromStorage(): boolean {
    try {
      // 1. First priority: Check custom stored config in localStorage
      const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.FIREBASE_CONFIG);
      if (storedConfig) {
        try {
          const config: FirebaseCustomConfig = JSON.parse(storedConfig);
          if (config.apiKey && config.projectId && !config.apiKey.includes('DummyKey')) {
            const ok = this.initFirebase(config);
            if (ok) return true;
          }
        } catch (e) {
          // ignore parse error
        }
      }

      // 2. Second priority: Default user configured project
      if (DEFAULT_FIREBASE_CONFIG && DEFAULT_FIREBASE_CONFIG.apiKey) {
        const ok = this.initFirebase(DEFAULT_FIREBASE_CONFIG);
        if (ok) return true;
      }

      // 3. Third priority: Check auto-provisioned Firebase applet config
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
      
      const dbId = (firebaseAppletConfig as any)?.firestoreDatabaseId;
      if (dbId && dbId !== '(default)') {
        this.db = getFirestore(this.app, dbId);
      } else {
        this.db = getFirestore(this.app);
      }
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

  public async testFirebasePermissions(): Promise<{
    success: boolean;
    canRead: boolean;
    canWrite: boolean;
    message: string;
    errorDetail?: string;
  }> {
    if (!this.db || !this.firebaseConnected) {
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return {
          success: false,
          canRead: false,
          canWrite: false,
          message: 'ยังไม่ได้เชื่อมต่อ Firebase (กรุณาตรวจสอบการตั้งค่า Config)',
        };
      }
    }

    let canWrite = false;
    let canRead = false;
    let errorDetail = '';

    try {
      // Test Write
      const testRef = doc(this.db, '_connection_test', 'ping');
      await setDoc(testRef, {
        timestamp: new Date().toISOString(),
        client: 'thai-grading-system',
        test: true,
      }, { merge: true });
      canWrite = true;

      // Test Read
      const snap = await getDocs(collection(this.db, '_connection_test'));
      if (!snap.empty) {
        canRead = true;
      }

      return {
        success: true,
        canRead: true,
        canWrite: true,
        message: 'เชื่อมต่อและทดสอบสิทธิ์ Firestore สำเร็จสมบูรณ์! สามารถอ่านและบันทึกข้อมูลได้ตามปกติ',
      };
    } catch (err: any) {
      errorDetail = err?.message || String(err);
      const isPermError = errorDetail.includes('permission') || errorDetail.includes('Missing or insufficient') || err?.code === 'permission-denied';
      
      const msg = isPermError
        ? 'สิทธิ์ Firestore ยังถูกล็อกอยู่ใน Firebase Console (Missing or insufficient permissions) กรุณาเข้าไปที่แท็บ Rules แล้วใส่ allow read, write: if true; แล้วกด Publish'
        : `เกิดข้อผิดพลาดในการทดสอบ: ${errorDetail}`;

      return {
        success: false,
        canRead,
        canWrite,
        message: msg,
        errorDetail,
      };
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
      const isPermError = err?.message?.includes('permission') || err?.message?.includes('Missing or insufficient') || err?.code === 'permission-denied';
      const friendlyMsg = isPermError
        ? 'สิทธิ์ Firestore ใน Firebase Console ยังถูกล็อก (Missing or insufficient permissions) กรุณาเข้าไปเปิด Rules เป็น allow read, write: if true; แล้วกด Publish'
        : (err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore');

      console.warn('Firestore pull status:', friendlyMsg);
      return {
        success: false,
        counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0 },
        error: friendlyMsg,
      };
    }
  }

  /**
   * ติดตามการเปลี่ยนแปลงข้อมูลจาก Cloud Firestore แบบเรียลไทม์ (Live Firestore Listener)
   * เมื่อมีการบันทึกคะแนน เพิ่มนักเรียน หรือแก้ไขวิชาจากเครื่องใดๆ จะอัปเดตข้อมูลบนหน้าจอทันที
   */
  public subscribeToLiveCloudUpdates(onUpdate: (type: string) => void): () => void {
    if (!this.db || !this.firebaseConnected) {
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return () => {};
      }
    }

    const unsubscribers: Unsubscribe[] = [];

    try {
      // 1. Listen to Students
      const unsubStudents = onSnapshot(collection(this.db!, 'students'), (snap) => {
        if (!snap.empty) {
          const list: Student[] = [];
          snap.forEach((d) => list.push(d.data() as Student));
          localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(list));
          onUpdate('students');
        }
      }, (err) => console.warn('Students live sync warning:', err));
      unsubscribers.push(unsubStudents);

      // 2. Listen to Subjects
      const unsubSubjects = onSnapshot(collection(this.db!, 'subjects'), (snap) => {
        if (!snap.empty) {
          const list: Subject[] = [];
          snap.forEach((d) => list.push(d.data() as Subject));
          localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(list));
          onUpdate('subjects');
        }
      }, (err) => console.warn('Subjects live sync warning:', err));
      unsubscribers.push(unsubSubjects);

      // 3. Listen to Assignments
      const unsubAsgs = onSnapshot(collection(this.db!, 'assignments'), (snap) => {
        if (!snap.empty) {
          const list: Assignment[] = [];
          snap.forEach((d) => list.push(d.data() as Assignment));
          localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(list));
          onUpdate('assignments');
        }
      }, (err) => console.warn('Assignments live sync warning:', err));
      unsubscribers.push(unsubAsgs);

      // 4. Listen to Scores
      const unsubScores = onSnapshot(collection(this.db!, 'scores'), (snap) => {
        if (!snap.empty) {
          const list: StudentSubjectScore[] = [];
          snap.forEach((d) => list.push(d.data() as StudentSubjectScore));
          localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(list));
          onUpdate('scores');
        }
      }, (err) => console.warn('Scores live sync warning:', err));
      unsubscribers.push(unsubScores);

      // 5. Listen to Attendance
      const unsubAttendance = onSnapshot(collection(this.db!, 'attendance'), (snap) => {
        if (!snap.empty) {
          const list: StudentAttendanceRecord[] = [];
          snap.forEach((d) => list.push(d.data() as StudentAttendanceRecord));
          localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(list));
          onUpdate('attendance');
        }
      }, (err) => console.warn('Attendance live sync warning:', err));
      unsubscribers.push(unsubAttendance);

      // 6. Listen to Users
      const unsubUsers = onSnapshot(collection(this.db!, 'users'), (snap) => {
        if (!snap.empty) {
          const list: User[] = [];
          snap.forEach((d) => list.push(d.data() as User));
          localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(list));
          onUpdate('users');
        }
      }, (err) => console.warn('Users live sync warning:', err));
      unsubscribers.push(unsubUsers);

      // 7. Listen to Settings
      const unsubSettings = onSnapshot(collection(this.db!, 'settings'), (snap) => {
        if (!snap.empty) {
          snap.forEach((d) => {
            if (d.id === 'school_settings') {
              localStorage.setItem(LOCAL_STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(d.data()));
              onUpdate('settings');
            }
          });
        }
      }, (err) => console.warn('Settings live sync warning:', err));
      unsubscribers.push(unsubSettings);

    } catch (e) {
      console.warn('Could not setup realtime listeners:', e);
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
    };
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
      const isPermError = err?.message?.includes('permission') || err?.message?.includes('Missing or insufficient') || err?.code === 'permission-denied';
      const friendlyMsg = isPermError
        ? 'ไม่สามารถนำข้อมูลขึ้น Cloud ได้เนื่องจากติดสิทธิ์ (Missing or insufficient permissions) กรุณาเข้าไปเปิด Rules ใน Firebase Console ให้ allow read, write: if true; แล้วกด Publish'
        : (err?.message || 'เกิดข้อผิดพลาดในการนำข้อมูลขึ้น Firebase');

      console.warn('Firestore sync status:', friendlyMsg);
      return {
        success: false,
        counts: { students: 0, subjects: 0, assignments: 0, scores: 0, users: 0, attendance: 0, settings: 0 },
        error: friendlyMsg,
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

  /**
   * สร้างฐานข้อมูลรายชื่อนักเรียนและบันทึกลง Firebase Cloud Firestore
   */
  public async createAndSeedStudentsInFirebase(studentsToSeed?: Student[]): Promise<{
    success: boolean;
    count: number;
    error?: string;
  }> {
    if (!this.db || !this.firebaseConnected) {
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return { success: false, count: 0, error: 'ยังไม่ได้เชื่อมต่อกับ Firebase' };
      }
    }

    try {
      await this.ensureAuth();
      const listToSeed = (studentsToSeed && studentsToSeed.length > 0)
        ? studentsToSeed
        : (this.getStudents().length > 0 ? this.getStudents() : generateInitialStudents());

      // Save locally first
      this.bulkSaveStudents(listToSeed);

      // Write in chunks to Firestore
      const CHUNK_SIZE = 400;
      for (let i = 0; i < listToSeed.length; i += CHUNK_SIZE) {
        const chunk = listToSeed.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(this.db!);
        chunk.forEach((st) => {
          const docRef = doc(this.db!, 'students', sanitizeDocId(st.id));
          batch.set(docRef, cleanForFirestore(st), { merge: true });
        });
        await batch.commit();
      }

      console.log(`[Firebase] Successfully seeded ${listToSeed.length} students to Firestore`);
      return { success: true, count: listToSeed.length };
    } catch (err: any) {
      console.error('[Firebase] Failed to create/seed students in Firestore:', err);
      return { success: false, count: 0, error: err?.message || 'ไม่สามารถสร้างข้อมูลนักเรียนบน Firebase ได้' };
    }
  }

  /**
   * ดึงรายชื่อนักเรียนจากฐานข้อมูล Firebase Cloud Firestore โดยตรง
   */
  public async fetchStudentsDirectlyFromFirebase(): Promise<{
    success: boolean;
    count: number;
    students: Student[];
    error?: string;
  }> {
    if (!this.db || !this.firebaseConnected) {
      const ok = this.tryInitFirebaseFromStorage();
      if (!ok || !this.db) {
        return {
          success: false,
          count: this.getStudents().length,
          students: this.getStudents(),
          error: 'ยังไม่ได้เชื่อมต่อกับ Firebase',
        };
      }
    }

    try {
      await this.ensureAuth();
      const snap = await getDocs(collection(this.db!, 'students'));
      if (snap.empty) {
        // If empty in Firestore, automatically create the database on Firestore
        console.log('[Firebase] Student collection in Firestore is empty. Auto-seeding students now...');
        const seedResult = await this.createAndSeedStudentsInFirebase();
        const current = this.getStudents();
        return {
          success: seedResult.success,
          count: current.length,
          students: current,
          error: seedResult.error,
        };
      }

      const remoteStudents: Student[] = [];
      snap.forEach((d) => remoteStudents.push(d.data() as Student));
      remoteStudents.sort((a, b) => a.studentNumber - b.studentNumber);

      // Cache locally
      localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(remoteStudents));
      return {
        success: true,
        count: remoteStudents.length,
        students: remoteStudents,
      };
    } catch (err: any) {
      console.error('[Firebase] Error fetching students from Firestore:', err);
      return {
        success: false,
        count: this.getStudents().length,
        students: this.getStudents(),
        error: err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลนักเรียนจาก Firebase',
      };
    }
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
  /**
   * ส่งออกไฟล์สำรองข้อมูลฉบับสมบูรณ์ (รายชื่อนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน, เวลาเรียน, ข้อมูลสถานศึกษา)
   */
  public exportBackupJSON(): string {
    const students = this.getStudents();
    const subjects = this.getSubjects();
    const users = this.getUsers();
    const assignments = this.getAssignments();
    const scores = this.getScores();
    const attendance = this.getAttendanceRecords();
    const schoolSettings = this.getSchoolSettings();

    const backup = {
      system: 'School Grading & Evaluation Management System',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      summary: {
        totalStudents: students.length,
        totalSubjects: subjects.length,
        totalUsers: users.length,
        totalAssignments: assignments.length,
        totalScores: scores.length,
        totalAttendanceRecords: attendance.length,
      },
      students,
      subjects,
      users,
      assignments,
      scores,
      attendance,
      schoolSettings,
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * นำเข้าและกู้คืนข้อมูลทั้งหมดจากไฟล์สำรอง JSON (รายชื่อนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน, เวลาเรียน)
   */
  public importBackupJSON(jsonString: string): { 
    success: boolean; 
    message: string;
    counts?: {
      students: number;
      subjects: number;
      users: number;
      assignments: number;
      scores: number;
      attendance: number;
      schoolSettings: boolean;
    };
  } {
    try {
      const data = JSON.parse(jsonString);
      let studentsCount = 0;
      let subjectsCount = 0;
      let usersCount = 0;
      let assignmentsCount = 0;
      let scoresCount = 0;
      let attendanceCount = 0;
      let schoolSettingsRestored = false;

      // 1. Restore Students (รายชื่อนักเรียน)
      if (data.students && Array.isArray(data.students)) {
        const sanitizedStudents = data.students.map((s: any) => ({
          ...s,
          id: sanitizeDocId(s.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.STUDENTS, JSON.stringify(sanitizedStudents));
        studentsCount = sanitizedStudents.length;
      }

      // 2. Restore Subjects (รายวิชาทั้งหมด)
      if (data.subjects && Array.isArray(data.subjects)) {
        const sanitizedSubjects = data.subjects.map((sub: any) => ({
          ...sub,
          id: sanitizeDocId(sub.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.SUBJECTS, JSON.stringify(sanitizedSubjects));
        subjectsCount = sanitizedSubjects.length;
      }

      // 3. Restore Users & Subject Teachers (ครูประจำวิชา, ชื่อผู้ใช้, บัญชีผู้ใช้งาน)
      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        const sanitizedUsers = data.users.map((u: any) => ({
          ...u,
          id: sanitizeDocId(u.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.USERS, JSON.stringify(sanitizedUsers));
        usersCount = sanitizedUsers.length;
      }

      // 4. Restore Assignments (ใบงานและช่องคะแนน)
      if (data.assignments && Array.isArray(data.assignments)) {
        const sanitizedAssignments = data.assignments.map((a: any) => ({
          ...a,
          id: sanitizeDocId(a.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(sanitizedAssignments));
        assignmentsCount = sanitizedAssignments.length;
      }

      // 5. Restore Scores (คะแนนเก็บและเกรด)
      if (data.scores && Array.isArray(data.scores)) {
        const sanitizedScores = data.scores.map((sc: any) => ({
          ...sc,
          id: sanitizeDocId(sc.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.SCORES, JSON.stringify(sanitizedScores));
        scoresCount = sanitizedScores.length;
      }

      // 6. Restore Attendance (บันทึกเวลาเรียน)
      if (data.attendance && Array.isArray(data.attendance)) {
        const sanitizedAttendance = data.attendance.map((att: any) => ({
          ...att,
          id: sanitizeDocId(att.id),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(sanitizedAttendance));
        attendanceCount = sanitizedAttendance.length;
      }

      // 7. Restore School Settings (ข้อมูลสถานศึกษา)
      if (data.schoolSettings && typeof data.schoolSettings === 'object') {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SCHOOL_SETTINGS, JSON.stringify(data.schoolSettings));
        schoolSettingsRestored = true;
      }

      // Sync to Firebase if connected
      if (this.db && this.firebaseConnected) {
        this.syncAllLocalDataToFirebase().catch((err) => {
          console.warn('Auto-sync to Firebase after restore:', err);
        });
      }

      const summaryParts: string[] = [];
      if (studentsCount > 0) summaryParts.push(`นักเรียน ${studentsCount} คน`);
      if (subjectsCount > 0) summaryParts.push(`รายวิชา ${subjectsCount} วิชา`);
      if (usersCount > 0) summaryParts.push(`ครู/ผู้ใช้ ${usersCount} คน`);
      if (assignmentsCount > 0) summaryParts.push(`ใบงาน ${assignmentsCount} รายการ`);
      if (scoresCount > 0) summaryParts.push(`คะแนน ${scoresCount} ชุด`);
      if (attendanceCount > 0) summaryParts.push(`เวลาเรียน ${attendanceCount} รายการ`);

      const message = summaryParts.length > 0 
        ? `กู้คืนข้อมูลสำเร็จ: ${summaryParts.join(', ')}`
        : 'นำเข้าข้อมูลสำรองเรียบร้อยสมบูรณ์';

      return { 
        success: true, 
        message,
        counts: {
          students: studentsCount,
          subjects: subjectsCount,
          users: usersCount,
          assignments: assignmentsCount,
          scores: scoresCount,
          attendance: attendanceCount,
          schoolSettings: schoolSettingsRestored,
        }
      };
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
