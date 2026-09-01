import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sidebar 
} from './components/Navbar';
import { 
  Dashboard 
} from './components/Dashboard';
import { 
  ScoreGrading 
} from './components/ScoreGrading';
import { 
  StudentEvaluation 
} from './components/StudentEvaluation';
import { 
  SubjectAttendance 
} from './components/SubjectAttendance';
import { 
  StudentManagement 
} from './components/StudentManagement';
import { 
  SubjectManagement 
} from './components/SubjectManagement';
import { 
  UserManagement, 
  ROLE_CONFIGS 
} from './components/UserManagement';
import { 
  SystemSettings, 
  SettingsTabId 
} from './components/SystemSettings';
import { 
  DataManagementModal 
} from './components/DataManagementModal';
import { 
  PrintReportModal 
} from './components/PrintReportModal';
import { 
  LoginModal 
} from './components/LoginModal';
import { 
  LoginPage 
} from './components/LoginPage';
import { 
  AvatarUploadModal 
} from './components/AvatarUploadModal';
import { 
  Assignment, 
  Student, 
  StudentSubjectScore, 
  Subject, 
  User 
} from './types';
import { storage } from './services/storage';
import { Menu, Plus, Database, Sparkles, Award, UserCheck, ShieldCheck, LogIn, ArrowRightLeft, Settings, Cloud, RefreshCw } from 'lucide-react';
import { MainTabType } from './components/Navbar';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => storage.isAuthenticated());

  // State
  const [currentTab, setCurrentTab] = useState<MainTabType>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsTabId>('users');
  const [currentUser, setCurrentUser] = useState<User>(() => storage.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => storage.getStudents());
  const [subjects, setSubjects] = useState<Subject[]>(() => storage.getSubjects());
  const [assignments, setAssignments] = useState<Assignment[]>(() => storage.getAssignments());
  const [scores, setScores] = useState<StudentSubjectScore[]>(() => storage.getScores());
  const [firebaseStatus, setFirebaseStatus] = useState(() => storage.getFirebaseStatus());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Deep Link Selection from Dashboard to Grading
  const [targetGradingSubjectId, setTargetGradingSubjectId] = useState<string | undefined>(undefined);
  const [targetGradingClassKey, setTargetGradingClassKey] = useState<string | undefined>(undefined);

  // Modals
  const [showDataModal, setShowDataModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [printModalData, setPrintModalData] = useState<{
    isOpen: boolean;
    subject?: Subject;
    classKey?: string;
    students: Student[];
    scores: StudentSubjectScore[];
    initialSemester?: 1 | 2 | 'combined';
  }>({
    isOpen: false,
    students: [],
    scores: [],
    initialSemester: 1,
  });

  // Reload all data from storage
  const reloadAllData = useCallback(() => {
    setStudents(storage.getStudents());
    setSubjects(storage.getSubjects());
    setAssignments(storage.getAssignments());
    setScores(storage.getScores());
    setCurrentUser(storage.getCurrentUser());
    setFirebaseStatus(storage.getFirebaseStatus());
  }, []);

  // Sync data with Firebase Firestore
  const syncWithCloud = useCallback(async (showFeedback = false) => {
    setIsSyncingCloud(true);
    try {
      const res = await storage.pullAllDataFromFirebase();
      if (res.success) {
        reloadAllData();
        if (showFeedback) {
          setSyncToast(
            res.isEmptyRemote
              ? 'ส่งข้อมูลเริ่มต้นขึ้น Cloud Firestore เรียบร้อยแล้ว'
              : `ดึงข้อมูลล่าสุดจาก Cloud Firestore สำเร็จ (นักเรียน ${res.counts.students} คน, วิชา ${res.counts.subjects} วิชา, คะแนน ${res.counts.scores} รายการ)`
          );
          setTimeout(() => setSyncToast(null), 4500);
        }
      } else if (showFeedback && res.error) {
        setSyncToast(`การดึงข้อมูลจาก Cloud: ${res.error}`);
        setTimeout(() => setSyncToast(null), 5000);
      }
    } catch (err: any) {
      console.error('Cloud sync error:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  }, [reloadAllData]);

  // Initial cloud sync on app start and attach live real-time Firestore listeners
  useEffect(() => {
    // 1. Initial pull
    syncWithCloud(false);

    // 2. Real-time live listener for Firestore changes across all devices/sessions
    const unsubscribe = storage.subscribeToLiveCloudUpdates((dataType) => {
      console.log(`[Firebase Live Sync] Data updated from Cloud: ${dataType}`);
      reloadAllData();
    });

    return () => {
      unsubscribe();
    };
  }, [syncWithCloud, reloadAllData]);

  const handleUserChange = (newUser: User) => {
    storage.setCurrentUser(newUser);
    setCurrentUser(newUser);
  };

  const handleLoginSuccess = (authenticatedUser: User) => {
    handleUserChange(authenticatedUser);
    setIsAuthenticated(true);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    storage.logout();
    setIsAuthenticated(false);
  };

  const handleSelectClassAndSubjectFromDashboard = (subjectId: string, classKey: string) => {
    setTargetGradingSubjectId(subjectId);
    setTargetGradingClassKey(classKey);
    setCurrentTab('grading');
  };

  const handleOpenPrintModal = (
    subject: Subject,
    classKey: string,
    reportStudents: Student[],
    reportScores: StudentSubjectScore[],
    semester: 1 | 2 | 'combined' = 1
  ) => {
    setPrintModalData({
      isOpen: true,
      subject,
      classKey,
      students: reportStudents,
      scores: reportScores,
      initialSemester: semester,
    });
  };

  const handleNavigateToSettings = (tab: SettingsTabId = 'users') => {
    setSettingsSubTab(tab);
    setCurrentTab('settings');
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'แดชบอร์ดภาพรวมและสถิติผลการเรียน';
      case 'attendance': return 'ระบบเช็คชื่อนักเรียนประจำรายวิชา';
      case 'grading': return 'บันทึกคะแนนและตัดเกรด (2 ภาคเรียน)';
      case 'students': return 'ทะเบียนรายชื่อนักเรียน';
      case 'subjects': return 'รายวิชาและกำหนดสัดส่วนคะแนน';
      case 'settings':
      case 'users': return 'การตั้งค่าระบบและการจัดการข้อมูล (System Settings)';
      default: return 'ระบบตัดเกรด';
    }
  };

  // If user is not authenticated, display full-screen LoginPage
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const currentRoleCfg = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS.teacher;
  const RoleIcon = currentRoleCfg.icon;

  return (
    <div className="flex h-screen w-full bg-white text-slate-700 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onOpenDataManagement={() => handleNavigateToSettings('backup')}
        onOpenAvatarUpload={() => setShowAvatarModal(true)}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        firebaseStatus={firebaseStatus}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onNavigateToSettingsTab={handleNavigateToSettings}
        activeSettingsTab={settingsSubTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-slate-50/30 overflow-hidden">
        
        {/* Header Bar */}
        <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col gap-2.5 shrink-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-600 focus:outline-none cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 ml-auto">
            
            {/* Cloud Sync Status & Quick Pull Button */}
            <button
              onClick={() => syncWithCloud(true)}
              disabled={isSyncingCloud}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                firebaseStatus.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
              title={firebaseStatus.connected ? 'คลิกเพื่อซิงค์ดึงข้อมูลล่าสุดจาก Cloud Firestore' : 'ยังไม่ได้เชื่อมต่อ Firebase'}
            >
              <Cloud className={`w-3.5 h-3.5 ${firebaseStatus.connected ? 'text-emerald-600' : 'text-amber-600'}`} />
              <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin text-emerald-600' : 'opacity-70'}`} />
              <span className="hidden sm:inline">
                {isSyncingCloud ? 'กำลังซิงค์...' : firebaseStatus.connected ? 'ซิงค์ Cloud' : 'เชื่อมต่อคลาวด์'}
              </span>
            </button>

            {/* Current Active User Pill with Login / Switch Modal Trigger */}
            <button
              onClick={() => setShowLoginModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${currentRoleCfg.badgeBg} ${currentRoleCfg.badgeBorder} ${currentRoleCfg.badgeText} hover:shadow-xs`}
              title="คลิกเพื่อเข้าสู่ระบบ / สลับบทบาทผู้ใช้งาน"
            >
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="font-bold">{currentUser.name}</span>
              <span className="text-[10px] opacity-80 font-mono">({currentRoleCfg.shortLabel})</span>
              <ArrowRightLeft className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {/* Quick Action Button */}
            {currentTab !== 'grading' && (
              <button
                id="btn-header-quick-grade"
                onClick={() => setCurrentTab('grading')}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกคะแนน</span>
              </button>
            )}

            {/* System Settings Quick Button for topbar */}
            <button
              onClick={() => handleNavigateToSettings('users')}
              className={`p-1.5 sm:px-3 sm:py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="ตั้งค่าระบบและการจัดการข้อมูล"
            >
              <Settings className="w-4 h-4 text-purple-600" />
              <span className="inline">ตั้งค่าระบบ</span>
            </button>
          </div>
        </header>

        {/* Sync Toast Notification */}
        {syncToast && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 shrink-0" />
              <span>{syncToast}</span>
            </div>
            <button 
              onClick={() => setSyncToast(null)}
              className="text-emerald-200 hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto">
            
            {currentTab === 'dashboard' && (
              <Dashboard
                students={students}
                subjects={subjects}
                scores={scores}
                onSelectClassAndSubject={handleSelectClassAndSubjectFromDashboard}
              />
            )}

            {currentTab === 'attendance' && (
              <SubjectAttendance
                currentUser={currentUser}
                students={students}
                subjects={subjects}
                initialSubjectId={targetGradingSubjectId}
                initialClassKey={targetGradingClassKey}
              />
            )}

            {currentTab === 'grading' && (
              <ScoreGrading
                students={students}
                subjects={subjects}
                assignments={assignments}
                scores={scores}
                onUpdateScores={setScores}
                onUpdateAssignments={setAssignments}
                onUpdateSubjects={setSubjects}
                onOpenPrintModal={handleOpenPrintModal}
                initialSubjectId={targetGradingSubjectId}
                initialClassKey={targetGradingClassKey}
              />
            )}

            {currentTab === 'evaluation' && (
              <StudentEvaluation
                students={students}
                subjects={subjects}
                assignments={assignments}
                scores={scores}
                onUpdateScores={setScores}
                onUpdateAssignments={setAssignments}
                preselectedSubjectId={targetGradingSubjectId}
                preselectedClassKey={targetGradingClassKey}
              />
            )}

            {currentTab === 'students' && (
              <StudentManagement
                students={students}
                onUpdateStudents={setStudents}
              />
            )}

            {currentTab === 'subjects' && (
              <SubjectManagement
                subjects={subjects}
                currentUser={currentUser}
                onUpdateSubjects={setSubjects}
                onNavigateToUsers={() => handleNavigateToSettings('users')}
              />
            )}

            {(currentTab === 'settings' || currentTab === 'users') && (
              <SystemSettings
                currentUser={currentUser}
                subjects={subjects}
                onUserChange={handleUserChange}
                onNavigateToSubjects={() => setCurrentTab('subjects')}
                firebaseStatus={firebaseStatus}
                onRefreshFirebaseStatus={() => setFirebaseStatus(storage.getFirebaseStatus())}
                onDataReset={reloadAllData}
                initialTab={settingsSubTab}
              />
            )}

          </div>
        </div>

      </main>

      {/* Avatar Upload for Current User */}
      {showAvatarModal && (
        <AvatarUploadModal
          isOpen={showAvatarModal}
          userId={currentUser.id}
          userName={currentUser.name}
          currentAvatar={currentUser.avatar}
          onAvatarUpdated={(newAvatarUrl) => {
            const updatedUser = { ...currentUser, avatar: newAvatarUrl };
            storage.saveUser(updatedUser);
            handleUserChange(updatedUser);
          }}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {/* Login & Role Switcher Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          currentUser={currentUser}
          onLoginSuccess={handleUserChange}
        />
      )}

      {/* Data Management & Firebase Modal */}
      {showDataModal && (
        <DataManagementModal
          isOpen={showDataModal}
          onClose={() => setShowDataModal(false)}
          onDataReset={reloadAllData}
          firebaseStatus={firebaseStatus}
          onRefreshFirebaseStatus={() => setFirebaseStatus(storage.getFirebaseStatus())}
        />
      )}

      {/* Printable Report Modal */}
      {printModalData.isOpen && printModalData.subject && printModalData.classKey && (
        <PrintReportModal
          isOpen={printModalData.isOpen}
          onClose={() => setPrintModalData((prev) => ({ ...prev, isOpen: false }))}
          subject={printModalData.subject}
          classKey={printModalData.classKey}
          students={printModalData.students}
          scores={printModalData.scores}
          assignments={assignments}
          initialSemester={printModalData.initialSemester}
        />
      )}

    </div>
  );
}
