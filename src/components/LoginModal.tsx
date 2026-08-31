import React, { useState } from 'react';
import { 
  ShieldCheck, 
  GraduationCap, 
  Briefcase, 
  Eye, 
  Lock, 
  User as UserIcon, 
  CheckCircle2, 
  Sparkles, 
  LogIn, 
  X,
  ArrowRight,
  School,
  KeyRound
} from 'lucide-react';
import { User, UserRole } from '../types';
import { storage } from '../services/storage';
import { ROLE_CONFIGS } from './UserManagement';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('admin');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const currentUsers = storage.getUsers();
      setAllUsers(currentUsers);
      setSelectedRoleTab(currentUser.role || 'admin');
      setUsernameOrEmail('');
      setPassword('');
      setErrorMessage(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Teachers, Admin, Staff, Guest lists
  const usersByRole = {
    admin: allUsers.filter(u => u.role === 'admin'),
    teacher: allUsers.filter(u => u.role === 'teacher'),
    staff: allUsers.filter(u => u.role === 'staff'),
    guest: allUsers.filter(u => u.role === 'guest'),
  };

  // Handle direct one-click switch / login
  const handleSelectUser = (user: User) => {
    storage.setCurrentUser(user);
    onLoginSuccess(user);
    onClose();
  };

  // Handle credentials form submit
  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const input = usernameOrEmail.trim().toLowerCase();
    if (!input) {
      setErrorMessage('กรุณาระบุชื่อผู้ใช้หรืออีเมล');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('กรุณาระบุรหัสผ่าน');
      return;
    }

    const matchedUser = allUsers.find(
      u => u.email.toLowerCase() === input || (u.username && u.username.toLowerCase() === input)
    );

    if (!matchedUser) {
      setErrorMessage('ไม่พบชื่อผู้ใช้หรืออีเมลนี้ในระบบ');
      return;
    }

    if (matchedUser.password && matchedUser.password !== password.trim()) {
      setErrorMessage('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }

    handleSelectUser(matchedUser);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with School Branding */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
              ก
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">เข้าสู่ระบบ / สลับบทบาทผู้ใช้งาน</h2>
              <p className="text-xs text-slate-300">ระบบบันทึกคะแนนและตัดเกรด 2 ภาคเรียน (สิทธิ์ 4 ระดับ)</p>
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1 rounded-full text-xs text-emerald-300">
            <UserIcon className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบอยู่: <strong>{currentUser.name}</strong> ({ROLE_CONFIGS[currentUser.role]?.shortLabel || currentUser.role})</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Quick Demo Login Role Selectors */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>เข้าสู่ระบบด่วนตามบทบาท (Quick Role Login)</span>
              </label>
              <span className="text-[11px] text-slate-400">คลิกที่การ์ดเพื่อสลับสิทธิ์ทันที</span>
            </div>

            {/* 4 Role Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {(['admin', 'teacher', 'staff', 'guest'] as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const Icon = cfg.icon;
                const isTabActive = selectedRoleTab === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRoleTab(r)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isTabActive
                        ? `${cfg.badgeBg} ${cfg.badgeBorder} ring-2 ring-emerald-400 shadow-xs`
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Icon className={`w-4 h-4 ${isTabActive ? cfg.badgeText : 'text-slate-400'}`} />
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {usersByRole[r]?.length || 0} คน
                      </span>
                    </div>
                    <p className={`text-xs font-bold ${isTabActive ? cfg.badgeText : 'text-slate-700'}`}>
                      {cfg.shortLabel}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Users in Selected Role */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-200/80">
                <span>เลือกบัญชี {ROLE_CONFIGS[selectedRoleTab].label}</span>
                <span className="text-[11px] text-slate-400">{ROLE_CONFIGS[selectedRoleTab].description}</span>
              </div>

              <div className="space-y-1.5 pt-1 max-h-44 overflow-y-auto">
                {usersByRole[selectedRoleTab]?.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200 shadow-2xs'
                          : 'bg-white hover:bg-emerald-50/50 border-slate-200 hover:border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                            {u.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {u.subjectSpecialty || u.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            ใช้งานอยู่
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-emerald-600 hover:text-white px-2.5 py-1 rounded-lg transition-colors">
                            เข้าสู่ระบบ <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {(!usersByRole[selectedRoleTab] || usersByRole[selectedRoleTab].length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-3">
                    ยังไม่มีบัญชีผู้ใช้ในบทบาทนี้
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Standard Credentials Login Form */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              <KeyRound className="w-4 h-4 text-slate-400" />
              <span>หรือเข้าสู่ระบบด้วยชื่อผู้ใช้ / รหัสผ่าน</span>
            </div>

            {errorMessage && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleFormLogin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้ หรือ อีเมล
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น admin, pimpa.n, staff"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่าน
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
