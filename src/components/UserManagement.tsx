import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  GraduationCap, 
  Briefcase, 
  Eye, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  BookOpen, 
  Mail, 
  Phone, 
  Key, 
  UserCheck, 
  ArrowRightLeft,
  Sparkles,
  School,
  Lock,
  Camera,
  Copy,
  Check,
  Link2
} from 'lucide-react';
import { Subject, User, UserRole } from '../types';
import { storage } from '../services/storage';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AvatarUploadModal } from './AvatarUploadModal';
import { imageStorage } from '../services/imageStorage';

interface UserManagementProps {
  currentUser: User;
  subjects: Subject[];
  onUserChange: (user: User) => void;
  onNavigateToSubjects?: () => void;
}

export const ROLE_CONFIGS: Record<UserRole, {
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  permissions: string[];
}> = {
  admin: {
    label: 'ผู้ดูแลระบบ (Administrator)',
    shortLabel: 'ผู้ดูแลระบบ',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    icon: ShieldCheck,
    description: 'มีสิทธิ์สูงสุดในระบบ จัดการผู้ใช้ รายวิชา นักเรียน คะแนน และฐานข้อมูล',
    permissions: ['จัดการผู้ใช้งานและสิทธิ์', 'สร้าง/แก้ไข/ลบรายวิชา', 'จัดการทะเบียนนักเรียน', 'บันทึกและตัดเกรดทุกวิชา', 'จัดการฐานข้อมูล'],
  },
  teacher: {
    label: 'ครูประจำวิชา (Subject Teacher)',
    shortLabel: 'ครูประจำวิชา',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    icon: GraduationCap,
    description: 'จัดการรายวิชาที่ตนเองรับผิดชอบ สร้างช่องคะแนน กรอกคะแนน และพิมพ์เอกสาร ปพ.5',
    permissions: ['ผูกกับรายวิชาที่สอน', 'สร้าง/แก้ไขช่องคะแนนเก็บ', 'บันทึกคะแนนนักเรียน', 'พิมพ์ใบสรุปเกรด ปพ.5', 'ดูทะเบียนนักเรียน'],
  },
  staff: {
    label: 'เจ้าหน้าที่ฝ่ายทะเบียน (Staff)',
    shortLabel: 'เจ้าหน้าที่',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    icon: Briefcase,
    description: 'จัดการทะเบียนนักเรียน นำเข้าไฟล์ Excel ดูแดชบอร์ดภาพรวม และพิมพ์รายงาน',
    permissions: ['นำเข้า/จัดการข้อมูลนักเรียน', 'ดูสถิติและภาพรวมผลการเรียน', 'พิมพ์รายงานผลการศึกษา', 'ส่งออกข้อมูล'],
  },
  guest: {
    label: 'ผู้เยี่ยมชม (Guest / Visitor)',
    shortLabel: 'ผู้เยี่ยมชม',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    icon: Eye,
    description: 'เข้าชมภาพรวม สถิติ และตารางคะแนนในโหมดอ่านอย่างเดียว (Read-only)',
    permissions: ['ดูแดชบอร์ดสถิติ', 'ดูโครงสร้างรายวิชา', 'ดูตารางคะแนน (อ่านอย่างเดียว)'],
  },
};

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  subjects,
  onUserChange,
  onNavigateToSubjects,
}) => {
  const [users, setUsers] = useState<User[]>(() => storage.getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userForAvatarUpload, setUserForAvatarUpload] = useState<User | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Copy Avatar Address helper
  const handleCopyUserAvatarAddress = async (userId: string, avatarUrl?: string) => {
    if (!avatarUrl) return;
    const success = await imageStorage.copyAddress(avatarUrl);
    if (success) {
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    }
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('password123');
  const [formRole, setFormRole] = useState<UserRole>('teacher');
  const [formSubjectSpecialty, setFormSubjectSpecialty] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAvatar, setFormAvatar] = useState('');

  // Reload user list
  const refreshUsers = () => {
    setUsers(storage.getUsers());
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.subjectSpecialty && u.subjectSpecialty.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  // Count by role
  const roleCounts = useMemo(() => {
    return {
      all: users.length,
      admin: users.filter(u => u.role === 'admin').length,
      teacher: users.filter(u => u.role === 'teacher').length,
      staff: users.filter(u => u.role === 'staff').length,
      guest: users.filter(u => u.role === 'guest').length,
    };
  }, [users]);

  // Open Add Modal
  const handleOpenAdd = (defaultRole: UserRole = 'teacher') => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormUsername('');
    setFormPassword(defaultRole === 'admin' ? '213894120' : 'password123');
    setFormRole(defaultRole);
    setFormSubjectSpecialty(defaultRole === 'teacher' ? 'กลุ่มสาระการเรียนรู้คณิตศาสตร์' : '');
    setFormPhone('');
    setFormAvatar('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormUsername(user.username || '');
    setFormPassword(user.password || (user.role === 'admin' ? '213894120' : 'password123'));
    setFormRole(user.role);
    setFormSubjectSpecialty(user.subjectSpecialty || '');
    setFormPhone(user.phone || '');
    setFormAvatar(user.avatar || '');
    setShowAddModal(true);
  };

  // Update avatar directly from avatar upload modal
  const handleAvatarUpdated = (targetUserId: string, newAvatarUrl: string) => {
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

    const updatedUser = { ...targetUser, avatar: newAvatarUrl };
    storage.saveUser(updatedUser);
    refreshUsers();

    if (currentUser.id === targetUserId) {
      onUserChange(updatedUser);
    }

    setStatusMessage({
      type: 'success',
      text: 'อัปเดตรูปโปรไฟล์สำเร็จ',
      subText: `บันทึกรูปภาพโปรไฟล์ของ ${targetUser.name} เรียบร้อยแล้ว`,
    });

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Save user
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    // Check duplicate email (if adding or changing)
    const existing = users.find(u => u.email.toLowerCase() === formEmail.trim().toLowerCase() && u.id !== editingUser?.id);
    if (existing) {
      alert(`อีเมล "${formEmail}" มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น`);
      return;
    }

    const defaultAvatar = (formRole === 'admin' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      : formRole === 'teacher'
      ? 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80');

    const userToSave: User = {
      id: editingUser ? editingUser.id : `user-${formRole}-${Date.now()}`,
      name: formName.trim(),
      email: formEmail.trim(),
      username: formUsername.trim() || formEmail.split('@')[0],
      password: formPassword.trim() || (formRole === 'admin' ? '213894120' : 'password123'),
      role: formRole,
      subjectSpecialty: formSubjectSpecialty.trim(),
      phone: formPhone.trim(),
      avatar: formAvatar.trim() || editingUser?.avatar || defaultAvatar,
      createdAt: editingUser?.createdAt || new Date().toISOString().split('T')[0],
    };

    storage.saveUser(userToSave);
    refreshUsers();
    setShowAddModal(false);

    if (currentUser.id === userToSave.id) {
      onUserChange(userToSave);
    }

    setStatusMessage({
      type: 'success',
      text: editingUser ? 'บันทึกการแก้ไขข้อมูลผู้ใช้เรียบร้อย' : 'เพิ่มบัญชีผู้ใช้งานใหม่เรียบร้อย',
      subText: `${userToSave.name} (${ROLE_CONFIGS[userToSave.role].label})`,
    });

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Open Delete Confirmation
  const handleRequestDelete = (user: User) => {
    if (user.id === currentUser.id) {
      alert('คุณไม่สามารถลบบัญชีที่กำลังเข้าสู่ระบบอยู่ในขณะนี้ได้');
      return;
    }
    if (user.role === 'admin' && roleCounts.admin <= 1) {
      alert('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้');
      return;
    }
    setUserToDelete(user);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    const result = storage.deleteUser(userToDelete.id);
    if (!result.success) {
      alert(result.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
      return;
    }
    refreshUsers();

    setStatusMessage({
      type: 'deleted',
      text: 'ลบบัญชีผู้ใช้งานเรียบร้อยแล้ว',
      subText: `ลบบัญชี ${userToDelete.name} ออกจากระบบแล้ว`,
    });
    setUserToDelete(null);

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Switch to User immediately
  const handleSwitchUser = (user: User) => {
    onUserChange(user);
    setStatusMessage({
      type: 'success',
      text: `สลับเข้าสู่ระบบเป็น "${user.name}" (${ROLE_CONFIGS[user.role].shortLabel}) เรียบร้อยแล้ว`,
    });
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  // Find subjects assigned to a user
  const getAssignedSubjects = (userId: string, userName: string) => {
    return subjects.filter(s => s.teacherId === userId || s.teacherName === userName);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
          statusMessage.type === 'deleted' 
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'deleted' ? (
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
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
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              การจัดการผู้ใช้งานและกำหนดสิทธิ์ (User & Role Management)
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            สร้างและจัดการบัญชีผู้ใช้ 4 ระดับ: <strong>ผู้ดูแลระบบ, ครูประจำวิชา, เจ้าหน้าที่, ผู้เยี่ยมชม</strong> พร้อมผูกครูเข้ากับรายวิชา
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-add-teacher-quick"
            onClick={() => handleOpenAdd('teacher')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>เพิ่มครูประจำวิชา</span>
          </button>

          <button
            id="btn-add-user-main"
            onClick={() => handleOpenAdd('teacher')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>เพิ่มผู้ใช้งานใหม่</span>
          </button>
        </div>
      </div>

      {/* Role Summary & Fast Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        
        {/* Admin Card */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'admin' 
              ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-200 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-purple-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              ผู้ดูแลระบบ
            </span>
            <span className="text-base font-extrabold text-purple-900 font-mono">
              {roleCounts.admin}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-1">สิทธิ์สูงสุด จัดการระบบ</p>
        </div>

        {/* Teacher Card */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'teacher' ? 'all' : 'teacher')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'teacher' 
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              ครูประจำวิชา
            </span>
            <span className="text-base font-extrabold text-emerald-900 font-mono">
              {roleCounts.teacher}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-1">ผูกกับรายวิชา บันทึกคะแนน</p>
        </div>

        {/* Staff Card */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'staff' ? 'all' : 'staff')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'staff' 
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-200 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-blue-600" />
              เจ้าหน้าที่
            </span>
            <span className="text-base font-extrabold text-blue-900 font-mono">
              {roleCounts.staff}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-1">ทะเบียน พิมพ์รายงาน</p>
        </div>

        {/* Guest Card */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'guest' ? 'all' : 'guest')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'guest' 
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-600" />
              ผู้เยี่ยมชม
            </span>
            <span className="text-base font-extrabold text-amber-900 font-mono">
              {roleCounts.guest}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-1">โหมดอ่านอย่างเดียว (Read-only)</p>
        </div>

      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, กลุ่มสาระ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium transition-all"
            />
          </div>

          {/* Role Filter Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-medium">สิทธิ์การใช้งาน:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold text-slate-700 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="all">ทุกสิทธิ์ ({users.length} คน)</option>
              <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              <option value="teacher">ครูประจำวิชา (Teacher)</option>
              <option value="staff">เจ้าหน้าที่ (Staff)</option>
              <option value="guest">ผู้เยี่ยมชม (Guest)</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
          แสดง {filteredUsers.length} / {users.length} บัญชี
        </span>
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredUsers.map((u) => {
          const roleConfig = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.teacher;
          const RoleIcon = roleConfig.icon;
          const assignedSubjects = getAssignedSubjects(u.id, u.name);
          const isCurrent = u.id === currentUser.id;

          return (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border transition-all flex flex-col justify-between p-5 relative shadow-sm ${
                isCurrent 
                  ? 'border-purple-300 ring-2 ring-purple-100' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                
                {/* Top Role & Status Bar */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleConfig.badgeBg} ${roleConfig.badgeText} ${roleConfig.badgeBorder}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span>{roleConfig.shortLabel}</span>
                  </span>

                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-extrabold animate-pulse">
                      กำลังใช้งานอยู่
                    </span>
                  )}
                </div>

                {/* User Avatar & Name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative shrink-0 group">
                    <img
                      src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs group-hover:opacity-90 transition-opacity bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setUserForAvatarUpload(u)}
                      className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                      title="คลิกเพื่ออัปโหลด/เปลี่ยนรูปโปรไฟล์ในระบบ"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      u.role === 'admin' ? 'bg-purple-500' : u.role === 'teacher' ? 'bg-emerald-500' : u.role === 'staff' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-bold text-slate-800 text-sm leading-snug truncate">
                        {u.name}
                      </h3>
                      {u.avatar && (
                        <button
                          type="button"
                          onClick={() => handleCopyUserAvatarAddress(u.id, u.avatar)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                            copiedUserId === u.id
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                          title="คัดลอกที่อยู่รูปภาพโปรไฟล์"
                        >
                          {copiedUserId === u.id ? <Check className="w-2.5 h-2.5 text-white" /> : <Copy className="w-2.5 h-2.5 text-slate-400" />}
                          <span>{copiedUserId === u.id ? 'คัดลอกแล้ว' : 'ที่อยู่รูป'}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </p>
                    {u.phone && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{u.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Subject Specialty / Department */}
                {u.subjectSpecialty && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      กลุ่มสาระ / หน้าที่รับผิดชอบ:
                    </span>
                    <p className="font-medium text-slate-700 leading-tight">
                      {u.subjectSpecialty}
                    </p>
                  </div>
                )}

                {/* Assigned Subjects (For Teachers) */}
                {u.role === 'teacher' && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-emerald-600" />
                        รายวิชาที่รับผิดชอบ ({assignedSubjects.length} วิชา)
                      </span>
                    </div>

                    {assignedSubjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedSubjects.map(sub => (
                          <span
                            key={sub.id}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium"
                            title={`${sub.code} ${sub.name} (${sub.targetClasses.join(', ')})`}
                          >
                            {sub.code} {sub.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        ยังไม่ผูกกับรายวิชาใด (สามารถเลือกครูท่านนี้ขณะสร้างรายวิชาได้)
                      </p>
                    )}
                  </div>
                )}

              </div>

              {/* Bottom Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                
                {/* Switch to this user */}
                {!isCurrent ? (
                  <button
                    type="button"
                    onClick={() => handleSwitchUser(u)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="สลับเข้าใช้งานด้วยบัญชีนี้ทันที"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>สลับใช้บัญชีนี้</span>
                  </button>
                ) : (
                  <span className="text-xs text-purple-700 font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    บัญชีปัจจุบัน
                  </span>
                )}

                {/* Edit / Delete Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                    title="แก้ไขข้อมูลผู้ใช้"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={isCurrent || (u.role === 'admin' && roleCounts.admin <= 1)}
                    onClick={() => handleRequestDelete(u)}
                    className={`p-1.5 rounded-md transition-colors border border-transparent ${
                      isCurrent || (u.role === 'admin' && roleCounts.admin <= 1)
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                    }`}
                    title={isCurrent ? 'ไม่สามารถลบบัญชีที่กำลังล็อกอินอยู่ได้' : 'ลบบัญชีผู้ใช้'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                {editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มบัญชีผู้ใช้งานใหม่'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              
              {/* Role Selector Card */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  สิทธิ์การใช้งาน (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                    const cfg = ROLE_CONFIGS[r];
                    const Icon = cfg.icon;
                    const isSelected = formRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormRole(r)}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{cfg.shortLabel}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{cfg.description.slice(0, 30)}...</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Name & Avatar Row */}
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 group">
                    <img
                      src={formAvatar || (editingUser?.avatar) || (formRole === 'admin' 
                        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                        : formRole === 'teacher'
                        ? 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
                        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                      alt="User Preview"
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-300 shadow-2xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUserForAvatarUpload({
                          id: editingUser ? editingUser.id : `temp-${Date.now()}`,
                          name: formName || 'ผู้ใช้ใหม่',
                          email: formEmail,
                          role: formRole,
                          avatar: formAvatar,
                          createdAt: '',
                        });
                      }}
                      className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                      title="เปลี่ยนรูปภาพ / อัปโหลดเข้าสู่ระบบ"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">รูปภาพโปรไฟล์</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserForAvatarUpload({
                            id: editingUser ? editingUser.id : `temp-${Date.now()}`,
                            name: formName || 'ผู้ใช้ใหม่',
                            email: formEmail,
                            role: formRole,
                            avatar: formAvatar,
                            createdAt: '',
                          });
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>อัปโหลดเข้าสู่ระบบ / เลือกรูป</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formAvatar ? 'บันทึกรูปภาพโปรไฟล์ในระบบเรียบร้อย' : 'ใช้รูปประจำสิทธิ์อัตโนมัติ หรือคลิกเพื่ออัปโหลดใหม่'}
                    </p>
                  </div>
                </div>

                {/* Direct Image Address row */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-blue-600" />
                      <span>ที่อยู่รูปภาพ (Image Address / URL):</span>
                    </label>
                    {formAvatar && (
                      <button
                        type="button"
                        onClick={async () => {
                          const success = await imageStorage.copyAddress(formAvatar);
                          if (success) {
                            setCopiedUserId('modal-form');
                            setTimeout(() => setCopiedUserId(null), 2000);
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedUserId === 'modal-form' ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{copiedUserId === 'modal-form' ? 'คัดลอกที่อยู่แล้ว' : 'คัดลอกที่อยู่รูป'}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value)}
                    placeholder="วาง URL รูปภาพ หรือคลิกปุ่มอัปโหลดเข้าสู่ระบบด้านบน"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono bg-white text-slate-700 truncate"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ - นามสกุล (พร้อมคำนำหน้า) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ครูพิมพา นวรัตน์ หรือ ดร.สมศักดิ์ ภูมิปัญญา"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 font-medium"
                />
              </div>

              {/* Email & Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    อีเมล (Email) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="pimpa.n@school.ac.th"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้ (Username)
                  </label>
                  <input
                    type="text"
                    placeholder="pimpa.n"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Subject Specialty / Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มสาระการเรียนรู้ / แผนกวิชาที่เชี่ยวชาญ
                </label>
                <input
                  type="text"
                  placeholder="เช่น กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี, คณิตศาสตร์"
                  value={formSubjectSpecialty}
                  onChange={(e) => setFormSubjectSpecialty(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Phone & Password */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="text"
                    placeholder="082-345-6789"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่าน (Password)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              {/* Permissions Preview Info Box */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">
                  สิทธิ์ที่ได้รับ ({ROLE_CONFIGS[formRole].label}):
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                  {ROLE_CONFIGS[formRole].permissions.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {editingUser ? 'บันทึกการแก้ไข' : 'สร้างบัญชีผู้ใช้'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {userToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(userToDelete)}
          title="ยืนยันการลบบัญชีผู้ใช้งาน"
          itemTitle={`${userToDelete.name}`}
          itemSubtitle={`สิทธิ์: ${ROLE_CONFIGS[userToDelete.role].label} | อีเมล: ${userToDelete.email}`}
          warningMessage="การลบบัญชีนี้จะนำสิทธิ์การเข้าถึงออกจากระบบ และหากเป็นครูผู้สอน รายวิชาที่ผูกไว้จะยังคงอยู่แต่ต้องกำหนดครูผู้สอนใหม่"
          confirmLabel="ยืนยันการลบผู้ใช้"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDelete}
          onClose={() => setUserToDelete(null)}
        />
      )}

      {/* Avatar Upload Modal */}
      {userForAvatarUpload && (
        <AvatarUploadModal
          isOpen={Boolean(userForAvatarUpload)}
          userId={userForAvatarUpload.id}
          userName={userForAvatarUpload.name}
          currentAvatar={userForAvatarUpload.avatar}
          onAvatarUpdated={(newUrl) => {
            if (showAddModal) {
              setFormAvatar(newUrl);
            }
            if (userForAvatarUpload.id && !userForAvatarUpload.id.startsWith('temp-')) {
              handleAvatarUpdated(userForAvatarUpload.id, newUrl);
            }
          }}
          onClose={() => setUserForAvatarUpload(null)}
        />
      )}

    </div>
  );
};
