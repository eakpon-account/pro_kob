import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  School, 
  User as UserIcon, 
  Check,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  GraduationCap,
  UserPlus,
  Filter,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Subject, User as UserType } from '../types';
import { storage } from '../services/storage';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ROLE_CONFIGS } from './UserManagement';

interface SubjectManagementProps {
  subjects: Subject[];
  currentUser: UserType;
  onUpdateSubjects: (newSubjects: Subject[]) => void;
  onNavigateToUsers?: () => void;
}

export const SubjectManagement: React.FC<SubjectManagementProps> = ({
  subjects,
  currentUser,
  onUpdateSubjects,
  onNavigateToUsers,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTeacherRequiredAlert, setShowTeacherRequiredAlert] = useState(false);
  const [showQuickAddTeacher, setShowQuickAddTeacher] = useState(false);
  
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);

  // Filter for teachers
  const [filterMySubjectsOnly, setFilterMySubjectsOnly] = useState(currentUser.role === 'teacher');

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCredits, setFormCredits] = useState<number>(1.0);
  const [formGradeLevel, setFormGradeLevel] = useState('ม.1');
  const [formTargetClasses, setFormTargetClasses] = useState('ม.1/1, ม.1/2');
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');

  // Quick Teacher Form State
  const [quickTeacherName, setQuickTeacherName] = useState('');
  const [quickTeacherEmail, setQuickTeacherEmail] = useState('');
  const [quickTeacherSpecialty, setQuickTeacherSpecialty] = useState('กลุ่มสาระการเรียนรู้คณิตศาสตร์');

  // All available teachers in system
  const availableTeachers = useMemo(() => {
    const allUsers = storage.getUsers();
    // Include both 'teacher' role and 'admin' role (admins can also be assigned to teach)
    return allUsers.filter(u => u.role === 'teacher' || u.role === 'admin');
  }, [showAddModal, showQuickAddTeacher]);

  const teacherUsersOnly = useMemo(() => {
    return storage.getUsers().filter(u => u.role === 'teacher');
  }, [showAddModal, showQuickAddTeacher]);

  // Filtered Subjects
  const displayedSubjects = useMemo(() => {
    if (filterMySubjectsOnly && currentUser.role === 'teacher') {
      return subjects.filter(s => s.teacherId === currentUser.id || s.teacherName === currentUser.name);
    }
    return subjects;
  }, [subjects, filterMySubjectsOnly, currentUser]);

  const handleOpenAdd = () => {
    // REQUIREMENT: Must have teacher users created first!
    if (availableTeachers.length === 0) {
      setShowTeacherRequiredAlert(true);
      return;
    }

    setEditingSubject(null);
    setFormCode('');
    setFormName('');
    setFormCredits(1.0);
    setFormGradeLevel('ม.1');
    setFormTargetClasses('ม.1/1, ม.1/2');
    
    // Default to current user if teacher/admin, or first available teacher
    const defaultTeacher = availableTeachers.find(t => t.id === currentUser.id) || availableTeachers[0];
    setFormTeacherId(defaultTeacher ? defaultTeacher.id : '');
    setFormDescription('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setFormCode(sub.code);
    setFormName(sub.name);
    setFormCredits(sub.credits);
    setFormGradeLevel(sub.gradeLevel);
    setFormTargetClasses(sub.targetClasses.join(', '));
    
    // Find matching teacher ID or default
    const matched = availableTeachers.find(t => t.id === sub.teacherId || t.name === sub.teacherName);
    setFormTeacherId(matched ? matched.id : (availableTeachers[0]?.id || ''));
    setFormDescription(sub.description || '');
    setShowAddModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) return;

    if (!formTeacherId) {
      alert('กรุณาเลือกครูประจำวิชาผู้รับผิดชอบ');
      return;
    }

    const selectedTeacher = availableTeachers.find(t => t.id === formTeacherId);
    if (!selectedTeacher) {
      alert('ไม่พบบัญชีครูผู้สอนที่เลือกในระบบ กรุณาเลือกครูประจำวิชาที่มีอยู่');
      return;
    }

    const parsedClasses = formTargetClasses
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const subjectToSave: Subject = {
      id: editingSubject ? editingSubject.id : `sub-${Date.now()}`,
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      credits: Number(formCredits) || 1.0,
      gradeLevel: formGradeLevel,
      targetClasses: parsedClasses.length > 0 ? parsedClasses : [`${formGradeLevel}/1`],
      academicYear: '2568',
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      description: formDescription.trim(),
    };

    storage.saveSubject(subjectToSave);
    const updated = storage.getSubjects();
    onUpdateSubjects(updated);
    setShowAddModal(false);

    setStatusMessage({
      type: 'success',
      text: editingSubject ? 'บันทึกการแก้ไขรายวิชาเรียบร้อย' : 'เพิ่มรายวิชาและผูกกับครูผู้สอนเรียบร้อย',
      subText: `วิชา ${subjectToSave.code} ${subjectToSave.name} (ครูผู้สอน: ${subjectToSave.teacherName})`,
    });

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Quick Teacher Creation inside Modal
  const handleQuickAddTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTeacherName.trim() || !quickTeacherEmail.trim()) return;

    const newTeacher: UserType = {
      id: `user-teacher-${Date.now()}`,
      name: quickTeacherName.trim(),
      email: quickTeacherEmail.trim(),
      username: quickTeacherEmail.split('@')[0],
      password: 'password123',
      role: 'teacher',
      subjectSpecialty: quickTeacherSpecialty.trim(),
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString().split('T')[0],
    };

    storage.saveUser(newTeacher);
    setFormTeacherId(newTeacher.id);
    setShowQuickAddTeacher(false);
    setShowTeacherRequiredAlert(false);

    setStatusMessage({
      type: 'success',
      text: 'สร้างบัญชีครูประจำวิชาใหม่เรียบร้อยแล้ว',
      subText: `${newTeacher.name} (${newTeacher.subjectSpecialty})`,
    });

    if (!showAddModal) {
      // Auto open add subject modal now that teacher exists
      setTimeout(() => {
        handleOpenAdd();
      }, 200);
    }
  };

  // Open Delete Modal
  const handleRequestDelete = (sub: Subject) => {
    if (currentUser.role === 'guest') {
      alert('โหมดผู้เยี่ยมชม: ไม่สามารถลบรายวิชาได้');
      return;
    }
    setSubjectToDelete(sub);
  };

  // Confirm and Execute Subject Deletion
  const handleConfirmDelete = () => {
    if (!subjectToDelete) return;
    const sub = subjectToDelete;
    storage.deleteSubject(sub.id);
    const updated = storage.getSubjects();
    onUpdateSubjects(updated);

    setStatusMessage({
      type: 'deleted',
      text: 'ลบรายวิชาเรียบร้อยแล้ว',
      subText: `ลบวิชา "${sub.code} ${sub.name}" และข้อมูลคะแนนที่เกี่ยวข้องออกจากระบบแล้ว`,
    });
    setSubjectToDelete(null);

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const isGuest = currentUser.role === 'guest';

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

      {/* Header and Add Button */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              การจัดการโครงสร้างรายวิชา (Subject Management)
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            รายวิชาต้อง<strong>ผูกกับครูประจำวิชา</strong>ที่มีบัญชีในระบบ (สามารถสร้างครูประจำวิชาก่อน จึงจะสร้างรายวิชาได้)
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Filter for Teachers */}
          {currentUser.role === 'teacher' && (
            <button
              onClick={() => setFilterMySubjectsOnly(!filterMySubjectsOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                filterMySubjectsOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterMySubjectsOnly ? 'แสดงเฉพาะวิชาที่ฉันสอน' : 'แสดงวิชาทั้งหมด'}</span>
            </button>
          )}

          {/* Direct Link to Users if requested */}
          {onNavigateToUsers && (
            <button
              onClick={onNavigateToUsers}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>จัดการครูผู้สอน ({availableTeachers.length} คน)</span>
            </button>
          )}

          {/* Add Subject Button */}
          {!isGuest ? (
            <button
              id="btn-add-subject"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายวิชาใหม่</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl border border-amber-200">
              <Eye className="w-3.5 h-3.5" />
              โหมดผู้เยี่ยมชม (อ่านอย่างเดียว)
            </span>
          )}

        </div>
      </div>

      {/* Teacher Dependency Notice Card */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-800 block">
              สถานะครูประจำวิชาในระบบ: พบครูผู้สอน {teacherUsersOnly.length} ท่าน
            </span>
            <span className="text-slate-500 text-[11px]">
              ระบบบังคับให้ทุกรายวิชาต้องผูกกับครูประจำวิชาที่ถูกต้อง เพื่อให้ครูสามารถเข้าบันทึกคะแนนในวิชาของตนเองได้
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowQuickAddTeacher(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold text-xs transition-colors cursor-pointer shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>สร้างครูประจำวิชาใหม่</span>
        </button>
      </div>

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedSubjects.map((sub) => {
          const isMyTeachingSubject = sub.teacherId === currentUser.id || sub.teacherName === currentUser.name;
          const assignedTeacher = availableTeachers.find(t => t.id === sub.teacherId || t.name === sub.teacherName);

          return (
            <div
              key={sub.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all flex flex-col justify-between ${
                isMyTeachingSubject && currentUser.role === 'teacher'
                  ? 'border-emerald-300 ring-2 ring-emerald-50 hover:border-emerald-400'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold font-mono text-xs border border-emerald-200">
                      {sub.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {sub.credits} หน่วยกิต
                    </span>
                    {isMyTeachingSubject && currentUser.role === 'teacher' && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        วิชาของฉัน
                      </span>
                    )}
                  </div>
                  
                  {!isGuest && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(sub)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                        title="แก้ไขข้อมูลวิชา"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequestDelete(sub)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        title="ลบรายวิชา"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-slate-800 text-base mb-1">
                  {sub.name}
                </h3>
                
                {sub.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {sub.description}
                  </p>
                )}

                {/* Linked Teacher Box */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2 mt-3 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                      ครูประจำวิชาผู้รับผิดชอบ:
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[140px] text-right">
                      {sub.teacherName}
                    </span>
                  </div>

                  {assignedTeacher?.subjectSpecialty && (
                    <div className="text-[10px] text-slate-400 truncate pl-5">
                      {assignedTeacher.subjectSpecialty}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-200/60">
                    <span className="flex items-center gap-1 text-slate-400">
                      <School className="w-3.5 h-3.5" />
                      ระดับชั้น:
                    </span>
                    <span className="font-semibold text-slate-800">{sub.gradeLevel}</span>
                  </div>
                </div>
              </div>

              {/* Target Classrooms Badges */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ห้องเรียนที่เปิดสอน:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sub.targetClasses.map((cls) => (
                    <span
                      key={cls}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          );
        })}

        {displayedSubjects.length === 0 && (
          <div className="col-span-full py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">ไม่พบรายการวิชาตามเงื่อนไข</p>
            <p className="text-xs text-slate-400">
              {filterMySubjectsOnly 
                ? `คุณยังไม่ได้รับมอบหมายให้สอนวิชาใด หรือสลับไปดู 'แสดงวิชาทั้งหมด'` 
                : `คลิกปุ่ม "เพิ่มรายวิชาใหม่" เพื่อเริ่มสร้างวิชาแรก`}
            </p>
          </div>
        )}
      </div>

      {/* Teacher Required Pre-condition Alert Modal */}
      {showTeacherRequiredAlert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800">
                ต้องสร้างบัญชี "ครูประจำวิชา" ก่อน จึงจะสร้างรายวิชาได้
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                ตามกฎระเบียบของระบบ ทุกรายวิชาต้องผูกกับครูประจำวิชาที่มีตัวตนในระบบ กรุณาสร้างบัญชีครูผู้สอนก่อนเริ่มกำหนดรายวิชา
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTeacherRequiredAlert(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowTeacherRequiredAlert(false);
                  setShowQuickAddTeacher(true);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>สร้างครูประจำวิชาทันที</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Teacher Modal */}
      {showQuickAddTeacher && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>สร้างบัญชีครูประจำวิชาใหม่ (Quick Teacher Creation)</span>
              </h3>
              <button
                onClick={() => setShowQuickAddTeacher(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleQuickAddTeacherSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ชื่อ-สกุลครูประจำวิชา (พร้อมคำนำหน้า) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ครูพิมพา นวรัตน์ หรือ ครูเอกพงษ์ เจริญสุข"
                  value={quickTeacherName}
                  onChange={(e) => setQuickTeacherName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  อีเมลประจำตัว (Email) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="teacher@school.ac.th"
                  value={quickTeacherEmail}
                  onChange={(e) => setQuickTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  กลุ่มสาระการเรียนรู้ / แผนกวิชา
                </label>
                <input
                  type="text"
                  placeholder="เช่น กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี, คณิตศาสตร์"
                  value={quickTeacherSpecialty}
                  onChange={(e) => setQuickTeacherSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                สิทธิ์: <strong>ครูประจำวิชา (Teacher)</strong> — สามารถผูกกับวิชาที่สอน บันทึกคะแนน และพิมพ์ ปพ.5 ได้ทันที
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddTeacher(false)}
                  className="px-3.5 py-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกครูผู้สอน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                {editingSubject ? 'แก้ไขข้อมูลรายวิชา' : 'เพิ่มรายวิชาใหม่'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสวิชา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ว21103"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono uppercase"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อวิชา <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น วิทยาการคำนวณ 1"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* CRUCIAL REQUIREMENT: TEACHER SELECTION DROPDOWN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    ครูประจำวิชาผู้รับผิดชอบ <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddTeacher(true)}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    เพิ่มครูประจำวิชาใหม่
                  </button>
                </div>

                <select
                  required
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white font-medium text-slate-800"
                >
                  <option value="" disabled>-- เลือกครูประจำวิชา --</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({ROLE_CONFIGS[t.role]?.shortLabel || t.role}) {t.subjectSpecialty ? `• ${t.subjectSpecialty}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * ต้องเลือกครูประจำวิชาที่มีอยู่ในระบบ รายวิชาจะถูกผูกกับบัญชีครูท่านนี้โดยอัตโนมัติ
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หน่วยกิต <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5.0"
                    required
                    value={formCredits}
                    onChange={(e) => setFormCredits(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระดับชั้น <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formGradeLevel}
                    onChange={(e) => setFormGradeLevel(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    <option value="ม.1">ม.1</option>
                    <option value="ม.2">ม.2</option>
                    <option value="ม.3">ม.3</option>
                    <option value="ม.4">ม.4</option>
                    <option value="ม.5">ม.5</option>
                    <option value="ม.6">ม.6</option>
                    <option value="ป.1">ป.1</option>
                    <option value="ป.2">ป.2</option>
                    <option value="ป.3">ป.3</option>
                    <option value="ป.4">ป.4</option>
                    <option value="ป.5">ป.5</option>
                    <option value="ป.6">ป.6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ห้องเรียนที่สอน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ม.1/1, ม.1/2"
                    value={formTargetClasses}
                    onChange={(e) => setFormTargetClasses(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  คำอธิบายรายวิชา / สาระการเรียนรู้
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น ความรู้พื้นฐานเกี่ยวกับการคิดเชิงคำนวณและการเขียนโปรแกรม..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
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
                  {editingSubject ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลวิชา'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Subject Modal */}
      {subjectToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(subjectToDelete)}
          title="ยืนยันการลบรายวิชา"
          itemTitle={`${subjectToDelete.code} ${subjectToDelete.name}`}
          itemSubtitle={`ครูประจำวิชา: ${subjectToDelete.teacherName} | ระดับชั้น: ${subjectToDelete.gradeLevel} (${subjectToDelete.targetClasses.join(', ')})`}
          warningMessage="การลบรายวิชานี้จะลบรายการช่องคะแนนและคะแนนทั้งหมดที่เคยบันทึกไว้ในวิชานี้ด้วย"
          confirmLabel="ยืนยันการลบรายวิชา"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDelete}
          onClose={() => setSubjectToDelete(null)}
        />
      )}

    </div>
  );
};
