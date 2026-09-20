import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  GraduationCap, 
  Award, 
  Calendar, 
  User, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  TrendingUp,
  FileText,
  School
} from 'lucide-react';
import { storage } from '../services/storage';
import { Student } from '../types';

interface StudentTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
}

export const StudentTranscriptModal: React.FC<StudentTranscriptModalProps> = ({
  isOpen,
  onClose,
  studentId,
}) => {
  const [transcriptData, setTranscriptData] = useState<ReturnType<typeof storage.getStudentMultiYearTranscript> | null>(null);
  const [activeYearTab, setActiveYearTab] = useState<string>('all');
  const schoolSettings = storage.getSchoolSettings();

  useEffect(() => {
    if (isOpen && studentId) {
      const data = storage.getStudentMultiYearTranscript(studentId);
      setTranscriptData(data);
      setActiveYearTab('all');
    } else {
      setTranscriptData(null);
    }
  }, [isOpen, studentId]);

  if (!isOpen || !transcriptData || !transcriptData.student) return null;

  const { student, gpax, totalCreditsAccumulated, yearlyData } = transcriptData;

  const handlePrint = () => {
    window.print();
  };

  const getGradeBadge = (grade: number) => {
    if (grade >= 3.5) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
    } else if (grade >= 2.5) {
      return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
    } else if (grade >= 1.5) {
      return 'bg-amber-100 text-amber-800 border-amber-300 font-medium';
    } else if (grade >= 1.0) {
      return 'bg-orange-100 text-orange-800 border-orange-300 font-medium';
    } else {
      return 'bg-red-100 text-red-800 border-red-300 font-bold';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full">
        
        {/* Header - Screen View */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shadow-2xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>ประวัติผลการเรียนสะสมย้อนหลัง (Cumulative Transcript)</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  ทุกปีการศึกษา
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                รหัสนักเรียน: <span className="font-mono font-semibold text-slate-700">{student.studentCode}</span> &bull; {student.prefix}{student.firstName} {student.lastName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ใบผลการเรียน (ปพ.)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Header (Only in Print) */}
        <div className="hidden print:block text-center pt-6 pb-4 border-b-2 border-slate-800 px-6 font-['Sarabun',sans-serif]">
          <div className="flex items-center justify-center gap-2 mb-1">
            <School className="w-6 h-6 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900">{schoolSettings.schoolName || 'โรงเรียนตัวอย่างวิทยา'}</h1>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {schoolSettings.affiliation || 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน'} {schoolSettings.province ? `จังหวัด${schoolSettings.province}` : ''}
          </p>
          <h2 className="text-base font-bold text-slate-900 mt-2">
            ระเบียนแสดงผลการเรียนสะสมรายบุคคล (ปพ.1 / Transcript)
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-800 mt-3 text-left max-w-2xl mx-auto bg-slate-50 p-3 rounded border border-slate-300">
            <div><strong>ชื่อ-สกุล:</strong> {student.prefix}{student.firstName} {student.lastName}</div>
            <div><strong>รหัสประจำตัวนักเรียน:</strong> {student.studentCode}</div>
            <div><strong>ชั้นเรียนปัจจุบัน:</strong> {student.classKey} (เลขที่ {student.studentNumber})</div>
            <div><strong>เกรดเฉลี่ยสะสมรวม (GPAX):</strong> <span className="font-bold text-sm">{gpax.toFixed(2)}</span> ({totalCreditsAccumulated} หน่วยกิต)</div>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Student Profile & Cumulative GPAX Card (Screen view) */}
          <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/80 rounded-2xl p-4 sm:p-5 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-xl">
                  {student.firstName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-slate-900">
                      {student.prefix}{student.firstName} {student.lastName}
                    </h4>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      student.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : student.status === 'graduated'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {student.status === 'active' ? 'กำลังศึกษา' : student.status === 'graduated' ? 'จบการศึกษาแล้ว' : student.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                    <span>รหัส: <strong className="font-mono text-slate-800">{student.studentCode}</strong></span>
                    <span>&bull;</span>
                    <span>ชั้นปัจจุบัน: <strong className="text-purple-700">{student.classKey}</strong> (เลขที่ {student.studentNumber})</span>
                    <span>&bull;</span>
                    <span>ปีการศึกษาปัจจุบัน: <strong>{student.academicYear || schoolSettings.academicYear}</strong></span>
                  </div>
                </div>
              </div>

              {/* Cumulative GPAX Big Badge */}
              <div className="flex items-center gap-3 sm:border-l sm:border-purple-200 sm:pl-6">
                <div className="text-right">
                  <span className="text-[11px] font-medium text-slate-500 block">เกรดเฉลี่ยสะสม (GPAX)</span>
                  <span className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
                    {gpax.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-medium">
                    จาก {totalCreditsAccumulated} หน่วยกิต
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Tab Filter by Year (Screen View) */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 print:hidden overflow-x-auto">
            <button
              onClick={() => setActiveYearTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeYearTab === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              แสดงประวัติทุกปี ({yearlyData.length} ปีการศึกษา)
            </button>
            {yearlyData.map((yd) => (
              <button
                key={yd.academicYear}
                onClick={() => setActiveYearTab(yd.academicYear)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeYearTab === yd.academicYear
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ปีการศึกษา {yd.academicYear} ({yd.classKey})
              </button>
            ))}
          </div>

          {/* Yearly Records List */}
          {yearlyData.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">ยังไม่พบบันทึกประวัติผลการเรียนของนักเรียนท่านนี้</p>
              <p className="text-xs text-slate-400 mt-1">จะแสดงเมื่อมีการบันทึกคะแนนในรายวิชาหรือการเลื่อนชั้นเรียน</p>
            </div>
          ) : (
            yearlyData
              .filter((yd) => activeYearTab === 'all' || activeYearTab === yd.academicYear)
              .map((yd) => (
                <div 
                  key={yd.academicYear} 
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none print:break-inside-avoid"
                >
                  {/* Year Card Header */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:bg-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-800">
                          ปีการศึกษา {yd.academicYear}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          ระดับชั้น <strong className="text-slate-700">{yd.gradeLevel}</strong> ห้อง <strong className="text-slate-700">{yd.classKey}</strong> (เลขที่ {yd.studentNumber})
                        </p>
                      </div>
                    </div>

                    {/* Year Stats Pills */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 shadow-2xs">
                        เกรดเฉลี่ย (GPA): <strong className="text-purple-700 font-bold text-sm ml-1">{yd.gpa.toFixed(2)}</strong>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hidden sm:inline">
                        หน่วยกิต: <strong>{yd.totalCredits}</strong>
                      </span>
                      <span className={`px-2 py-1 rounded-lg border font-semibold ${
                        yd.failedCount === 0 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {yd.failedCount === 0 ? 'ผ่านทุกวิชา' : `ไม่ผ่าน ${yd.failedCount} วิชา`}
                      </span>
                    </div>
                  </div>

                  {/* Subjects & Scores Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/75 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 w-24">รหัสวิชา</th>
                          <th className="py-2.5 px-3 min-w-[180px]">ชื่อรายวิชา</th>
                          <th className="py-2.5 px-3 w-16 text-center">นก.</th>
                          <th className="py-2.5 px-3 w-24 text-center">เทอม 1 (เกรด)</th>
                          <th className="py-2.5 px-3 w-24 text-center">เทอม 2 (เกรด)</th>
                          <th className="py-2.5 px-3 w-24 text-center">รวม 2 เทอม</th>
                          <th className="py-2.5 px-3 w-20 text-center">เกรดเฉลี่ย</th>
                          <th className="py-2.5 px-3 w-20 text-center">ผลประเมิน</th>
                          <th className="py-2.5 px-3 min-w-[120px] print:hidden">ครูผู้สอน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {yd.subjects.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-slate-400">
                              ยังไม่มีการบันทึกคะแนนในรายวิชาสำหรับปีการศึกษานี้
                            </td>
                          </tr>
                        ) : (
                          yd.subjects.map((item, idx) => {
                            const sc = item.score;
                            const finalGrade = sc.finalCombined?.finalGrade ?? 0;
                            const passed = sc.finalCombined?.passed ?? (finalGrade >= 1);
                            
                            return (
                              <tr key={item.subject.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{item.subject.code}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">{item.subject.name}</td>
                                <td className="py-2.5 px-3 text-center text-slate-600 font-medium">{item.subject.credits || 1.0}</td>
                                
                                {/* Term 1 */}
                                <td className="py-2.5 px-3 text-center">
                                  {sc.semester1?.totalSemesterScore !== undefined ? (
                                    <span className="inline-flex items-center gap-1 font-mono">
                                      <span>{sc.semester1.totalSemesterScore}</span>
                                      <span className="text-[10px] text-slate-400">({sc.semester1.grade})</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>

                                {/* Term 2 */}
                                <td className="py-2.5 px-3 text-center">
                                  {sc.semester2?.totalSemesterScore !== undefined ? (
                                    <span className="inline-flex items-center gap-1 font-mono">
                                      <span>{sc.semester2.totalSemesterScore}</span>
                                      <span className="text-[10px] text-slate-400">({sc.semester2.grade})</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>

                                {/* Final Combined Score */}
                                <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                                  {sc.finalCombined?.combinedAverageScore !== undefined 
                                    ? sc.finalCombined.combinedAverageScore.toFixed(1) 
                                    : '-'}
                                </td>

                                {/* Final Grade Badge */}
                                <td className="py-2.5 px-3 text-center">
                                  {sc.finalCombined?.finalGrade !== undefined ? (
                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${getGradeBadge(sc.finalCombined.finalGrade)}`}>
                                      {sc.finalCombined.finalGrade}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>

                                {/* Pass Status */}
                                <td className="py-2.5 px-3 text-center">
                                  {passed ? (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold text-[11px]">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ผ่าน
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold text-[11px]">
                                      <AlertCircle className="w-3 h-3 text-red-500" /> ไม่ผ่าน
                                    </span>
                                  )}
                                </td>

                                {/* Teacher Name */}
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[140px] print:hidden">
                                  {item.subject.teacherName || '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {yd.subjects.length > 0 && (
                        <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                          <tr>
                            <td colSpan={3} className="py-2.5 px-3 text-right">สรุปประจำปีการศึกษา {yd.academicYear}:</td>
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-700">{yd.totalCredits}</td>
                            <td colSpan={3} className="py-2.5 px-3 text-right text-slate-500">เกรดเฉลี่ยประจำปี (GPA):</td>
                            <td className="py-2.5 px-3 text-center font-bold text-sm text-purple-700 bg-purple-50/80">{yd.gpa.toFixed(2)}</td>
                            <td colSpan={2} className="py-2.5 px-3 text-emerald-700">ผ่าน {yd.passedCount}/{yd.subjects.length} วิชา</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Promotion Note if applicable */}
                  {yd.promotedAt && (
                    <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>เลื่อนชั้นเมื่อ: {new Date(yd.promotedAt).toLocaleDateString('th-TH')} โดย {yd.promotedBy || 'ผู้ดูแลระบบ'}</span>
                      <span className="font-semibold text-indigo-600">สถานะ: {yd.status}</span>
                    </div>
                  )}
                </div>
              ))
          )}

        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden shrink-0">
          <p className="text-xs text-slate-500">
            * ข้อมูลคะแนนและเกรดเฉลี่ยถูกคำนวณตามเกณฑ์ 100 คะแนน และระบบ 8 ระดับผลการเรียน
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
