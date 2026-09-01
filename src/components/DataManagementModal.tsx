import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Cloud, 
  Key, 
  X, 
  RefreshCw, 
  FileJson, 
  CheckCircle2 
} from 'lucide-react';
import { storage, DEFAULT_FIREBASE_CONFIG } from '../services/storage';
import { FirebaseCustomConfig } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface DataManagementModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onDataReset: () => void;
  firebaseStatus: { connected: boolean; projectId?: string };
  onRefreshFirebaseStatus: () => void;
  initialTab?: 'backup' | 'clear' | 'firebase';
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen = true,
  onClose,
  onDataReset,
  firebaseStatus,
  onRefreshFirebaseStatus,
  initialTab = 'backup',
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'clear' | 'firebase'>(initialTab);
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showDemoResetConfirm, setShowDemoResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);

  // Close on Escape key press
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Firebase Config Form
  const [apiKey, setApiKey] = useState(DEFAULT_FIREBASE_CONFIG.apiKey || '');
  const [projectId, setProjectId] = useState(DEFAULT_FIREBASE_CONFIG.projectId || '');
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
  const [firebaseMsg, setFirebaseMsg] = useState<{ text: string; success: boolean } | null>(null);

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
    } else {
      setFirebaseMsg({ text: 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบ apiKey หรือ projectId', success: false });
    }
  };

  const handleApplyDefaultConfig = () => {
    const ok = storage.initFirebase(DEFAULT_FIREBASE_CONFIG);
    if (ok) {
      setApiKey(DEFAULT_FIREBASE_CONFIG.apiKey);
      setProjectId(DEFAULT_FIREBASE_CONFIG.projectId);
      setAuthDomain(DEFAULT_FIREBASE_CONFIG.authDomain || '');
      setAppId(DEFAULT_FIREBASE_CONFIG.appId || '');
      setFirebaseMsg({ text: 'เชื่อมต่อโปรเจกต์ my-project-1505207518592 สำเร็จ!', success: true });
      onRefreshFirebaseStatus();
    }
  };

  // Download Full JSON Backup
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
      subText: 'ไฟล์สำรองประกอบด้วย รายชื่อนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน และเวลาเรียนครบถ้วน',
    });
  };

  // Import JSON Backup
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
        } else {
          setImportStatus(`เกิดข้อผิดพลาด: ${res.message}`);
          setStatusMessage({
            type: 'error',
            text: 'ไม่สามารถนำเข้าไฟล์สำรองข้อมูลได้',
            subText: res.message,
          });
        }
      } catch (err: any) {
        setImportStatus(`ไม่สามารถอ่านไฟล์ได้: ${err.message}`);
        setStatusMessage({
          type: 'error',
          text: 'เกิดข้อผิดพลาดในการอ่านไฟล์',
          subText: err.message,
        });
      }
    };
    reader.readAsText(file);
  };

  // Clear Only Student & Score Data (Preserves Users / Teachers)
  const handleClearStudentDataOnly = () => {
    if (confirmText !== 'DELETE_STUDENT_DATA') {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาพิมพ์ DELETE_STUDENT_DATA ให้ถูกต้องเพื่อยืนยันการล้างข้อมูล',
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
        subText: 'ข้อมูลนักเรียน รายชื่อ ใบงาน และคะแนนทุกวิชาถูกล้างแล้ว (บัญชีผู้ใช้ครู/แอดมินยังคงอยู่)',
      });
    }, 500);
  };

  // Reset to Demo Data
  const handleRequestResetToDemo = () => {
    setShowDemoResetConfirm(true);
  };

  const handleConfirmResetToDemo = () => {
    storage.resetToDemoData();
    onDataReset();
    setShowDemoResetConfirm(false);
    setStatusMessage({
      type: 'success',
      text: 'รีเซ็ตข้อมูลเป็นชุดตัวอย่างเรียบร้อยแล้ว',
      subText: 'โหลดข้อมูลนักเรียนชั้น ม.1 - ม.3 และคะแนนตัวอย่างสำหรับการประเมินผลเรียบร้อย',
    });
  };

  // Save Firebase Config
  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setFirebaseMsg({ text: 'กรุณากรอก API Key และ Project ID', success: false });
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
      setFirebaseMsg({ text: 'เชื่อมต่อ Firebase Firestore สำเร็จเรียบร้อย!', success: true });
      onRefreshFirebaseStatus();
    } else {
      setFirebaseMsg({ text: 'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบข้อมูล Config', success: false });
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
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
        setFirebaseMsg({
          text: 'ทดสอบสิทธิ์ Firestore สำเร็จ! สามารถอ่าน-เขียนข้อมูลได้',
          success: true,
        });
      } else {
        setFirebaseMsg({
          text: 'สิทธิ์ Firestore ยังถูกล็อก กรุณาแก้ไข Rules ใน Firebase Console',
          success: false,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'เกิดข้อผิดพลาดในการทดสอบ: ' + (err?.message || err),
      });
    } finally {
      setIsTestingFirebase(false);
    }
  };

  const handleSyncAllToCloud = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await storage.syncAllLocalDataToFirebase();
      if (res.success) {
        setSyncStatusMsg(
          `ซิงค์ข้อมูลขึ้น Firestore สำเร็จ: นักเรียน ${res.counts.students} คน, วิชา ${res.counts.subjects} วิชา, คะแนน ${res.counts.scores} รายการ, การมาเรียน ${res.counts.attendance} รายการ`
        );
      } else {
        setSyncStatusMsg(`ไม่สำเร็จ: ${res.error}`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                ศูนย์จัดการฐานข้อมูล & สำรองข้อมูล
              </h2>
              <p className="text-xs text-slate-500">
                นำเข้า-ส่งออก, ล้างฐานข้อมูลนักเรียน (แยกส่วนกับผู้ใช้ระบบ), และเชื่อมต่อ Firebase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-100 my-4">
          <button
            onClick={() => { setActiveTab('backup'); setStatusMessage(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            สำรอง & กู้คืนข้อมูล (Backup / Import)
          </button>

          <button
            onClick={() => { setActiveTab('clear'); setStatusMessage(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'clear'
                ? 'border-rose-600 text-rose-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ล้างฐานข้อมูลนักเรียน & คะแนน
          </button>

          <button
            onClick={() => { setActiveTab('firebase'); setStatusMessage(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'firebase'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            การเชื่อมต่อ Firebase
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`p-3.5 rounded-xl border mb-3 flex items-center justify-between animate-in fade-in duration-200 ${
            statusMessage.type === 'deleted' 
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : statusMessage.type === 'error'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'deleted' ? (
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              ) : statusMessage.type === 'error' ? (
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
              <div>
                <p className="text-xs font-bold">{statusMessage.text}</p>
                {statusMessage.subText && (
                  <p className="text-[11px] opacity-80 mt-0.5">{statusMessage.subText}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-4">
          
          {/* TAB 1: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  ส่งออกไฟล์สำรองข้อมูลฉบับสมบูรณ์ (Full System Backup JSON)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  ดาวน์โหลดข้อมูลทั้งหมดในระบบเก็บไว้ในไฟล์เดียว ครอบคลุม:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium text-slate-700">รายชื่อนักเรียนทั้งหมด</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-slate-700">ครูประจำวิชา & ชื่อผู้ใช้</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-medium text-slate-700">รายวิชาทั้งหมด</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-medium text-slate-700">ใบงาน & สัดส่วนคะแนน</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="font-medium text-slate-700">คะแนนเก็บ & ผลการตัดเกรด</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    <span className="font-medium text-slate-700">บันทึกการเช็คชื่อเวลาเรียน</span>
                  </div>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  นำเข้าไฟล์สำรองข้อมูล (Restore from JSON)
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  เลือกไฟล์ .json ที่เคยสำรองไว้เพื่อกู้คืนข้อมูลนักเรียน, ครูประจำวิชา, ชื่อผู้ใช้, รายวิชา, ใบงาน, คะแนน และเวลาเรียน
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJsonFile}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {importStatus && (
                  <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium">
                    {importStatus}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-amber-900">รีเซ็ตเป็นข้อมูลตัวอย่าง (Demo Data)</h4>
                  <p className="text-[11px] text-amber-800">สร้างข้อมูลนักเรียน ม.1 - ม.3 และคะแนนสมจริงสำหรับทดสอบระบบ</p>
                </div>
                <button
                  onClick={handleRequestResetToDemo}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  โหลดข้อมูลตัวอย่าง
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CLEAR STUDENT DATA SAFELY (EXCLUDING USERS) */}
          {activeTab === 'clear' && (
            <div className="space-y-4">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-rose-900">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold">
                      ล้างข้อมูลนักเรียนและคะแนนทั้งหมด (Student & Grade Reset)
                    </h3>
                    <p className="text-xs text-rose-800 mt-1">
                      การดำเนินการนี้จะ <strong>ลบเฉพาะข้อมูลนักเรียน รายชื่อ ใบงาน และคะแนนทั้งหมด</strong> เพื่อเริ่มปีการศึกษาใหม่ โดยจะ <strong>ไม่ลบข้อมูลบัญชีผู้ใช้งานหรือคุณครูในระบบ</strong> ตามข้อกำหนด
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-rose-200">
                  <label className="block text-xs font-semibold text-rose-950 mb-1">
                    พิมพ์ข้อความ <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-300 font-bold">DELETE_STUDENT_DATA</span> เพื่อยืนยัน:
                  </label>
                  <input
                    type="text"
                    placeholder="DELETE_STUDENT_DATA"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-lg focus:ring-1 focus:ring-rose-500 font-mono"
                  />

                  <button
                    disabled={confirmText !== 'DELETE_STUDENT_DATA' || isClearing}
                    onClick={handleClearStudentDataOnly}
                    className="mt-3 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isClearing ? 'กำลังล้างข้อมูล...' : 'ยืนยันล้างข้อมูลนักเรียนและคะแนน'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                <strong>ความปลอดภัย:</strong> บัญชีผู้ดูแลระบบ (Admin) และคุณครู (Teachers) จะได้รับการปกป้องและคงอยู่ในระบบเสมอ
              </div>
            </div>
          )}

          {/* TAB 3: FIREBASE CONNECTION */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              
              {/* Status Banner */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">สถานะฐานข้อมูล</h4>
                    <p className="text-xs text-emerald-800">
                      {firebaseStatus.connected 
                        ? `เชื่อมต่อ Firebase Firestore โครงการ "${firebaseStatus.projectId}" เรียบร้อยแล้ว`
                        : 'ระบบจัดเก็บข้อมูลแบบ High-Speed Persistent Storage พร้อมรองรับการเชื่อมต่อ Firebase Cloud'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {firebaseStatus.connected ? 'Online Sync' : 'Ready'}
                </span>
              </div>

              {/* Paste Snippet Section */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>วางโค้ด Firebase Configuration เพื่อเชื่อมต่อ (Copy & Paste)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  สามารถคัดลอก <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">const firebaseConfig = &#123; ... &#125;;</code> วางแล้วกดเชื่อมต่อได้ทันที
                </p>
                <textarea
                  value={configSnippet}
                  onChange={(e) => setConfigSnippet(e.target.value)}
                  rows={3}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "...",\n  appId: "..."\n};`}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApplySnippet}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>เชื่อมต่อตามโค้ดที่วาง</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyDefaultConfig}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-500" />
                    <span>ใช้โปรเจกต์ของฉัน (my-project-1505207518592)</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveFirebaseConfig} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  ตั้งค่าการเชื่อมต่อ Firebase Web App (Firebase Project Config)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Project ID
                    </label>
                    <input
                      type="text"
                      placeholder="school-grading-2026"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Auth Domain (ตัวเลือกเสริม)
                    </label>
                    <input
                      type="text"
                      placeholder="school.firebaseapp.com"
                      value={authDomain}
                      onChange={(e) => setAuthDomain(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      App ID (ตัวเลือกเสริม)
                    </label>
                    <input
                      type="text"
                      placeholder="1:123456:web:abcd..."
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {firebaseMsg && (
                  <p className={`text-xs font-semibold ${firebaseMsg.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {firebaseMsg.text}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestFirebasePermissions}
                    disabled={isTestingFirebase}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isTestingFirebase ? (
                      <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    <span>ทดสอบสิทธิ์ (Test Connection)</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    บันทึก & เชื่อมต่อ Firebase
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl border text-xs ${
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
                        <p className="font-bold">{testResult.success ? 'ผลการทดสอบ: สำเร็จ' : 'ผลการทดสอบ: ติดสิทธิ์การเข้าถึง'}</p>
                        <p className="leading-relaxed text-[11px]">{testResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </form>

              {/* Sync All Local Data to Firebase Button */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <h5 className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                    <Cloud className="w-4 h-4" />
                    <span>นำข้อมูลปัจจุบันใส่ลงในฐานข้อมูล Firebase</span>
                  </h5>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    อัปโหลดรายชื่อนักเรียน รายวิชา ใบงาน คะแนน และข้อมูลโรงเรียนขึ้น Cloud Firestore
                  </p>
                  {syncStatusMsg && (
                    <p className="text-[11px] text-emerald-300 font-medium mt-1">
                      {syncStatusMsg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSyncAllToCloud}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
                >
                  {isSyncing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังส่งขึ้น Cloud...</span>
                    </>
                  ) : (
                    <span>นำข้อมูลขึ้น Firebase เดี๋ยวนี้</span>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* Confirm Demo Reset Modal */}
      {showDemoResetConfirm && (
        <ConfirmDeleteModal
          isOpen={showDemoResetConfirm}
          title="ยืนยันการรีเซ็ตเป็นชุดข้อมูลตัวอย่าง"
          itemTitle="ชุดข้อมูลโรงเรียนตัวอย่าง (ระดับชั้น ม.1 - ม.3)"
          itemSubtitle="ประกอบด้วยข้อมูลนักเรียน 9 ห้องเรียน, 3 รายวิชาหลัก, ใบงาน และคะแนนสำหรับทดสอบระบบ"
          warningMessage="ข้อมูลนักเรียนและคะแนนปัจจุบันทั้งหมดจะถูกแทนที่ด้วยชุดข้อมูลสาธิต เพื่อการทดลองใช้งานระบบ"
          confirmLabel="ยืนยันรีเซ็ตข้อมูลตัวอย่าง"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmResetToDemo}
          onClose={() => setShowDemoResetConfirm(false)}
        />
      )}

    </div>
  );
};
