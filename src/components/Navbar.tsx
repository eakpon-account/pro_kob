import React, { useState } from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Award, 
  Users, 
  BookOpen, 
  Database, 
  Trash2, 
  FileSpreadsheet, 
  Cloud, 
  ChevronDown, 
  ChevronRight,
  UserCheck, 
  CheckCircle2, 
  Menu, 
  X, 
  PlusCircle, 
  Sparkles, 
  ShieldCheck, 
  Briefcase, 
  Eye, 
  LogIn, 
  LogOut, 
  UserPlus, 
  ArrowRightLeft, 
  Camera, 
  Settings,
  School,
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck
} from 'lucide-react';
import { User, UserRole } from '../types';
import { storage } from '../services/storage';
import { ROLE_CONFIGS } from './UserManagement';
import { SettingsTabId } from './SystemSettings';

export type MainTabType = 'dashboard' | 'attendance' | 'grading' | 'evaluation' | 'students' | 'subjects' | 'settings' | 'users';

interface SidebarProps {
  currentTab: MainTabType;
  setCurrentTab: (tab: MainTabType) => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  onOpenDataManagement?: () => void;
  onOpenAvatarUpload: () => void;
  onOpenLoginModal: () => void;
  onLogout?: () => void;
  firebaseStatus: { connected: boolean; projectId?: string };
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onNavigateToSettingsTab?: (tab: SettingsTabId) => void;
  activeSettingsTab?: SettingsTabId;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onUserChange,
  onOpenDataManagement,
  onOpenAvatarUpload,
  onOpenLoginModal,
  onLogout,
  firebaseStatus,
  mobileMenuOpen,
  setMobileMenuOpen,
  onNavigateToSettingsTab,
  activeSettingsTab = 'users',
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const allUsers = storage.getUsers();
  const currentRoleCfg = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS.teacher;
  const RoleIcon = currentRoleCfg.icon;

  const handleNavClick = (tab: MainTabType) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const handleSettingsSubNav = (tabId: SettingsTabId) => {
    if (onNavigateToSettingsTab) {
      onNavigateToSettingsTab(tabId);
    } else {
      setCurrentTab('settings');
    }
    setMobileMenuOpen(false);
  };

  const isSettingsActive = currentTab === 'settings' || currentTab === 'users';

  const settingsSubMenuItems: { id: SettingsTabId; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: 'users', label: 'ผู้ใช้งาน & สิทธิ์', icon: ShieldCheck, color: 'text-purple-600' },
    { id: 'firebase', label: 'ฐานข้อมูล Firebase', icon: Cloud, color: 'text-amber-600' },
    { id: 'backup', label: 'สำรอง & กู้คืนข้อมูล', icon: Database, color: 'text-emerald-600' },
    { id: 'general', label: 'สถานศึกษา & เกรด', icon: School, color: 'text-indigo-600' },
    { id: 'danger', label: 'ล้างข้อมูล & รีเซ็ต', icon: Trash2, color: 'text-rose-500' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Aside */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-xs">
              ก
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 tracking-tight leading-none">
                ระบบตัดเกรด <span className="text-xs font-semibold text-emerald-600">v1.0</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">ระบบบันทึกคะแนน 2 ภาคเรียน</p>
            </div>
          </div>
          
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 mb-2">
            เมนูหลัก
          </div>

          {/* Dashboard */}
          <button
            id="nav-tab-dashboard"
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'dashboard'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${currentTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>แดชบอร์ดสถิติ</span>
          </button>

          {/* Attendance (ใบเช็คยอดนักเรียนประจำรายวิชา) */}
          <button
            id="nav-tab-attendance"
            onClick={() => handleNavClick('attendance')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'attendance'
                ? 'bg-amber-50 text-amber-900 font-semibold border border-amber-200 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <CalendarCheck className={`w-4 h-4 ${currentTab === 'attendance' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>เช็คชื่อนักเรียน</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
              รายวัน
            </span>
          </button>

          {/* Grading */}
          <button
            id="nav-tab-grading"
            onClick={() => handleNavClick('grading')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'grading'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Award className={`w-4 h-4 ${currentTab === 'grading' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>บันทึกคะแนนและตัดเกรด</span>
          </button>

          {/* Individual Student Evaluation (แบบบันทึกการประเมินนักเรียนรายบุคคล) */}
          <button
            id="nav-tab-evaluation"
            onClick={() => handleNavClick('evaluation')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'evaluation'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <ClipboardCheck className={`w-4 h-4 ${currentTab === 'evaluation' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>ประเมินนักเรียนรายบุคคล</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              ใหม่
            </span>
          </button>

          {/* Students */}
          <button
            id="nav-tab-students"
            onClick={() => handleNavClick('students')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'students'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Users className={`w-4 h-4 ${currentTab === 'students' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>ทะเบียนรายชื่อนักเรียน</span>
          </button>

          {/* Subjects */}
          <button
            id="nav-tab-subjects"
            onClick={() => handleNavClick('subjects')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
              currentTab === 'subjects'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${currentTab === 'subjects' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>รายวิชาและสัดส่วนคะแนน</span>
          </button>

          {/* Unified System Settings Tab with Consolidated Sub-menu */}
          <div className="pt-1">
            <button
              id="nav-tab-settings"
              onClick={() => {
                handleNavClick('settings');
                setSettingsExpanded(true);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs transition-colors text-left ${
                isSettingsActive
                  ? 'bg-slate-800 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-4 h-4 ${isSettingsActive ? 'text-white' : 'text-slate-400'}`} />
                <span>ตั้งค่าระบบ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  isSettingsActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {allUsers.length} บัญชี
                </span>
                <ChevronDown 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isSettingsActive && settingsExpanded ? 'rotate-180 text-white' : 'text-slate-400'
                  }`} 
                />
              </div>
            </button>

            {/* Nested Sub-Menu inside System Settings */}
            {isSettingsActive && settingsExpanded && (
              <div className="ml-3 pl-3 my-1 border-l-2 border-slate-200 space-y-0.5 animate-fadeIn">
                {settingsSubMenuItems.map((item) => {
                  const SubIcon = item.icon;
                  const isCurrentSub = currentTab === 'settings' && activeSettingsTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`sidebar-sub-settings-${item.id}`}
                      onClick={() => handleSettingsSubNav(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                        isCurrentSub
                          ? 'bg-slate-200/80 text-slate-900 font-bold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <SubIcon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </nav>

        {/* User Profile Card at bottom */}
        <div className="p-3.5 bg-white m-3 rounded-2xl border border-slate-200 shadow-2xs relative space-y-2.5">
          
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${currentRoleCfg.badgeBg} ${currentRoleCfg.badgeText} ${currentRoleCfg.badgeBorder}`}>
              <RoleIcon className="w-3 h-3" />
              <span>{currentRoleCfg.shortLabel}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenLoginModal}
                className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                title="สลับบัญชีผู้ใช้งาน"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>สลับ</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-3 h-3" />
                  <span>ออก</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0 group">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <button
                type="button"
                onClick={onOpenAvatarUpload}
                className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-800 font-bold truncate leading-tight">
                {currentUser.name}
              </p>
              <button
                type="button"
                onClick={onOpenAvatarUpload}
                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 mt-0.5 font-medium cursor-pointer"
              >
                <Camera className="w-2.5 h-2.5" />
                <span>เปลี่ยนรูปโปรไฟล์</span>
              </button>
            </div>
          </div>

        </div>

      </aside>
    </>
  );
};
