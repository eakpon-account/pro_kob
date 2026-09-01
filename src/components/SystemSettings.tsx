import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Users, 
  Cloud, 
  Database, 
  School, 
  AlertTriangle, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  FileJson, 
  ShieldCheck, 
  Key, 
  Lock, 
  Mail, 
  Info,
  Calendar,
  Award,
  Layers,
  ExternalLink,
  Copy
} from 'lucide-react';
import { FirebaseCustomConfig, SchoolSettings, Subject, User } from '../types';
import { storage, DEFAULT_SCHOOL_SETTINGS, DEFAULT_FIREBASE_CONFIG } from '../services/storage';
import { UserManagement } from './UserManagement';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export type SettingsTabId = 'users' | 'firebase' | 'backup' | 'general' | 'danger';

interface SystemSettingsProps {
  currentUser: User;
  subjects: Subject[];
  onUserChange: (user: User) => void;
  onNavigateToSubjects?: () => void;
  firebaseStatus: { connected: boolean; projectId?: string };
  onRefreshFirebaseStatus: () => void;
  onDataReset: () => void;
  initialTab?: SettingsTabId;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  currentUser,
  subjects,
  onUserChange,
  onNavigateToSubjects,
  firebaseStatus,
  onRefreshFirebaseStatus,
  onDataReset,
  initialTab = 'users',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Status notification banner
  const [statusMessage, setStatusMessage] = useState<{ 
    type: 'success' | 'error' | 'deleted'; 
    text: string; 
    subText?: string 
  } | null>(null);

  // General School Settings Form State
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => storage.getSchoolSettings());
  const [isSavingSchool, setIsSavingSchool] = useState(false);

  // Firebase Config Form State
  const [apiKey, setApiKey] = useState(DEFAULT_FIREBASE_CONFIG.apiKey || '');
  const [projectId, setProjectId] = useState(firebaseStatus.projectId || DEFAULT_FIREBASE_CONFIG.projectId || '');
  const [authDomain, setAuthDomain] = useState(DEFAULT_FIREBASE_CONFIG.authDomain || '');
  const [storageBucket, setStorageBucket] = useState(DEFAULT_FIREBASE_CONFIG.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(DEFAULT_FIREBASE_CONFIG.messagingSenderId || '');
  const [appId, setAppId] = useState(DEFAULT_FIREBASE_CONFIG.appId || '');
  const [configSnippet, setConfigSnippet] = useState(`const firebaseConfig = {
  apiKey: "${DEFAULT_FIREBASE_CONFIG.apiKey}",
  authDomain: "${DEFAULT_FIREBASE_CONFIG.authDomain}",
  projectId: "${DEFAULT_FIREBASE_CONFIG.projectId}",
  storageBucket: "${DEFAULT_FIREBASE_CONFIG.storageBucket}",
  messagingSenderId: "${DEFAULT_FIREBASE_CONFIG.messagingSenderId}",
  appId: "${DEFAULT_FIREBASE_CONFIG.appId}"
};`);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [firebaseMsg, setFirebaseMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncDetails, setSyncDetails] = useState<string | null>(null);

  // Load existing saved Firebase config on mount
  useEffect(() => {
    const saved = localStorage.getItem('school_grading_firebase_config_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.projectId) setProjectId(parsed.projectId);
        if (parsed.authDomain) setAuthDomain(parsed.authDomain);
        if (parsed.storageBucket) setStorageBucket(parsed.storageBucket);
        if (parsed.messagingSenderId) setMessagingSenderId(parsed.messagingSenderId);
        if (parsed.appId) setAppId(parsed.appId);
        setConfigSnippet(`const firebaseConfig = {
  apiKey: "${parsed.apiKey || ''}",
  authDomain: "${parsed.authDomain || ''}",
  projectId: "${parsed.projectId || ''}",
  storageBucket: "${parsed.storageBucket || ''}",
  messagingSenderId: "${parsed.messagingSenderId || ''}",
  appId: "${parsed.appId || ''}"
};`);
      } catch (e) {}
    }
  }, []);

  // Handle Apply Snippet
  const handleApplySnippet = () => {
    if (!configSnippet.trim()) {
      setFirebaseMsg({ text: 'กรุณาวางโค้ด Firebase Configuration ในช่องข้อความ', success: false });
      return;
    }
    const parsed = storage.parseFirebaseConfigSnippet(configSnippet);
    if (!parsed) {
      setFirebaseMsg({ text: 'รูปแบบโค้ดไม่ถูกต้อง กรุณาวาง const firebaseConfig = { ... } หรือ JSON', success: false });
      return;
    }

    setApiKey(parsed.apiKey);
    setProjectId(parsed.projectId);
    setAuthDomain(parsed.authDomain || '');
    setStorageBucket(parsed.storageBucket || '');
    setAppId(parsed.appId || '');
    setMessagingSenderId(parsed.messagingSenderId || '');

    const ok = storage.initFirebase(parsed);
    if (ok) {
      setFirebaseMsg({ text: `เชื่อมต่อ Firebase สำเร็จ! โปรเจกต์: ${parsed.projectId}`, success: true });
      onRefreshFirebaseStatus();
      setStatusMessage({
        type: 'success',
        text: `เชื่อมต่อ Firebase สำเร็จ (โปรเจกต์: ${parsed.projectId})`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setFirebaseMsg({ text: 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบ apiKey หรือ projectId', success: false });
    }
  };

  const handleApplyDefaultConfig = () => {
    const defaultSnippet = `const firebaseConfig = {
  apiKey: "AIzaSyDtEeZJ0IuEh-U28va9XRZBXd4iVPnMhB4",
  authDomain: "my-project-1505207518592.firebaseapp.com",
  projectId: "my-project-1505207518592",
  storageBucket: "my-project-1505207518592.firebasestorage.app",
  messagingSenderId: "425941727917",
  appId: "1:425941727917:web:b88a9baf3d21cbeb2ea424"
};`;
    setConfigSnippet(defaultSnippet);
    setApiKey(DEFAULT_FIREBASE_CONFIG.apiKey);
    setProjectId(DEFAULT_FIREBASE_CONFIG.projectId);
    setAuthDomain(DEFAULT_FIREBASE_CONFIG.authDomain || '');
    setStorageBucket(DEFAULT_FIREBASE_CONFIG.storageBucket || '');
    setMessagingSenderId(DEFAULT_FIREBASE_CONFIG.messagingSenderId || '');
    setAppId(DEFAULT_FIREBASE_CONFIG.appId || '');

    const ok = storage.initFirebase(DEFAULT_FIREBASE_CONFIG);
    if (ok) {
      setFirebaseMsg({ text: 'เชื่อมต่อโปรเจกต์ my-project-1505207518592 สำเร็จ!', success: true });
      onRefreshFirebaseStatus();
      setStatusMessage({
        type: 'success',
        text: 'เชื่อมต่อโปรเจกต์ my-project-1505207518592 สำเร็จ',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 3000);
  };

  // Danger / Clear Data Form State
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [showDemoResetConfirm, setShowDemoResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Sync initial tab when changed from props
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Handle Save School Info
  const handleSaveSchoolInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchool(true);
    try {
      const updated = storage.saveSchoolSettings(schoolSettings);
      setSchoolSettings(updated);
      setStatusMessage({
        type: 'success',
        text: 'บันทึกการตั้งค่าสถานศึกษาเรียบร้อยแล้ว',
        subText: `ปีการศึกษา ${updated.academicYear} ภาคเรียนที่ ${updated.currentSemester}`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message,
      });
    } finally {
      setIsSavingSchool(false);
    }
  };

  // Handle Save Firebase Config
  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setFirebaseMsg({ text: 'กรุณากรอก API Key และ Project ID ให้ครบถ้วน', success: false });
      return;
    }

    const config: FirebaseCustomConfig = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    const ok = storage.initFirebase(config);
    if (ok) {
      setFirebaseMsg({ text: 'เชื่อมต่อและบันทึกการตั้งค่า Firebase สำเร็จ!', success: true });
      onRefreshFirebaseStatus();
      setStatusMessage({
        type: 'success',
        text: 'เชื่อมต่อฐานข้อมูล Firebase เรียบร้อยแล้ว',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setFirebaseMsg({ text: 'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบข้อมูล config', success: false });
    }
  };

  // Handle Sync All Data to Firebase
  const handleSyncAllToFirebase = async () => {
    setIsSyncingFirebase(true);
    setSyncDetails(null);
    try {
      const res = await storage.syncAllLocalDataToFirebase();
      if (res.success) {
        setSyncDetails(
          `อัปโหลดสำเร็จ: นักเรียน ${res.counts.students} คน, รายวิชา ${res.counts.subjects} วิชา, ใบงาน ${res.counts.assignments} รายการ, บันทึกคะแนน ${res.counts.scores} รายการ, บันทึกเวลาเรียน ${res.counts.attendance} แผ่น, บัญชีผู้ใช้ ${res.counts.users} บัญชี`
        );
        setStatusMessage({
          type: 'success',
          text: 'นำข้อมูลทั้งหมดขึ้น Cloud Firestore เรียบร้อยแล้ว!',
          subText: `ข้อมูลถูกซิงค์ไปยัง Firebase โครงการ "${firebaseStatus.projectId || 'หลัก'}" สมบูรณ์`,
        });
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'ไม่สามารถนำข้อมูลขึ้น Firebase ได้: ' + (res.error || 'ข้อผิดพลาดไม่ทราบสาเหตุ'),
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase: ' + err.message,
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // Handle Test Firebase Connection & Permissions
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestFirebasePermissions = async () => {
    setIsTestingFirebase(true);
    setTestResult(null);
    try {
      const res = await storage.testFirebasePermissions();
      setTestResult({
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'ทดสอบสิทธิ์ Firestore สำเร็จ สามารถใช้งานได้สมบูรณ์',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'สิทธิ์ Firestore ยังถูกล็อก กรุณาแก้ไข Rules ใน Firebase Console',
        });
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'เกิดข้อผิดพลาดในการทดสอบ: ' + (err?.message || err),
      });
    } finally {
      setIsTestingFirebase(false);
    }
  };

  // Download Backup JSON
  const handleDownloadBackup = () => {
    const jsonStr = storage.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `School_Grading_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage({
      type: 'success',
      text: 'ส่งออกไฟล์สำรองข้อมูล JSON สำเร็จเรียบร้อย',
      subText: 'ครอบคลุม: รายชื่อนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน และเวลาเรียนครบถ้วน',
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Import Backup JSON
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = storage.importBackupJSON(text);
        if (res.success) {
          setImportStatus(res.message);
          onDataReset();
          setStatusMessage({
            type: 'success',
            text: 'นำเข้าและกู้คืนข้อมูลสำเร็จสมบูรณ์!',
            subText: res.message,
          });
          setTimeout(() => setStatusMessage(null), 5000);
        } else {
          setImportStatus(`เกิดข้อผิดพลาด: ${res.message}`);
          setStatusMessage({
            type: 'error',
            text: `ไม่สามารถนำเข้าข้อมูลได้: ${res.message}`,
          });
        }
      } catch (err: any) {
        setImportStatus(`ไม่สามารถอ่านไฟล์ได้: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Clear Only Student & Score Data (Preserves Users / Teachers)
  const handleClearStudentDataOnly = () => {
    if (confirmText !== 'DELETE_STUDENT_DATA') {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาพิมพ์ข้อความ DELETE_STUDENT_DATA ให้ถูกต้องเพื่อยืนยันการล้างข้อมูล',
      });
      return;
    }

    setIsClearing(true);
    setTimeout(() => {
      storage.clearStudentAndGradeDataOnly();
      setIsClearing(false);
      setConfirmText('');
      onDataReset();
      setStatusMessage({
        type: 'deleted',
        text: 'ล้างข้อมูลนักเรียนและคะแนนทั้งหมดเรียบร้อยแล้ว',
        subText: 'ข้อมูลนักเรียน รายชื่อ ใบงาน และคะแนนทุกวิชาถูกล้างแล้ว (บัญชีผู้ใช้ครูและผู้ดูแลระบบยังคงอยู่ปลอดภัย)',
      });
      setTimeout(() => setStatusMessage(null), 5000);
    }, 500);
  };

  // Reset to Demo Data
  const handleConfirmResetToDemo = () => {
    storage.resetToDemoData();
    onDataReset();
    setShowDemoResetConfirm(false);
    setStatusMessage({
      type: 'success',
      text: 'รีเซ็ตข้อมูลเป็นชุดสาธิตตั้งต้นเรียบร้อยแล้ว',
      subText: 'โหลดข้อมูลนักเรียนชั้น ม.1 - ม.3 และคะแนนตัวอย่างสำหรับการประเมินผลเรียบร้อย',
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const usersList = storage.getUsers();

  const tabConfigs = [
    {
      id: 'users' as SettingsTabId,
      label: 'จัดการผู้ใช้งาน & กำหนดสิทธิ์',
      shortLabel: 'ผู้ใช้งาน & สิทธิ์',
      icon: Users,
      badge: `${usersList.length} คน`,
      color: 'purple',
    },
    {
      id: 'firebase' as SettingsTabId,
      label: 'ฐานข้อมูลคลาวด์ Firebase',
      shortLabel: 'Firebase Cloud',
      icon: Cloud,
      badge: firebaseStatus.connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อม',
      color: 'amber',
    },
    {
      id: 'backup' as SettingsTabId,
      label: 'สำรอง & กู้คืนข้อมูล (JSON)',
      shortLabel: 'สำรอง & กู้คืน',
      icon: Database,
      badge: 'Backup',
      color: 'emerald',
    },
    {
      id: 'general' as SettingsTabId,
      label: 'ข้อมูลสถานศึกษา & เกณฑ์ตัดเกรด',
      shortLabel: 'สถานศึกษา & เกรด',
      icon: School,
      badge: `ปี ${schoolSettings.academicYear}`,
      color: 'indigo',
    },
    {
      id: 'danger' as SettingsTabId,
      label: 'ล้างข้อมูล & พื้นที่อันตราย',
      shortLabel: 'ล้างข้อมูล & รีเซ็ต',
      icon: AlertTriangle,
      badge: 'Reset',
      color: 'rose',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-xs">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                  ตั้งค่าระบบและการจัดการข้อมูล (System Settings)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  ศูนย์รวมการตั้งค่า
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                จัดการบัญชีผู้ใช้งานและกำหนดสิทธิ์, ฐานข้อมูลคลาวด์, สำรองข้อมูล และเกณฑ์การประเมินผล
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>ผู้ใช้งาน <b>{usersList.length}</b> บัญชี</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              <Cloud className={`w-3.5 h-3.5 ${firebaseStatus.connected ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Firebase: <b>{firebaseStatus.connected ? 'เชื่อมต่อแล้ว' : 'ออฟไลน์ (ในเครื่อง)'}</b></span>
            </div>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : statusMessage.type === 'deleted'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === 'deleted' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <div>
                <p className="font-bold">{statusMessage.text}</p>
                {statusMessage.subText && (
                  <p className="text-[11px] opacity-80 mt-0.5">{statusMessage.subText}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

      </div>

      {/* Tab Content 1: User Management & Permissions */}
      {activeTab === 'users' && (
        <div className="animate-fadeIn">
          <UserManagement
            currentUser={currentUser}
            subjects={subjects}
            onUserChange={onUserChange}
            onNavigateToSubjects={onNavigateToSubjects}
          />
        </div>
      )}

      {/* Tab Content 2: Firebase Cloud Database */}
      {activeTab === 'firebase' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-amber-600" />
              <span>การเชื่อมต่อฐานข้อมูลคลาวด์ Firebase Firestore</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              เชื่อมต่อฐานข้อมูล Firestore เพื่อให้ครูหลายท่านสามารถบันทึกคะแนน ตัดเกรด และซิงค์ข้อมูลร่วมกันได้แบบเรียลไทม์ (Real-time Cloud Sync)
            </p>
          </div>

          {/* Status Alert */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            firebaseStatus.connected 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className={`p-2 rounded-lg ${firebaseStatus.connected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold">
                {firebaseStatus.connected ? 'เชื่อมต่อฐานข้อมูลคลาวด์สำเร็จ (Firebase Connected)' : 'ปัจจุบันทำงานในโหมด Offline (จัดเก็บในเครื่อง)'}
              </h4>
              <p className="text-[11px] mt-0.5 opacity-90">
                {firebaseStatus.connected 
                  ? `โครงการ: ${firebaseStatus.projectId || 'พร้อมใช้งาน'} — ข้อมูลรายวิชา คะแนน และนักเรียนจะถูกซิงค์ไปยัง Firestore อัตโนมัติ`
                  : 'ข้อมูลจะถูกบันทึกลงใน LocalStorage ของเบราว์เซอร์นี้ หากต้องการใช้งานร่วมกันหลายเครื่อง ให้กรอกค่า Firebase Configuration ด้านล่าง'}
              </p>
            </div>
          </div>

          {/* Firebase Quick Config Snippet Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-white">กล่องรับข้อมูล Firebase Configuration (Code Snippet)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleApplyDefaultConfig}
                  className="px-2.5 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-md border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                  title="ใส่ค่าเริ่มต้นของโปรเจกต์นี้"
                >
                  <span>1-Click ใช้ค่าโปรเจกต์นี้</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              ท่านสามารถวางโค้ด <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">const firebaseConfig = &#123; ... &#125;;</code> หรือ JSON ที่ได้จาก Firebase Console ลงในกล่องนี้ แล้วกด <b>"แยกข้อมูลและเชื่อมต่อทันที"</b> ได้เลย
            </p>

            <div className="relative">
              <textarea
                value={configSnippet}
                onChange={(e) => setConfigSnippet(e.target.value)}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-project.firebaseapp.com",\n  projectId: "my-project-1505207518592",\n  storageBucket: "my-project.firebasestorage.app",\n  messagingSenderId: "425941727917",\n  appId: "1:425941727917:web:b88a9baf3d21cbeb2ea424"\n};`}
                rows={7}
                className="w-full font-mono text-xs p-3 bg-slate-950 text-amber-300 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-400 resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApplySnippet}
                className="px-4 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-900" />
                <span>แยกข้อมูลและเชื่อมต่อทันที (Parse & Connect)</span>
              </button>
            </div>
          </div>

          {/* Firebase Form */}
          <form onSubmit={handleSaveFirebaseConfig} className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                รายละเอียดการตั้งค่าแยกตามช่อง (Configuration Fields)
              </h4>
            </div>

            {firebaseMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                firebaseMsg.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {firebaseMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{firebaseMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-project-1505207518592"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="my-project-1505207518592.firebaseapp.com"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Storage Bucket
                </label>
                <input
                  type="text"
                  value={storageBucket}
                  onChange={(e) => setStorageBucket(e.target.value)}
                  placeholder="my-project-1505207518592.firebasestorage.app"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Messaging Sender ID
                </label>
                <input
                  type="text"
                  value={messagingSenderId}
                  onChange={(e) => setMessagingSenderId(e.target.value)}
                  placeholder="425941727917"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:425941727917:web:b88a9baf3d21cbeb2ea424"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 font-mono bg-white"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกและเชื่อมต่อ Firebase</span>
              </button>

              <button
                type="button"
                onClick={handleTestFirebasePermissions}
                disabled={isTestingFirebase}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-300 disabled:opacity-50"
              >
                {isTestingFirebase ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>ทดสอบการเชื่อมต่อ & สิทธิ์ (Test Connection)</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3.5 rounded-xl border text-xs ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold">{testResult.success ? 'ผลการทดสอบ: สำเร็จ' : 'ผลการทดสอบ: ยังติดสิทธิ์การเข้าถึง'}</p>
                    <p className="leading-relaxed">{testResult.message}</p>
                    {!testResult.success && (
                      <div className="pt-1">
                        <a
                          href={`https://console.firebase.google.com/project/${projectId || 'my-project-1505207518592'}/firestore/rules`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 underline"
                        >
                          <span>คลิกตรงนี้เพื่อไปหน้า Firebase Console Rules &gt; วางโค้ด &gt; กด Publish</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Sync All Local Data to Firebase Cloud */}
          <div className="pt-6 border-t border-slate-100">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <span>นำข้อมูลปัจจุบันทั้งหมดขึ้น Cloud Firestore ทันที</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    ส่งข้อมูลนักเรียน, รายวิชา, ใบงาน, คะแนนตัดเกรด, การเช็คชื่อ และการตั้งค่าทั้งหมดที่มีอยู่ในระบบปัจจุบันขึ้นไปยังฐานข้อมูล Firebase Cloud
                  </p>
                  {syncDetails && (
                    <div className="mt-2 text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                      {syncDetails}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSyncAllToFirebase}
                  disabled={isSyncingFirebase}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isSyncingFirebase ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังส่งข้อมูลขึ้น Cloud...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4 text-white" />
                      <span>ส่งข้อมูลทั้งหมดขึ้น Cloud เดี๋ยวนี้</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>การสำรองข้อมูล (Backup) และกู้คืนข้อมูล (Restore)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ดาวน์โหลดไฟล์สำรองข้อมูล JSON เก็บไว้เพื่อความปลอดภัย หรือนำเข้าไฟล์สำรองเพื่อย้ายเครื่องและกู้คืนคะแนน
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Export JSON Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                  <Download className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">ส่งออกข้อมูลสำรอง (Full System Backup JSON)</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed mb-3">
                  ดาวน์โหลดข้อมูลทั้งหมดในระบบเก็บไว้ในคอมพิวเตอร์ของคุณในรูปแบบไฟล์ .json ไฟล์เดียว
                </p>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium text-slate-700">รายชื่อนักเรียน</span>
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-slate-700">ครูประจำวิชา & ชื่อผู้ใช้</span>
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-medium text-slate-700">รายวิชาทั้งหมด</span>
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-medium text-slate-700">ใบงาน & คะแนนเก็บ</span>
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="font-medium text-slate-700">การคำนวณตัดเกรด</span>
                  </div>
                  <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    <span className="font-medium text-slate-700">บันทึกเวลาเรียน</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
              </button>
            </div>

            {/* Import JSON Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">นำเข้าไฟล์สำรองข้อมูล (Restore Data)</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed mb-3">
                  เลือกไฟล์สำรองข้อมูล .json ที่เคยส่งออกไว้ เพื่อกู้คืนข้อมูลนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน และเวลาเรียน
                </p>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                  💡 ระบบจะทำการกู้คืนข้อมูลครบทุกตาราง และหากเชื่อมต่อ Firebase อยู่ ระบบจะซิงค์ข้อมูลขึ้น Cloud ให้ทันที
                </div>
              </div>

              <div>
                {importStatus && (
                  <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium">
                    {importStatus}
                  </div>
                )}
                <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์สำรองข้อมูล (.json)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

          </div>

          {/* Reset to Demo Template Option */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-purple-50/60 border border-purple-100">
            <div>
              <h4 className="text-xs font-bold text-purple-900">โหลดชุดข้อมูลตัวอย่างสาธิต (Demo Template)</h4>
              <p className="text-[11px] text-purple-700 mt-0.5">
                โหลดตัวอย่างรายชื่อนักเรียนชั้น ม.1 - ม.3 และคะแนนตัวอย่างเพื่อทดสอบการทำงานของระบบ
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDemoResetConfirm(true)}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              โหลดข้อมูลตัวอย่างสาธิต
            </button>
          </div>
        </div>
      )}

      {/* Tab Content 5: School Info & Grading Policy */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <School className="w-4 h-4 text-indigo-600" />
              <span>ข้อมูลสถานศึกษา & เกณฑ์การตัดเกรดมาตรฐาน</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              กำหนดชื่อโรงเรียน ปีการศึกษา ภาคเรียนปัจจุบัน และตรวจสอบเกณฑ์การตัดเกรด 8 ระดับตามหลักสูตรแกนกลาง
            </p>
          </div>

          <form onSubmit={handleSaveSchoolInfo} className="space-y-5 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อสถานศึกษา (ภาษาไทย) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={schoolSettings.schoolName}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolName: e.target.value })}
                  placeholder="เช่น โรงเรียนสาธิตวิทยาคม"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อสถานศึกษา (ภาษาอังกฤษ)
                </label>
                <input
                  type="text"
                  value={schoolSettings.schoolNameEn || ''}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, schoolNameEn: e.target.value })}
                  placeholder="e.g. Satit Wittayakom School"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน่วยงานต้นสังกัด
                </label>
                <input
                  type="text"
                  value={schoolSettings.affiliation || ''}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, affiliation: e.target.value })}
                  placeholder="เช่น สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จังหวัด / ที่ตั้ง
                </label>
                <input
                  type="text"
                  value={schoolSettings.province || ''}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, province: e.target.value })}
                  placeholder="เช่น กรุงเทพมหานคร"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ปีการศึกษาปัจจุบัน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={schoolSettings.academicYear}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, academicYear: e.target.value })}
                  placeholder="เช่น 2568"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ภาคเรียนเริ่มต้นระบบ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={schoolSettings.currentSemester}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, currentSemester: Number(e.target.value) as 1 | 2 })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-semibold"
                >
                  <option value={1}>ภาคเรียนที่ 1</option>
                  <option value={2}>ภาคเรียนที่ 2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้อำนวยการ / ผู้บริหารสถานศึกษา
                </label>
                <input
                  type="text"
                  value={schoolSettings.directorName || ''}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, directorName: e.target.value })}
                  placeholder="เช่น ดร.วิชาการ พัฒนาการศึกษา"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุ / ระเบียบการประเมิน
                </label>
                <input
                  type="text"
                  value={schoolSettings.evaluationNote || ''}
                  onChange={(e) => setSchoolSettings({ ...schoolSettings, evaluationNote: e.target.value })}
                  placeholder="เกณฑ์การประเมินตามหลักสูตรแกนกลาง พ.ศ. 2551"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

            </div>

            {/* Standard 8-Grade Matrix Display */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  ตารางเกณฑ์การตัดเกรดมาตรฐาน 8 ระดับ (ตามหลักสูตรกระทรวงศึกษาธิการ)
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center text-xs">
                {[
                  { grade: '4.0', range: '80 - 100', text: 'ดีเยี่ยม', bg: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
                  { grade: '3.5', range: '75 - 79', text: 'ดีมาก', bg: 'bg-emerald-50/70 border-emerald-200 text-emerald-700' },
                  { grade: '3.0', range: '70 - 74', text: 'ดี', bg: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { grade: '2.5', range: '65 - 69', text: 'ค่อนข้างดี', bg: 'bg-blue-50/70 border-blue-200 text-blue-700' },
                  { grade: '2.0', range: '60 - 64', text: 'ปานกลาง', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { grade: '1.5', range: '55 - 59', text: 'พอใช้', bg: 'bg-amber-50/70 border-amber-200 text-amber-700' },
                  { grade: '1.0', range: '50 - 54', text: 'ผ่านเกณฑ์', bg: 'bg-orange-50 border-orange-200 text-orange-700' },
                  { grade: '0', range: '0 - 49', text: 'ต่ำกว่าเกณฑ์', bg: 'bg-rose-50 border-rose-200 text-rose-700' },
                ].map((g) => (
                  <div key={g.grade} className={`p-2.5 rounded-xl border ${g.bg}`}>
                    <div className="font-extrabold text-sm">{g.grade}</div>
                    <div className="text-[10px] font-medium opacity-80 mt-0.5">{g.range}</div>
                    <div className="text-[9px] font-bold mt-0.5">{g.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingSchool}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {isSavingSchool ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>บันทึกการตั้งค่าสถานศึกษา</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Tab Content 6: Danger Zone & Clear Data */}
      {activeTab === 'danger' && (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-2xs space-y-6 animate-fadeIn">
          <div className="border-b border-rose-100 pb-4">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>พื้นที่จัดการข้อมูลความเสี่ยงสูง (Danger Zone)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              การดำเนินการในส่วนนี้จะล้างข้อมูลถาวร กรุณาตรวจสอบและสำรองข้อมูล (Export JSON) ก่อนเริ่มดำเนินการ
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-900">
                  ล้างข้อมูลนักเรียนและคะแนนทั้งหมด (Clear Students & Scores Only)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  จะทำการล้างข้อมูล <b>รายชื่อนักเรียนทั้งหมด, ใบงานทั้งหมด และคะแนนทุกวิชา</b> โดย <b>ไม่ลบบัญชีผู้ใช้ครูและแอดมินในระบบ</b> เพื่อให้เริ่มบันทึกข้อมูลปีการศึกษาใหม่ได้อย่างปลอดภัย
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-rose-200/60">
              <label className="block text-xs font-semibold text-rose-900">
                พิมพ์คำว่า <span className="font-mono bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-700">DELETE_STUDENT_DATA</span> เพื่อยืนยัน:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE_STUDENT_DATA"
                className="w-full max-w-md text-xs p-2.5 border border-rose-300 rounded-lg bg-white focus:ring-1 focus:ring-rose-500 font-mono text-rose-900"
              />
            </div>

            <button
              type="button"
              onClick={handleClearStudentDataOnly}
              disabled={confirmText !== 'DELETE_STUDENT_DATA' || isClearing}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isClearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>ยืนยันการล้างข้อมูลนักเรียนและคะแนน</span>
            </button>
          </div>
        </div>
      )}

      {/* Demo Reset Confirmation Modal */}
      {showDemoResetConfirm && (
        <ConfirmDeleteModal
          isOpen={showDemoResetConfirm}
          title="ยืนยันการโหลดชุดข้อมูลตัวอย่างสาธิต"
          description="การดำเนินการนี้จะโหลดชุดข้อมูลตัวอย่างนักเรียน ม.1 - ม.3 และคะแนนจำลองแทนที่ข้อมูลปัจจุบัน คุณต้องการดำเนินการต่อหรือไม่?"
          confirmText="โหลดข้อมูลตัวอย่าง"
          onConfirm={handleConfirmResetToDemo}
          onClose={() => setShowDemoResetConfirm(false)}
        />
      )}

    </div>
  );
};
