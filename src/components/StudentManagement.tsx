import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  UploadCloud, 
  Download, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  AlertCircle, 
  School,
  FileSpreadsheet,
  X,
  Plus,
  Cloud,
  RefreshCw,
  Database
} from 'lucide-react';
import { Student } from '../types';
import { storage } from '../services/storage';
import { downloadStudentTemplate, parseStudentsFromExcel } from '../utils/excelHelper';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import * as XLSX from 'xlsx';

interface StudentManagementProps {
  students: Student[];
  onUpdateStudents: (newStudents: Student[]) => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  onUpdateStudents,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isSeedingFirebase, setIsSeedingFirebase] = useState(false);

  // Form State for Single Add/Edit
  const [formPrefix, setFormPrefix] = useState('ด.ช.');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formStudentCode, setFormStudentCode] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState<number>(1);
  const [formGradeLevel, setFormGradeLevel] = useState('ม.1');
  const [formClassroom, setFormClassroom] = useState('1');
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPhone, setFormPhone] = useState('');

  // Bulk Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedPreviewStudents, setParsedPreviewStudents] = useState<Student[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available grade levels and class keys
  const gradeLevels = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.gradeLevel));
    return Array.from(set).sort();
  }, [students]);

  const classKeys = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.classKey));
    return Array.from(set).sort();
  }, [students]);

  // Filtered and Sorted Students (ALWAYS sorted by Student Number ASC)
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedGradeFilter !== 'all' && s.gradeLevel !== selectedGradeFilter) return false;
        if (selectedClassFilter !== 'all' && s.classKey !== selectedClassFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            s.firstName.toLowerCase().includes(q) ||
            s.lastName.toLowerCase().includes(q) ||
            s.studentCode.includes(q) ||
            String(s.studentNumber).includes(q) ||
            s.classKey.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.classKey !== b.classKey) {
          return a.classKey.localeCompare(b.classKey);
        }
        return a.studentNumber - b.studentNumber;
      });
  }, [students, selectedGradeFilter, selectedClassFilter, searchQuery]);

  // Open Edit Modal
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setFormPrefix(st.prefix);
    setFormFirstName(st.firstName);
    setFormLastName(st.lastName);
    setFormStudentCode(st.studentCode);
    setFormStudentNumber(st.studentNumber);
    setFormGradeLevel(st.gradeLevel);
    setFormClassroom(st.classroom);
    setFormGender(st.gender);
    setFormPhone(st.phone || '');
    setShowAddModal(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormPrefix('ด.ช.');
    setFormFirstName('');
    setFormLastName('');
    setFormStudentCode(String(68000 + students.length + 1));
    setFormStudentNumber(students.length > 0 ? Math.max(...students.map(s => s.studentNumber)) + 1 : 1);
    setFormGradeLevel(selectedGradeFilter !== 'all' ? selectedGradeFilter : 'ม.1');
    setFormClassroom(selectedClassFilter !== 'all' ? selectedClassFilter.split('/')[1] || '1' : '1');
    setFormGender('M');
    setFormPhone('');
    setShowAddModal(true);
  };

  // Save Single Student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim()) return;

    const classKey = `${formGradeLevel}/${formClassroom}`;

    const studentToSave: Student = {
      id: editingStudent ? editingStudent.id : `std-${Date.now()}`,
      studentCode: formStudentCode.trim(),
      studentNumber: Number(formStudentNumber) || 1,
      prefix: formPrefix,
      firstName: formFirstName.trim(),
      lastName: formLastName.trim(),
      gradeLevel: formGradeLevel,
      classroom: formClassroom,
      classKey,
      academicYear: '2568',
      gender: formGender,
      status: 'active',
      phone: formPhone.trim(),
    };

    storage.saveStudent(studentToSave);
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    setShowAddModal(false);
  };

  // Open Delete Confirmation Modal
  const handleRequestDeleteStudent = (st: Student) => {
    setStudentToDelete(st);
  };

  // Confirm and Execute Deletion
  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const st = studentToDelete;
    storage.deleteStudent(st.id);
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    
    // Set status notification
    setStatusMessage({
      type: 'deleted',
      text: `ลบข้อมูลนักเรียนเรียบร้อยแล้ว`,
      subText: `${st.prefix}${st.firstName} ${st.lastName} (ห้อง ${st.classKey} เลขที่ ${st.studentNumber})`,
    });
    setStudentToDelete(null);

    // Auto-clear status message after 4s
    setTimeout(() => {
      setStatusMessage((current) => (current?.subText?.includes(st.firstName) ? null : current));
    }, 4000);
  };

  // Handle File Pick for Bulk Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsProcessingImport(true);
    setImportErrors([]);

    try {
      const result = await parseStudentsFromExcel(file);
      setParsedPreviewStudents(result.students);
      setImportErrors(result.errors);
    } catch (err: any) {
      setImportErrors([err.message]);
      setParsedPreviewStudents([]);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Execute Bulk Import
  const handleExecuteImport = () => {
    if (parsedPreviewStudents.length === 0) return;

    storage.bulkSaveStudents(parsedPreviewStudents);
    const updated = storage.getStudents();
    onUpdateStudents(updated);

    setShowImportModal(false);
    setImportFile(null);
    setParsedPreviewStudents([]);
    alert(`นำเข้ารายชื่อนักเรียนจำนวน ${parsedPreviewStudents.length} คน เรียบร้อยแล้ว`);
  };

  // Export Roster to Excel
  const handleExportRoster = () => {
    const rows = filteredStudents.map((st) => ({
      'เลขที่': st.studentNumber,
      'รหัสนักเรียน': st.studentCode,
      'คำนำหน้า': st.prefix,
      'ชื่อ': st.firstName,
      'นามสกุล': st.lastName,
      'ระดับชั้น': st.gradeLevel,
      'ห้อง': st.classroom,
      'ห้องเรียน': st.classKey,
      'เพศ': st.gender === 'M' ? 'ชาย' : 'หญิง',
      'เบอร์โทร': st.phone || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักเรียน');
    XLSX.writeFile(wb, 'รายชื่อนักเรียนทั้งหมด.xlsx');
  };

  // Pull directly from Firebase Firestore Database
  const handlePullFromFirebase = async () => {
    setIsSyncingFirebase(true);
    try {
      const res = await storage.fetchStudentsDirectlyFromFirebase();
      if (res.success) {
        onUpdateStudents(res.students);
        setStatusMessage({
          type: 'success',
          text: `ดึงข้อมูลนักเรียนจากฐานข้อมูล Firebase สำเร็จ`,
          subText: `พบข้อมูลนักเรียนทั้งหมด ${res.count} คน จาก Cloud Firestore`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `ไม่สามารถดึงข้อมูลจาก Firebase ได้`,
          subText: res.error,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการดึงข้อมูล`,
        subText: err.message,
      });
    } finally {
      setIsSyncingFirebase(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Create / Seed all students into Firebase Firestore Database
  const handleSeedToFirebase = async () => {
    setIsSeedingFirebase(true);
    try {
      const res = await storage.createAndSeedStudentsInFirebase(students);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `บันทึก/สร้างฐานข้อมูลรายชื่อนักเรียนใน Firebase สำเร็จแล้ว!`,
          subText: `เขียนข้อมูลนักเรียนจำนวน ${res.count} คน ลงใน Cloud Firestore เรียบร้อย`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `ไม่สามารถสร้างฐานข้อมูลใน Firebase ได้`,
          subText: res.error,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการสร้างฐานข้อมูล`,
        subText: err.message,
      });
    } finally {
      setIsSeedingFirebase(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
          statusMessage.type === 'deleted' || statusMessage.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'deleted' || statusMessage.type === 'error' ? (
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
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

      {/* Firebase Database Connection Card */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/60 p-4 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800">
                ฐานข้อมูลนักเรียนบน Firebase Cloud Firestore
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ออนไลน์ ({students.length} คน)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              คอลเลกชัน <code className="font-mono bg-white/70 px-1 py-0.5 rounded border border-slate-200 text-blue-700 font-semibold">students</code> ใน Database ID: <code className="font-mono bg-white/70 px-1 py-0.5 rounded border border-slate-200 text-slate-700">ai-studio-d4633333-d76b-4d4e-8613-ec16f64ea578</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePullFromFirebase}
            disabled={isSyncingFirebase || isSeedingFirebase}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="ดึงข้อมูลนักเรียนล่าสุดจาก Firebase Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin text-blue-600' : 'text-blue-500'}`} />
            <span>{isSyncingFirebase ? 'กำลังดึงข้อมูล...' : 'ดึงรายชื่อจาก Firebase'}</span>
          </button>

          <button
            type="button"
            onClick={handleSeedToFirebase}
            disabled={isSyncingFirebase || isSeedingFirebase}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="สร้างหรือบันทึกข้อมูลรายชื่อนักเรียนทั้งหมดขึ้น Cloud Firestore"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSeedingFirebase ? 'animate-bounce' : ''}`} />
            <span>{isSeedingFirebase ? 'กำลังสร้าง/บันทึก...' : 'สร้างฐานข้อมูลใน Firebase'}</span>
          </button>
        </div>
      </div>

      {/* Top Header & Action Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                ทะเบียนรายชื่อนักเรียนและข้อมูลประจำห้อง
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              นำเข้าไฟล์ Excel/CSV จำนวนมาก จัดการรายชื่อ และจัดเรียงข้อมูลตามเลขที่ (น้อยไปหามาก)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>นำเข้ารายชื่อ (Excel / CSV)</span>
            </button>

            <button
              onClick={handleExportRoster}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>ส่งออกรายชื่อ</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มนักเรียนใหม่</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, นามสกุล หรือรหัส..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Grade Level Filter */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-medium">ระดับชั้น:</span>
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">ทุกระดับชั้น</option>
                {gradeLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Filter */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-medium">ห้องเรียน:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">ทุกห้องเรียน ({classKeys.length} ห้อง)</option>
                {classKeys.map((cKey) => (
                  <option key={cKey} value={cKey}>
                    ห้อง {cKey}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            แสดง {filteredStudents.length} / {students.length} คน
          </span>
        </div>
      </div>

      {/* Student List DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-16 text-center">เลขที่</th>
                <th className="py-3 px-3 w-24">รหัสนักเรียน</th>
                <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                <th className="py-3 px-3 text-center">ระดับชั้น/ห้อง</th>
                <th className="py-3 px-3 text-center">เพศ</th>
                <th className="py-3 px-3">เบอร์โทรศัพท์</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center w-28">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.map((st) => (
                <tr key={st.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="py-3 px-4 text-center font-bold text-slate-800">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-slate-100 text-xs text-slate-700">
                      {st.studentNumber}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {st.studentCode}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    <span className="text-slate-400 font-normal mr-1">{st.prefix}</span>
                    {st.firstName} {st.lastName}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]">
                      {st.classKey}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      st.gender === 'M' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-pink-50 text-pink-700 border border-pink-200'
                    }`}>
                      {st.gender === 'M' ? 'ชาย' : 'หญิง'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {st.phone || '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      ปกติ
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(st)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequestDeleteStudent(st)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title="ลบนักเรียน"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium">ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่เลือก</p>
          </div>
        )}
      </div>

      {/* Modal: Single Add / Edit Student */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                {editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formStudentNumber}
                    onChange={(e) => setFormStudentNumber(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสนักเรียน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formStudentCode}
                    onChange={(e) => setFormStudentCode(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    คำนำหน้า
                  </label>
                  <select
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                    <option value="นาย">นาย</option>
                    <option value="น.ส.">น.ส.</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระดับชั้น <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formGradeLevel}
                    onChange={(e) => setFormGradeLevel(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
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
                    ห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formClassroom}
                    onChange={(e) => setFormClassroom(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 text-center"
                    placeholder="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เพศ
                  </label>
                  <select
                    value={formGender}
                    onChange={(e: any) => setFormGender(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="M">ชาย (M)</option>
                    <option value="F">หญิง (F)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  placeholder="081-234-5678"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs cursor-pointer"
                >
                  {editingStudent ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลนักเรียน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import via Excel/CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600" />
                นำเข้ารายชื่อนักเรียนจำนวนมาก (Bulk Import Excel / CSV)
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1">
              
              {/* Template Download Banner */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-950">ยังไม่มีไฟล์รูปแบบมาตรฐาน?</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    ดาวน์โหลดไฟล์เทมเพลต Excel เพื่อกรอกข้อมูล เลขที่, รหัส, ชื่อ-นามสกุล, ระดับชั้น และห้องเรียน
                  </p>
                </div>
                <button
                  onClick={downloadStudentTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg shadow-xs hover:bg-emerald-700 transition-colors shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด Template (.xlsx)</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  คลิกเพื่อเลือกไฟล์ Excel หรือ CSV (.xlsx, .xls, .csv)
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  ระบบจะอ่านหัวคอลัมน์และจัดเรียงตามเลขที่อัตโนมัติ
                </p>
                {importFile && (
                  <div className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                    เลือกไฟล์แล้ว: {importFile.name} (พบ {parsedPreviewStudents.length} รายชื่อ)
                  </div>
                )}
              </div>

              {/* Error messages if any */}
              {importErrors.length > 0 && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    พบข้อผิดพลาดในไฟล์ ({importErrors.length} รายการ):
                  </div>
                  <ul className="list-disc list-inside text-[11px] max-h-24 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {parsedPreviewStudents.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-800 mb-2">
                    ตัวอย่างข้อมูลที่พร้อมนำเข้า ({parsedPreviewStudents.length} คน):
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">เลขที่</th>
                          <th className="py-2 px-3">รหัส</th>
                          <th className="py-2 px-3">ชื่อ - นามสกุล</th>
                          <th className="py-2 px-3">ห้องเรียน</th>
                          <th className="py-2 px-3">เพศ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreviewStudents.slice(0, 15).map((st, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-bold text-slate-800">{st.studentNumber}</td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">{st.studentCode}</td>
                            <td className="py-1.5 px-3">{st.prefix}{st.firstName} {st.lastName}</td>
                            <td className="py-1.5 px-3 font-medium text-emerald-700">{st.classKey}</td>
                            <td className="py-1.5 px-3">{st.gender === 'M' ? 'ชาย' : 'หญิง'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedPreviewStudents.length > 15 && (
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      และอีก {parsedPreviewStudents.length - 15} รายชื่อ...
                    </p>
                  )}
                </div>
              )}

            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={parsedPreviewStudents.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                ยืนยันการนำเข้า {parsedPreviewStudents.length} รายชื่อ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirm Delete Student Modal */}
      {studentToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(studentToDelete)}
          title="ยืนยันการลบข้อมูลนักเรียน"
          itemTitle={`${studentToDelete.prefix}${studentToDelete.firstName} ${studentToDelete.lastName}`}
          itemSubtitle={`รหัสนักเรียน: ${studentToDelete.studentCode} | ชั้น/ห้อง: ${studentToDelete.classKey} | เลขที่: ${studentToDelete.studentNumber}`}
          warningMessage="ข้อมูลนักเรียน รายการคะแนนเก็บทุกรายวิชา และประวัติผลการเรียนที่เกี่ยวข้องทั้งหมดจะถูกลบออกจากระบบอย่างถาวร"
          confirmLabel="ยืนยันการลบนักเรียน"
          cancelLabel="ยกเลิก"
          onConfirm={handleConfirmDeleteStudent}
          onClose={() => setStudentToDelete(null)}
        />
      )}

    </div>
  );
};
