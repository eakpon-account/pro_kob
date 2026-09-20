import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Database,
  GraduationCap,
  Eye,
  CheckSquare,
  Square,
  ArrowRightLeft,
  ListOrdered,
  ClipboardPaste,
  Sparkles,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { Student } from '../types';
import { storage } from '../services/storage';
import { 
  downloadStudentTemplate, 
  downloadStudentCsvTemplate, 
  parseStudentsFromExcel,
  parseThaiFullName,
  detectGender
} from '../utils/excelHelper';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { StudentTranscriptModal } from './StudentTranscriptModal';
import * as XLSX from 'xlsx';

interface StudentManagementProps {
  students: Student[];
  onUpdateStudents: (newStudents: Student[]) => void;
  activeAcademicYear?: string;
  onNavigateToPromotion?: () => void;
}

// Available Standard Grades in Thai Education System
const ALL_GRADES = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'
];

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  onUpdateStudents,
  activeAcademicYear,
  onNavigateToPromotion,
}) => {
  // Current School Default Year
  const currentSchoolYear = storage.getSchoolSettings().academicYear || '2568';
  const defaultYear = activeAcademicYear || currentSchoolYear;

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [viewingTranscriptStudentId, setViewingTranscriptStudentId] = useState<string | null>(null);

  // Available Academic Years in Database
  const availableYears = useMemo(() => {
    const list = storage.getAvailableAcademicYears();
    if (!list.includes(currentSchoolYear)) list.push(currentSchoolYear);
    return Array.from(new Set(list)).sort().reverse();
  }, [students, currentSchoolYear]);

  // Modals & Popups
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'batch_text'>('single');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'deleted' | 'error'; text: string; subText?: string } | null>(null);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isSeedingFirebase, setIsSeedingFirebase] = useState(false);

  // Multi-select for Batch Operations
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveGrade, setBulkMoveGrade] = useState('ป.1');
  const [bulkMoveRoom, setBulkMoveRoom] = useState('1');

  // Form State for Single Add / Edit
  const [formPrefix, setFormPrefix] = useState('ด.ช.');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formStudentCode, setFormStudentCode] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState<number>(1);
  const [formGradeLevel, setFormGradeLevel] = useState('ป.1');
  const [formClassroom, setFormClassroom] = useState('1');
  const [formAcademicYear, setFormAcademicYear] = useState(defaultYear);
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPhone, setFormPhone] = useState('');

  // Quick Batch Paste State
  const [batchRawText, setBatchRawText] = useState('');
  const [batchGradeLevel, setBatchGradeLevel] = useState('ป.1');
  const [batchClassroom, setBatchClassroom] = useState('1');
  const [batchStartNumber, setBatchStartNumber] = useState<number>(1);
  const [batchAcademicYear, setBatchAcademicYear] = useState(defaultYear);
  const [parsedBatchList, setParsedBatchList] = useState<Array<{
    studentNumber: number;
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    gender: 'M' | 'F';
  }>>([]);

  // Bulk Import Excel/CSV State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAcademicYear, setImportAcademicYear] = useState(defaultYear);
  const [importMode, setImportMode] = useState<'merge' | 'replace_classes' | 'replace_all'>('merge');
  const [parsedPreviewStudents, setParsedPreviewStudents] = useState<Student[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available grade levels present strictly in the real student data
  const activeGradesInSystem = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (selectedYearFilter !== 'all') {
        const stdYear = s.academicYear || currentSchoolYear;
        if (stdYear !== selectedYearFilter) return;
      }
      if (s.gradeLevel && s.gradeLevel.trim()) set.add(s.gradeLevel.trim());
    });
    return Array.from(set).sort((a, b) => {
      const idxA = ALL_GRADES.indexOf(a);
      const idxB = ALL_GRADES.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [students, selectedYearFilter, currentSchoolYear]);

  // Available classrooms (classKeys) present strictly in the real student data
  const availableClassKeys = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (selectedYearFilter !== 'all') {
        const stdYear = s.academicYear || currentSchoolYear;
        if (stdYear !== selectedYearFilter) return;
      }
      if (selectedGradeFilter === 'all' || s.gradeLevel === selectedGradeFilter) {
        if (s.classKey && s.classKey.trim()) {
          set.add(s.classKey.trim());
        } else if (s.gradeLevel && s.classroom) {
          set.add(`${s.gradeLevel.trim()}/${s.classroom.trim()}`);
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students, selectedGradeFilter, selectedYearFilter, currentSchoolYear]);

  // Existing rooms for currently selected form grade level
  const existingRoomsForFormGrade = useMemo(() => {
    const set = new Set<string>();
    students
      .filter((s) => s.gradeLevel === formGradeLevel)
      .forEach((s) => {
        if (s.classroom && s.classroom.trim()) set.add(s.classroom.trim());
      });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [students, formGradeLevel]);

  // Existing rooms for batch add modal
  const existingRoomsForBatchGrade = useMemo(() => {
    const set = new Set<string>();
    students
      .filter((s) => s.gradeLevel === batchGradeLevel)
      .forEach((s) => {
        if (s.classroom && s.classroom.trim()) set.add(s.classroom.trim());
      });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [students, batchGradeLevel]);

  // Existing rooms for bulk move modal
  const existingRoomsForBulkMove = useMemo(() => {
    const set = new Set<string>();
    students
      .filter((s) => s.gradeLevel === bulkMoveGrade)
      .forEach((s) => {
        if (s.classroom && s.classroom.trim()) set.add(s.classroom.trim());
      });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [students, bulkMoveGrade]);

  // Reset filter when selected grade or room no longer exists in real data
  useEffect(() => {
    if (selectedGradeFilter !== 'all' && !activeGradesInSystem.includes(selectedGradeFilter)) {
      setSelectedGradeFilter('all');
    }
  }, [activeGradesInSystem, selectedGradeFilter]);

  useEffect(() => {
    if (selectedClassFilter !== 'all' && !availableClassKeys.includes(selectedClassFilter)) {
      setSelectedClassFilter('all');
    }
  }, [availableClassKeys, selectedClassFilter]);

  // Automatically calculate next student number for target class
  const getNextNumberForClass = (grade: string, room: string, year: string): number => {
    const targetKey = `${grade}/${room}`;
    const classStudents = students.filter(
      (s) => s.classKey === targetKey && (!s.academicYear || s.academicYear === year)
    );
    if (classStudents.length === 0) return 1;
    const maxNum = Math.max(...classStudents.map((s) => s.studentNumber || 0));
    return maxNum + 1;
  };

  // Sync prefix change to auto-set gender
  const handlePrefixChange = (p: string) => {
    setFormPrefix(p);
    if (p === 'ด.ญ.' || p === 'น.ส.' || p === 'นางสาว' || p === 'นาง' || p === 'เด็กหญิง') {
      setFormGender('F');
    } else if (p === 'ด.ช.' || p === 'นาย' || p === 'เด็กชาย') {
      setFormGender('M');
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedYearFilter !== 'all') {
          const stdYear = s.academicYear || currentSchoolYear;
          if (stdYear !== selectedYearFilter) return false;
        }
        if (selectedGradeFilter !== 'all' && s.gradeLevel !== selectedGradeFilter) return false;
        if (selectedClassFilter !== 'all' && s.classKey !== selectedClassFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const fullName = `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
          return (
            fullName.includes(q) ||
            (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
            String(s.studentNumber).includes(q) ||
            (s.classKey && s.classKey.toLowerCase().includes(q)) ||
            (s.phone && s.phone.includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.classKey !== b.classKey) {
          return a.classKey.localeCompare(b.classKey);
        }
        return (a.studentNumber || 0) - (b.studentNumber || 0);
      });
  }, [students, selectedGradeFilter, selectedClassFilter, selectedYearFilter, searchQuery, currentSchoolYear]);

  // Summary counts
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const male = filteredStudents.filter((s) => s.gender === 'M').length;
    const female = filteredStudents.filter((s) => s.gender === 'F').length;
    const distinctClasses = new Set(filteredStudents.map((s) => s.classKey)).size;
    return { total, male, female, distinctClasses };
  }, [filteredStudents]);

  // Open Edit Modal
  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setAddMode('single');
    setFormPrefix(st.prefix || 'ด.ช.');
    setFormFirstName(st.firstName || '');
    setFormLastName(st.lastName || '');
    setFormStudentCode(st.studentCode || '');
    setFormStudentNumber(st.studentNumber || 1);
    setFormGradeLevel(st.gradeLevel || 'ป.1');
    setFormClassroom(st.classroom || '1');
    setFormAcademicYear(st.academicYear || defaultYear);
    setFormGender(st.gender || 'M');
    setFormPhone(st.phone || '');
    setShowAddModal(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setAddMode('single');
    const targetGrade = selectedGradeFilter !== 'all' ? selectedGradeFilter : (activeGradesInSystem[0] || 'ป.1');
    const targetRoom = selectedClassFilter !== 'all' ? (selectedClassFilter.split('/')[1] || '1') : '1';
    const targetYear = selectedYearFilter !== 'all' ? selectedYearFilter : defaultYear;
    
    setFormPrefix('ด.ช.');
    setFormFirstName('');
    setFormLastName('');
    setFormGradeLevel(targetGrade);
    setFormClassroom(targetRoom);
    setFormAcademicYear(targetYear);
    setFormGender('M');
    setFormPhone('');
    
    const nextNum = getNextNumberForClass(targetGrade, targetRoom, targetYear);
    setFormStudentNumber(nextNum);
    
    // Auto-generate student code
    const shortYear = targetYear.slice(-2);
    setFormStudentCode(`${shortYear}${String(students.length + 1).padStart(3, '0')}`);

    // Pre-fill batch parameters
    setBatchGradeLevel(targetGrade);
    setBatchClassroom(targetRoom);
    setBatchAcademicYear(targetYear);
    setBatchStartNumber(nextNum);
    setBatchRawText('');
    setParsedBatchList([]);

    setShowAddModal(true);
  };

  // Auto-update student number & code when changing grade/room/year in add modal
  const handleFormGradeOrRoomChange = (newGrade: string, newRoom: string, newYear: string) => {
    setFormGradeLevel(newGrade);
    setFormClassroom(newRoom);
    setFormAcademicYear(newYear);
    if (!editingStudent) {
      const nextNum = getNextNumberForClass(newGrade, newRoom, newYear);
      setFormStudentNumber(nextNum);
      const shortYear = newYear.slice(-2);
      setFormStudentCode(`${shortYear}${String(students.length + 1).padStart(3, '0')}`);
    }
  };

  // Save Single Student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim() || !formLastName.trim()) return;

    const classKey = `${formGradeLevel}/${formClassroom}`;

    const studentToSave: Student = {
      id: editingStudent ? editingStudent.id : `std-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      studentCode: formStudentCode.trim() || `ST${Date.now()}`,
      studentNumber: Number(formStudentNumber) || 1,
      prefix: formPrefix,
      firstName: formFirstName.trim(),
      lastName: formLastName.trim(),
      gradeLevel: formGradeLevel,
      classroom: formClassroom,
      classKey,
      academicYear: formAcademicYear,
      gender: formGender,
      status: editingStudent?.status || 'active',
      phone: formPhone.trim(),
    };

    storage.saveStudent(studentToSave);
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    setShowAddModal(false);

    setStatusMessage({
      type: 'success',
      text: editingStudent ? 'อัปเดตข้อมูลนักเรียนเรียบร้อยแล้ว' : 'เพิ่มนักเรียนใหม่เรียบร้อยแล้ว',
      subText: `${studentToSave.prefix}${studentToSave.firstName} ${studentToSave.lastName} (ห้อง ${studentToSave.classKey} เลขที่ ${studentToSave.studentNumber})`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Parse Raw Text in Quick Batch Add
  const handleParseBatchText = () => {
    if (!batchRawText.trim()) return;

    const lines = batchRawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: Array<{
      studentNumber: number;
      studentCode: string;
      prefix: string;
      firstName: string;
      lastName: string;
      gender: 'M' | 'F';
    }> = [];

    const shortYear = batchAcademicYear.slice(-2);
    let currentNum = Number(batchStartNumber) || 1;

    lines.forEach((line, idx) => {
      // Clean leading numbers or bullets like "1.", "1 ", "1\t"
      let workingLine = line;
      let detectedNum = currentNum;
      let detectedCode = '';

      // Check if line starts with student number e.g. "1 68001 ด.ช.กิตติศักดิ์ รัตนโชติ"
      const leadingTokens = workingLine.split(/\s+/);
      if (leadingTokens.length >= 2 && /^\d+$/.test(leadingTokens[0])) {
        detectedNum = parseInt(leadingTokens[0], 10);
        workingLine = workingLine.replace(/^\d+[\.\s\t]+/, '').trim();
      }

      // Check if next token is numeric code (e.g. 5-digits studentCode)
      const codeTokens = workingLine.split(/\s+/);
      if (codeTokens.length >= 2 && /^\d{4,8}$/.test(codeTokens[0])) {
        detectedCode = codeTokens[0];
        workingLine = workingLine.replace(/^\d+[\s\t]+/, '').trim();
      } else {
        detectedCode = `${shortYear}${String(students.length + idx + 1).padStart(3, '0')}`;
      }

      const { prefix, firstName, lastName } = parseThaiFullName(workingLine, 'ด.ช.');
      const gender = detectGender('', prefix);

      if (firstName) {
        results.push({
          studentNumber: detectedNum,
          studentCode: detectedCode,
          prefix: prefix || 'ด.ช.',
          firstName,
          lastName: lastName || '',
          gender,
        });
        currentNum = detectedNum + 1;
      }
    });

    setParsedBatchList(results);
  };

  // Save Quick Batch Students
  const handleSaveBatchStudents = () => {
    if (parsedBatchList.length === 0) return;

    const classKey = `${batchGradeLevel}/${batchClassroom}`;
    const newStudents: Student[] = parsedBatchList.map((item, idx) => ({
      id: `std-batch-${Date.now()}-${idx}`,
      studentNumber: item.studentNumber,
      studentCode: item.studentCode,
      prefix: item.prefix,
      firstName: item.firstName,
      lastName: item.lastName,
      gradeLevel: batchGradeLevel,
      classroom: batchClassroom,
      classKey,
      academicYear: batchAcademicYear,
      gender: item.gender,
      status: 'active',
      phone: '',
    }));

    storage.bulkSaveStudents(newStudents, 'merge');
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    setShowAddModal(false);

    setStatusMessage({
      type: 'success',
      text: `เพิ่มนักเรียนแบบด่วนสำเร็จ ${newStudents.length} คน`,
      subText: `ห้อง ${classKey} ปีการศึกษา ${batchAcademicYear}`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Delete Single Student
  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const st = studentToDelete;
    storage.deleteStudent(st.id);
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    
    setStatusMessage({
      type: 'deleted',
      text: `ลบข้อมูลนักเรียนเรียบร้อยแล้ว`,
      subText: `${st.prefix}${st.firstName} ${st.lastName} (ห้อง ${st.classKey} เลขที่ ${st.studentNumber})`,
    });
    setStudentToDelete(null);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Multi-Select Handlers
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk Delete Selected Students
  const handleExecuteBulkDelete = () => {
    const ids: string[] = Array.from(selectedStudentIds) as string[];
    if (ids.length === 0) return;

    ids.forEach((id: string) => storage.deleteStudent(id));
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    setSelectedStudentIds(new Set());
    setBulkDeleteConfirmOpen(false);

    setStatusMessage({
      type: 'deleted',
      text: `ลบข้อมูลนักเรียนที่เลือกเรียบร้อยแล้ว`,
      subText: `จำนวน ${ids.length} รายชื่อ`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Bulk Move Classroom for Selected Students
  const handleExecuteBulkMove = () => {
    const ids: string[] = Array.from(selectedStudentIds) as string[];
    if (ids.length === 0) return;

    const newClassKey = `${bulkMoveGrade}/${bulkMoveRoom}`;
    const allStds = storage.getStudents();
    
    // Sort selected students by current student number
    const targetStudents = allStds
      .filter((s) => ids.includes(s.id))
      .sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));

    // Get existing students in target classroom
    const existingInTarget = allStds.filter(
      (s) => s.classKey === newClassKey && !ids.includes(s.id)
    );
    const startNum = existingInTarget.length > 0 
      ? Math.max(...existingInTarget.map((s) => s.studentNumber || 0)) + 1 
      : 1;

    const modified = targetStudents.map((s, idx) => ({
      ...s,
      gradeLevel: bulkMoveGrade,
      classroom: bulkMoveRoom,
      classKey: newClassKey,
      studentNumber: startNum + idx,
    }));

    storage.bulkSaveStudents(modified, 'merge');
    const updated = storage.getStudents();
    onUpdateStudents(updated);
    setSelectedStudentIds(new Set());
    setShowBulkMoveModal(false);

    setStatusMessage({
      type: 'success',
      text: `ย้ายห้องเรียนนักเรียนจำนวน ${ids.length} คน เรียบร้อยแล้ว`,
      subText: `ย้ายไปยังห้อง ${newClassKey} (รันเลขที่ใหม่อัตโนมัติ)`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Re-sequence student numbers 1..N for currently filtered classroom
  const handleResequenceClassNumbers = () => {
    if (selectedClassFilter === 'all') {
      alert('กรุณาเลือกกรองห้องเรียนที่ต้องการจัดเรียงเลขที่ใหม่ก่อน เช่น ห้อง ป.1/1 หรือ ม.1/1');
      return;
    }

    if (!window.confirm(`คุณต้องการจัดเรียงเลขที่นักเรียนในห้อง ${selectedClassFilter} ใหม่ตั้งแต่เลขที่ 1 ถึง ${filteredStudents.length} ใช่หรือไม่?`)) {
      return;
    }

    const renumbered = filteredStudents.map((st, idx) => ({
      ...st,
      studentNumber: idx + 1,
    }));

    storage.bulkSaveStudents(renumbered, 'merge');
    const updated = storage.getStudents();
    onUpdateStudents(updated);

    setStatusMessage({
      type: 'success',
      text: `จัดเรียงเลขที่นักเรียนห้อง ${selectedClassFilter} ใหม่สำเร็จ`,
      subText: `เรียงลำดับใหม่ตั้งแต่เลขที่ 1 ถึง ${renumbered.length}`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Handle File Pick for Bulk Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsProcessingImport(true);
    setImportErrors([]);

    try {
      const result = await parseStudentsFromExcel(file, importAcademicYear);
      setParsedPreviewStudents(result.students);
      setImportErrors(result.errors);
    } catch (err: any) {
      setImportErrors([err.message]);
      setParsedPreviewStudents([]);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Remove row from parsed import preview
  const handleRemovePreviewRow = (index: number) => {
    setParsedPreviewStudents((prev) => prev.filter((_, i) => i !== index));
  };

  // Execute Bulk Import
  const handleExecuteImport = () => {
    if (parsedPreviewStudents.length === 0) return;

    // Apply selected importAcademicYear to all imported students
    const finalStudents = parsedPreviewStudents.map((s) => ({
      ...s,
      academicYear: importAcademicYear,
    }));

    storage.bulkSaveStudents(finalStudents, importMode);
    const updated = storage.getStudents();
    onUpdateStudents(updated);

    setShowImportModal(false);
    setImportFile(null);
    setParsedPreviewStudents([]);

    setStatusMessage({
      type: 'success',
      text: `นำเข้ารายชื่อนักเรียนจำนวน ${finalStudents.length} คน เรียบร้อยแล้ว`,
      subText: `บันทึกลงในปีการศึกษา ${importAcademicYear} ด้วยโหมด ${
        importMode === 'merge' ? 'อัปเดต/เพิ่มต่อ' : importMode === 'replace_classes' ? 'แทนที่เฉพาะห้อง' : 'แทนที่ทั้งหมด'
      }`,
    });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Export Filtered Roster to Excel
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
      'ปีการศึกษา': st.academicYear || defaultYear,
      'เบอร์โทร': st.phone || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักเรียน');
    const filename = selectedClassFilter !== 'all' 
      ? `รายชื่อนักเรียน_ห้อง_${selectedClassFilter.replace('/', '_')}.xlsx`
      : 'รายชื่อนักเรียนทั้งหมด.xlsx';
    XLSX.writeFile(wb, filename);
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

  // Seed all students into Firebase Firestore Database
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

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedGradeFilter('all');
    setSelectedClassFilter('all');
    setSelectedYearFilter('all');
    setSearchQuery('');
  };

  const isAnyFilterActive = selectedGradeFilter !== 'all' || selectedClassFilter !== 'all' || selectedYearFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="space-y-5 pb-16">
      
      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 shadow-sm ${
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

      {/* Cloud Firestore Connection Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-emerald-50/70 p-4 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
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
              คอลเลกชัน <code className="font-mono bg-white/80 px-1 py-0.5 rounded border border-slate-200 text-blue-700 font-semibold">students</code> (รองรับอนุบาล ประถม ป.1-ป.6 และมัธยม ม.1-ม.6)
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
            <span>{isSeedingFirebase ? 'กำลังสร้าง/บันทึก...' : 'ซิงค์ฐานข้อมูลขึ้น Cloud'}</span>
          </button>
        </div>
      </div>

      {/* Main Header & Metric Summary */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  ระบบจัดการทะเบียนนักเรียน
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  เพิ่มนักเรียนใหม่ นำเข้าไฟล์ Excel/CSV วางรายชื่อแบบด่วน และตรวจสอบรายชื่อทุกระดับชั้น
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToPromotion && (
              <button
                onClick={onNavigateToPromotion}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span>เลื่อนชั้นเรียน</span>
              </button>
            )}

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>นำเข้ารายชื่อ (Excel / CSV)</span>
            </button>

            <button
              onClick={handleExportRoster}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มนักเรียนใหม่</span>
            </button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium">นักเรียนตามตัวกรอง</span>
            <div className="text-lg font-bold text-slate-800 mt-0.5">
              {stats.total} <span className="text-xs font-normal text-slate-500">/ ทั้งหมด {students.length} คน</span>
            </div>
          </div>
          <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-100">
            <span className="text-[11px] text-sky-700 font-medium">นักเรียนชาย (M)</span>
            <div className="text-lg font-bold text-sky-900 mt-0.5">
              {stats.male} <span className="text-xs font-normal text-sky-700">คน</span>
            </div>
          </div>
          <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100">
            <span className="text-[11px] text-pink-700 font-medium">นักเรียนหญิง (F)</span>
            <div className="text-lg font-bold text-pink-900 mt-0.5">
              {stats.female} <span className="text-xs font-normal text-pink-700">คน</span>
            </div>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
            <span className="text-[11px] text-emerald-700 font-medium">ห้องเรียนที่แสดง</span>
            <div className="text-lg font-bold text-emerald-900 mt-0.5">
              {stats.distinctClasses} <span className="text-xs font-normal text-emerald-700">ห้อง</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, นามสกุล หรือรหัส..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-52 sm:w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Academic Year Filter */}
            <div className="flex items-center gap-1.5 text-xs bg-purple-50/70 px-2.5 py-1.5 rounded-lg border border-purple-200">
              <span className="text-purple-700 font-semibold">ปีการศึกษา:</span>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-purple-900 p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">ทุกปีการศึกษา</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    ปี {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Level Filter - Read strictly from real student data */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-medium">ระดับชั้น:</span>
              <select
                value={selectedGradeFilter}
                onChange={(e) => {
                  setSelectedGradeFilter(e.target.value);
                  setSelectedClassFilter('all');
                }}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">
                  ทุกระดับชั้น {activeGradesInSystem.length > 0 ? `(${activeGradesInSystem.length} ชั้น)` : ''}
                </option>
                {activeGradesInSystem.length === 0 ? (
                  <option value="" disabled>ยังไม่มีข้อมูลระดับชั้นในระบบ</option>
                ) : (
                  activeGradesInSystem.map((lvl) => {
                    const count = students.filter((s) => {
                      if (selectedYearFilter !== 'all') {
                        const y = s.academicYear || currentSchoolYear;
                        if (y !== selectedYearFilter) return false;
                      }
                      return s.gradeLevel === lvl;
                    }).length;
                    return (
                      <option key={lvl} value={lvl}>
                        {lvl} ({count} คน)
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            {/* Room Filter - Read strictly from real student data */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-medium">ห้องเรียน:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold text-slate-700 p-0 focus:ring-0 cursor-pointer"
              >
                <option value="all">
                  {availableClassKeys.length > 0 
                    ? `ทุกห้องเรียน (${availableClassKeys.length} ห้อง)` 
                    : 'ไม่มีห้องเรียน'}
                </option>
                {availableClassKeys.map((cKey) => {
                  const roomCount = students.filter((s) => {
                    if (selectedYearFilter !== 'all') {
                      const y = s.academicYear || currentSchoolYear;
                      if (y !== selectedYearFilter) return false;
                    }
                    return s.classKey === cKey;
                  }).length;
                  return (
                    <option key={cKey} value={cKey}>
                      ห้อง {cKey} ({roomCount} คน)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Reset Filters Button */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}

          </div>

          <div className="flex items-center gap-2">
            {selectedClassFilter !== 'all' && filteredStudents.length > 1 && (
              <button
                type="button"
                onClick={handleResequenceClassNumbers}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                title="เรียงเลขที่ 1 ถึง N ใหม่ตามลำดับในห้องนี้"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>จัดเรียงเลขที่ห้องนี้ใหม่</span>
              </button>
            )}
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              แสดง {filteredStudents.length} คน
            </span>
          </div>
        </div>

        {/* Quick Grade Filter Tabs - Showing strictly real grades from existing student data */}
        <div className="pt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
          <button
            onClick={() => { setSelectedGradeFilter('all'); setSelectedClassFilter('all'); }}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedGradeFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทุกระดับชั้น ({filteredStudents.length !== students.length && selectedYearFilter !== 'all' ? filteredStudents.length : students.length})
          </button>
          {activeGradesInSystem.map((grade) => {
            const count = students.filter((s) => {
              if (selectedYearFilter !== 'all') {
                const y = s.academicYear || currentSchoolYear;
                if (y !== selectedYearFilter) return false;
              }
              return s.gradeLevel === grade;
            }).length;
            return (
              <button
                key={grade}
                onClick={() => {
                  setSelectedGradeFilter(grade);
                  setSelectedClassFilter('all');
                }}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedGradeFilter === grade
                    ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {grade} ({count} คน)
              </button>
            );
          })}
          {activeGradesInSystem.length === 0 && (
            <span className="text-slate-400 text-xs py-1 px-2 italic">
              (ยังไม่มีข้อมูลระดับชั้นในระบบ)
            </span>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Selected Students */}
      {selectedStudentIds.size > 0 && (
        <div className="bg-slate-800 text-white p-3 sm:px-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-900 font-bold text-xs flex items-center justify-center">
              {selectedStudentIds.size}
            </span>
            <span className="text-xs font-medium">เลือกไว้ {selectedStudentIds.size} รายชื่อ</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkMoveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>ย้ายห้องเรียน</span>
            </button>

            <button
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบที่เลือก ({selectedStudentIds.size})</span>
            </button>

            <button
              onClick={() => setSelectedStudentIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white rounded-md cursor-pointer"
              title="ยกเลิกการเลือก"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Student List DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-16 text-center">เลขที่</th>
                <th className="py-3 px-3 w-28">รหัสนักเรียน</th>
                <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                <th className="py-3 px-3 text-center">ระดับชั้น/ห้อง</th>
                <th className="py-3 px-3 text-center">ปีการศึกษา</th>
                <th className="py-3 px-3 text-center">เพศ</th>
                <th className="py-3 px-3">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 text-center w-28">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.map((st) => {
                const isSelected = selectedStudentIds.has(st.id);
                return (
                  <tr 
                    key={st.id} 
                    className={`transition-colors ${
                      isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectStudent(st.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      <span className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-slate-100 text-xs text-slate-800 font-semibold">
                        {st.studentNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 font-medium">
                      {st.studentCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <span className="text-slate-400 font-normal mr-1">{st.prefix}</span>
                      {st.firstName} {st.lastName}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-[11px]">
                        {st.classKey}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-medium text-[10px]">
                        {st.academicYear || defaultYear}
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
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingTranscriptStudentId(st.id)}
                          className="p-1.5 rounded-md text-purple-600 hover:text-purple-800 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-colors cursor-pointer"
                          title="ดูผลการเรียนสะสมย้อนหลังทุกปี (Transcript/ปพ.1)"
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setStudentToDelete(st)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="ลบนักเรียน"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State with Action Guidance */}
        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-700 text-sm">ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAnyFilterActive 
                  ? 'ลองปรับเปลี่ยนตัวกรองระดับชั้น ห้องเรียน หรือปีการศึกษา เพื่อดูรายชื่อทั้งหมด'
                  : 'ยังไม่มีข้อมูลนักเรียนในระบบ สามารถกดปุ่มเพิ่มนักเรียน หรือนำเข้าไฟล์ Excel ด้านบน'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  แสดงนักเรียนทั้งหมดในระบบ ({students.length} คน)
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                เพิ่มนักเรียนใหม่
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                นำเข้าจาก Excel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Student (Supports Single Entry & Quick Batch Paste) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  {editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่เข้าสู่ระบบ'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  รองรับทุกระดับชั้น (อนุบาล อ.1-อ.3, ประถม ป.1-ป.6 และมัธยม ม.1-ม.6)
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch (Only for new additions) */}
            {!editingStudent && (
              <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    addMode === 'single'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  กรอกข้อมูลทีละคน
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('batch_text')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    addMode === 'batch_text'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>วางรายชื่อข้อความหลายคน (Quick Paste)</span>
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 pr-1">
              {addMode === 'single' ? (
                <form onSubmit={handleSaveStudent} className="space-y-4">
                  
                  {/* Classroom, Grade, and Academic Year Selection */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ระดับชั้น <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formGradeLevel}
                        onChange={(e) => handleFormGradeOrRoomChange(e.target.value, formClassroom, formAcademicYear)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white font-medium"
                      >
                        {activeGradesInSystem.length > 0 && (
                          <optgroup label="ระดับชั้นที่มีอยู่ในระบบ (ข้อมูลจริง)">
                            {activeGradesInSystem.map((g) => {
                              const count = students.filter(s => s.gradeLevel === g).length;
                              return (
                                <option key={g} value={g}>
                                  {g} ({count} คน)
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        <optgroup label="ระดับชั้นมาตรฐานอื่นๆ">
                          {ALL_GRADES.filter(g => !activeGradesInSystem.includes(g)).map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </optgroup>
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
                        onChange={(e) => handleFormGradeOrRoomChange(formGradeLevel, e.target.value, formAcademicYear)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 text-center bg-white font-semibold"
                        placeholder="1"
                      />
                      {existingRoomsForFormGrade.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400">ห้องจริง:</span>
                          {existingRoomsForFormGrade.map((rm) => (
                            <button
                              key={rm}
                              type="button"
                              onClick={() => handleFormGradeOrRoomChange(formGradeLevel, rm, formAcademicYear)}
                              className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                                formClassroom === rm
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title={`เลือกห้อง ${formGradeLevel}/${rm}`}
                            >
                              /{rm}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ปีการศึกษา <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formAcademicYear}
                        onChange={(e) => handleFormGradeOrRoomChange(formGradeLevel, formClassroom, e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white font-semibold text-purple-900"
                      >
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            ปี {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

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
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        คำนำหน้า
                      </label>
                      <select
                        value={formPrefix}
                        onChange={(e) => handlePrefixChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="ด.ช.">ด.ช.</option>
                        <option value="ด.ญ.">ด.ญ.</option>
                        <option value="นาย">นาย</option>
                        <option value="น.ส.">น.ส.</option>
                        <option value="เด็กชาย">เด็กชาย</option>
                        <option value="เด็กหญิง">เด็กหญิง</option>
                        <option value="นางสาว">นางสาว</option>
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
                        placeholder="กิตติศักดิ์"
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
                        placeholder="รัตนโชติ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        เบอร์โทรศัพท์ติดต่อ (ไม่บังคับ)
                      </label>
                      <input
                        type="text"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                        placeholder="081-234-5678"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs cursor-pointer"
                    >
                      {editingStudent ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลนักเรียน'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Quick Batch Paste Sub-View */
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ระดับชั้น
                      </label>
                      <select
                        value={batchGradeLevel}
                        onChange={(e) => {
                          setBatchGradeLevel(e.target.value);
                          const nextNum = getNextNumberForClass(e.target.value, batchClassroom, batchAcademicYear);
                          setBatchStartNumber(nextNum);
                        }}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium"
                      >
                        {activeGradesInSystem.length > 0 && (
                          <optgroup label="ระดับชั้นที่มีอยู่ในระบบ (ข้อมูลจริง)">
                            {activeGradesInSystem.map((g) => {
                              const count = students.filter(s => s.gradeLevel === g).length;
                              return (
                                <option key={g} value={g}>
                                  {g} ({count} คน)
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                        <optgroup label="ระดับชั้นมาตรฐานอื่นๆ">
                          {ALL_GRADES.filter(g => !activeGradesInSystem.includes(g)).map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ห้อง
                      </label>
                      <input
                        type="text"
                        value={batchClassroom}
                        onChange={(e) => {
                          setBatchClassroom(e.target.value);
                          const nextNum = getNextNumberForClass(batchGradeLevel, e.target.value, batchAcademicYear);
                          setBatchStartNumber(nextNum);
                        }}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-center bg-white font-semibold"
                        placeholder="1"
                      />
                      {existingRoomsForBatchGrade.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400">ห้องจริง:</span>
                          {existingRoomsForBatchGrade.map((rm) => (
                            <button
                              key={rm}
                              type="button"
                              onClick={() => {
                                setBatchClassroom(rm);
                                const nextNum = getNextNumberForClass(batchGradeLevel, rm, batchAcademicYear);
                                setBatchStartNumber(nextNum);
                              }}
                              className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                                batchClassroom === rm
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title={`เลือกห้อง ${batchGradeLevel}/${rm}`}
                            >
                              /{rm}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        เลขที่เริ่มต้น
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={batchStartNumber}
                        onChange={(e) => setBatchStartNumber(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-center bg-white font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>วางรายชื่อนักเรียน (บรรทัดละ 1 คน):</span>
                      <span className="text-[10px] text-slate-400 font-normal">เช่น ด.ช. กิตติศักดิ์ รัตนโชติ หรือ 1 68001 ด.ช. กิตติศักดิ์</span>
                    </label>
                    <textarea
                      rows={6}
                      value={batchRawText}
                      onChange={(e) => setBatchRawText(e.target.value)}
                      placeholder={`ด.ช. กิตติศักดิ์ รัตนโชติ\nด.ญ. กานดา วงษ์สุวรรณ\nนาย ธนกฤต สมบูรณ์สุข\nน.ส. ณิชานันท์ บุญประเสริฐ`}
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 font-mono leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={handleParseBatchText}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>แปลงรายชื่ออัตโนมัติ</span>
                    </button>

                    <span className="text-xs text-slate-500">
                      แปลงได้ {parsedBatchList.length} รายชื่อ
                    </span>
                  </div>

                  {parsedBatchList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-800">
                        ตรวจสอบรายชื่อก่อนบันทึกเข้าห้อง {batchGradeLevel}/{batchClassroom}:
                      </p>
                      <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-bold sticky top-0 border-b border-slate-200">
                            <tr>
                              <th className="py-1.5 px-3">เลขที่</th>
                              <th className="py-1.5 px-3">รหัส</th>
                              <th className="py-1.5 px-3">ชื่อ - นามสกุล</th>
                              <th className="py-1.5 px-3">เพศ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedBatchList.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1 px-3 font-bold text-slate-800">{item.studentNumber}</td>
                                <td className="py-1 px-3 font-mono text-[11px] text-slate-500">{item.studentCode}</td>
                                <td className="py-1 px-3">{item.prefix}{item.firstName} {item.lastName}</td>
                                <td className="py-1 px-3">{item.gender === 'M' ? 'ชาย' : 'หญิง'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={parsedBatchList.length === 0}
                      onClick={handleSaveBatchStudents}
                      className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 rounded-lg shadow-xs cursor-pointer"
                    >
                      บันทึกรายชื่อทั้งหมด ({parsedBatchList.length} คน)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import via Excel/CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-emerald-600" />
                  นำเข้ารายชื่อนักเรียนจำนวนมาก (Bulk Import Excel / CSV)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  รองรับไฟล์ .xlsx, .xls, .csv พร้อมระบบจับคู่หัวคอลัมน์ภาษาไทยอัตโนมัติ
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              
              {/* Template Download Banner */}
              <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-950">ยังไม่มีไฟล์รูปแบบมาตรฐาน?</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    ดาวน์โหลดเทมเพลตตัวอย่างที่มีข้อมูลครบถ้วนทั้งระดับประถม (ป.1) และมัธยม (ม.1)
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={downloadStudentTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ไฟล์ Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={downloadStudentCsvTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100/50 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ไฟล์ CSV</span>
                  </button>
                </div>
              </div>

              {/* Import Settings: Year & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    นำเข้าสู่ปีการศึกษา:
                  </label>
                  <select
                    value={importAcademicYear}
                    onChange={(e) => setImportAcademicYear(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-purple-900"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        ปีการศึกษา {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รูปแบบการบันทึก:
                  </label>
                  <select
                    value={importMode}
                    onChange={(e: any) => setImportMode(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-800"
                  >
                    <option value="merge">เพิ่มต่อ / อัปเดตรายชื่อเดิม (Merge)</option>
                    <option value="replace_classes">แทนที่เฉพาะห้องที่มีในไฟล์</option>
                    <option value="replace_all">แทนที่รายชื่อทั้งหมดในระบบ</option>
                  </select>
                </div>
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
                  รองรับทั้งคอลัมน์แยก "ชื่อ" "นามสกุล" หรือคอลัมน์รวม "ชื่อ-สกุล"
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
                    พบข้อสังเกตในไฟล์ ({importErrors.length} รายการ):
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-800">
                      ตัวอย่างข้อมูลที่พร้อมนำเข้า ({parsedPreviewStudents.length} คน):
                    </p>
                    <span className="text-[11px] text-slate-500">
                      ตรวจสอบและสามารถลบแถวที่ไม่ต้องการออกได้
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">เลขที่</th>
                          <th className="py-2 px-3">รหัส</th>
                          <th className="py-2 px-3">ชื่อ - นามสกุล</th>
                          <th className="py-2 px-3">ห้องเรียน</th>
                          <th className="py-2 px-3">เพศ</th>
                          <th className="py-2 px-2 text-center w-10">ลบ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreviewStudents.slice(0, 30).map((st, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-bold text-slate-800">{st.studentNumber}</td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">{st.studentCode}</td>
                            <td className="py-1.5 px-3">{st.prefix}{st.firstName} {st.lastName}</td>
                            <td className="py-1.5 px-3 font-semibold text-emerald-700">{st.classKey}</td>
                            <td className="py-1.5 px-3">{st.gender === 'M' ? 'ชาย' : 'หญิง'}</td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemovePreviewRow(i)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                                title="ลบแถวนี้"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedPreviewStudents.length > 30 && (
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      และอีก {parsedPreviewStudents.length - 30} รายชื่อ...
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

      {/* Modal: Bulk Move Classroom */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                ย้ายห้องเรียน ({selectedStudentIds.size} คน)
              </h3>
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              เลือกห้องเรียนปลายทางที่ต้องการย้ายนักเรียน ระบบจะจัดเรียงเลขที่ใหม่ต่อท้ายในห้องเรียนปลายทางอัตโนมัติ
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับชั้นใหม่:
                </label>
                <select
                  value={bulkMoveGrade}
                  onChange={(e) => {
                    const newGrade = e.target.value;
                    setBulkMoveGrade(newGrade);
                    const rooms = Array.from(new Set(students.filter(s => s.gradeLevel === newGrade).map(s => s.classroom).filter(Boolean)));
                    if (rooms.length > 0) {
                      setBulkMoveRoom(rooms[0]);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium"
                >
                  {activeGradesInSystem.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  {activeGradesInSystem.length === 0 && (
                    ALL_GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ห้องใหม่:
                </label>
                <input
                  type="text"
                  value={bulkMoveRoom}
                  onChange={(e) => setBulkMoveRoom(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg text-center font-bold bg-white"
                  placeholder="1"
                />
                {existingRoomsForBulkMove.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] text-slate-400">ห้องจริง:</span>
                    {existingRoomsForBulkMove.map((rm) => (
                      <button
                        key={rm}
                        type="button"
                        onClick={() => setBulkMoveRoom(rm)}
                        className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                          bulkMoveRoom === rm
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        /{rm}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkMoveModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkMove}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                ยืนยันการย้ายห้อง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Modal */}
      {bulkDeleteConfirmOpen && (
        <ConfirmDeleteModal
          isOpen={bulkDeleteConfirmOpen}
          title="ยืนยันการลบนักเรียนกลุ่มที่เลือก"
          itemTitle={`จำนวนนักเรียนที่เลือกทั้งหมด ${selectedStudentIds.size} คน`}
          itemSubtitle="การลบนี้จะนำรายชื่อและข้อมูลคะแนนของนักเรียนทุกคนที่เลือกออกจากระบบ"
          warningMessage="ข้อมูลนักเรียนที่ถูกลบจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบให้แน่ใจก่อนกดยืนยัน"
          confirmLabel={`ลบนักเรียนทั้ง ${selectedStudentIds.size} คน`}
          cancelLabel="ยกเลิก"
          onConfirm={handleExecuteBulkDelete}
          onClose={() => setBulkDeleteConfirmOpen(false)}
        />
      )}

      {/* Confirm Delete Single Student Modal */}
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

      {/* Multi-Year Cumulative Transcript Modal */}
      <StudentTranscriptModal
        isOpen={Boolean(viewingTranscriptStudentId)}
        studentId={viewingTranscriptStudentId || undefined}
        onClose={() => setViewingTranscriptStudentId(null)}
      />

    </div>
  );
};
