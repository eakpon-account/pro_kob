import React, { useState } from 'react';
import { Printer, X, Download, School, CheckCircle2, FileSpreadsheet, LayoutList, Award, FileText } from 'lucide-react';
import { Assignment, Student, StudentSubjectScore, Subject } from '../types';
import { getCategoryInfo, getGradeLabel, getAssignmentAbbreviation, getAssignmentSummaryText } from '../utils/grading';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  classKey: string;
  students: Student[];
  scores: StudentSubjectScore[];
  assignments?: Assignment[];
  initialSemester?: 1 | 2 | 'combined';
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  subject,
  classKey,
  students,
  scores,
  assignments = [],
  initialSemester = 1,
}) => {
  const [selectedView, setSelectedView] = useState<1 | 2 | 'combined'>(initialSemester);

  // Sync initialSemester when modal opens or prop changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedView(initialSemester);
    }
  }, [isOpen, initialSemester]);

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

  const scoreMap = new Map<string, StudentSubjectScore>();
  scores.forEach((sc) => scoreMap.set(sc.studentId, sc));

  // Sort by studentNumber ASC
  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);

  // Filter assignments for current view if term 1 or 2
  const currentSemesterAssignments = selectedView !== 'combined'
    ? assignments
        .filter((a) => a.subjectId === subject.id && a.semester === selectedView)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    : [];

  const currentSemesterTotalMax = currentSemesterAssignments.reduce((sum, a) => sum + (a.maxScore || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Action Controls & Tab Switcher (Hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              ตัวอย่างเอกสารสำหรับพิมพ์ / PDF
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              วิชา {subject.code} {subject.name} &bull; ชั้น/ห้อง {classKey} &bull; ปีการศึกษา 2568
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Selector Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedView(1)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedView === 1
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ตารางคะแนน เทอม 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedView(2)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedView === 2
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ตารางคะแนน เทอม 2
              </button>
              <button
                type="button"
                onClick={() => setSelectedView('combined')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedView === 'combined'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                สรุปผล 2 เทอม (ปพ.5)
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Area */}
        <div className="p-4 sm:p-6 bg-white print:p-0 font-['Sarabun',sans-serif]">
          
          {/* Header */}
          <div className="text-center pb-4 border-b-2 border-slate-800">
            <h1 className="text-lg font-bold text-slate-900">
              {selectedView !== 'combined' 
                ? `แบบบันทึกคะแนนเก็บและผลการเรียน ภาคเรียนที่ ${selectedView} ประจำปีการศึกษา 2568`
                : 'แบบบันทึกผลการประเมินและตัดเกรดผลการเรียน ประจำปีการศึกษา 2568 (ปพ.5)'}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-800 mt-2">
              <span>รายวิชา: <strong>{subject.code} {subject.name}</strong></span>
              <span>หน่วยกิต: <strong>{subject.credits}</strong></span>
              <span>ระดับชั้น/ห้อง: <strong>{classKey}</strong></span>
              <span>ครูผู้สอน: <strong>{subject.teacherName}</strong></span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              {selectedView !== 'combined'
                ? `ตารางบันทึกคะแนนรายชิ้นงาน ${currentSemesterAssignments.length} รายการ (คะแนนเต็มรวม ${currentSemesterTotalMax} คะแนน) &bull; คำนวณตัดเกรด 8 ระดับ (0 - 4)`
                : 'การประเมินผล: คะแนนเฉลี่ย 2 ภาคเรียน ((เทอม 1 + เทอม 2) ÷ 2) &bull; ตัดเกรด 8 ระดับ (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)'}
            </p>
          </div>

          {/* Table: Assignment Score Sheet (Term 1 or Term 2) */}
          {selectedView !== 'combined' ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center">
                    <th className="py-2 px-1.5 border border-slate-800 w-10">เลขที่</th>
                    <th className="py-2 px-1.5 border border-slate-800 w-18">รหัส</th>
                    <th className="py-2 px-2.5 border border-slate-800 text-left min-w-[140px]">ชื่อ - นามสกุล</th>
                    
                    {/* Assignment Columns */}
                    {currentSemesterAssignments.map((asg) => {
                      const abbr = getAssignmentAbbreviation(asg, currentSemesterAssignments);
                      return (
                        <th key={asg.id} className="py-2 px-1 border border-slate-800 min-w-[38px] text-center">
                          <div className="font-black text-xs text-slate-900" title={asg.name}>
                            {abbr}
                          </div>
                          <span className="text-[10px] text-slate-700 block font-medium">
                            ({asg.maxScore})
                          </span>
                        </th>
                      );
                    })}

                    <th className="py-2 px-2 border border-slate-800 w-20 bg-slate-50 font-bold">
                      คะแนนรวม<br/>
                      <span className="text-[10px] font-normal">(เต็ม {currentSemesterTotalMax})</span>
                    </th>

                    <th className="py-2 px-2 border border-slate-800 w-20 bg-slate-50 font-bold">
                      เทียบ 100<br/>
                      <span className="text-[10px] font-normal">(เต็ม 100)</span>
                    </th>

                    <th className="py-2 px-2 border border-slate-800 w-16 bg-slate-100 font-bold">
                      เกรด<br/>
                      <span className="text-[10px] font-normal">(0 - 4)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((st) => {
                    const sc = scoreMap.get(st.id);
                    const semData = selectedView === 1 ? sc?.semester1 : sc?.semester2;
                    const rawTotal = semData?.totalRawAssignments ?? 0;
                    const semTotal = semData?.totalSemesterScore ?? 0;
                    const semGrade = semData?.grade ?? 0;

                    return (
                      <tr key={st.id} className="border-b border-slate-300">
                        <td className="py-1 px-1.5 border border-slate-400 text-center font-bold">{st.studentNumber}</td>
                        <td className="py-1 px-1.5 border border-slate-400 text-center font-mono text-[11px]">{st.studentCode}</td>
                        <td className="py-1 px-2.5 border border-slate-400 font-medium whitespace-nowrap">{st.prefix}{st.firstName} {st.lastName}</td>
                        
                        {/* Scores for each assignment */}
                        {currentSemesterAssignments.map((asg) => {
                          const asgScore = semData?.assignmentScores?.[asg.id];
                          const scoreVal = asgScore !== undefined ? asgScore : '-';
                          return (
                            <td key={asg.id} className="py-1 px-1 border border-slate-400 text-center font-mono text-xs">
                              {scoreVal}
                            </td>
                          );
                        })}

                        <td className="py-1 px-2 border border-slate-400 text-center font-bold bg-slate-50/60 font-mono">
                          {rawTotal.toFixed(1)}
                        </td>
                        <td className="py-1 px-2 border border-slate-400 text-center font-bold bg-slate-50 font-mono">
                          {semTotal.toFixed(1)}
                        </td>
                        <td className="py-1 px-2 border border-slate-400 text-center font-bold bg-slate-100 text-xs">
                          {semGrade}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Assignment Details / Legend at the bottom of the table */}
              {currentSemesterAssignments.length > 0 && (
                <div className="mt-3 p-2.5 border border-slate-600 rounded bg-slate-50 text-[11px] leading-relaxed">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    <span>ข้อมูลช่องใบงานและแบบทดสอบ (ภาคเรียนที่ {selectedView}):</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-800">
                    {currentSemesterAssignments.map((asg) => {
                      const summaryText = getAssignmentSummaryText(asg, currentSemesterAssignments);
                      return (
                        <span key={asg.id} className="inline-block">
                          <strong>{summaryText.split('.')[0]}.</strong> {summaryText.substring(summaryText.indexOf('.') + 1)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Table: Combined 2-Semester Summary Sheet (ปพ.5) */
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center">
                    <th className="py-2 px-2 border border-slate-800 w-10">เลขที่</th>
                    <th className="py-2 px-2 border border-slate-800 w-20">รหัส</th>
                    <th className="py-2 px-3 border border-slate-800 text-left">ชื่อ - สกุล</th>
                    <th className="py-2 px-2 border border-slate-800 w-24">คะแนนเทอม 1<br/><span className="text-[10px] font-normal">(100)</span></th>
                    <th className="py-2 px-2 border border-slate-800 w-24">คะแนนเทอม 2<br/><span className="text-[10px] font-normal">(100)</span></th>
                    <th className="py-2 px-2 border border-slate-800 w-28 bg-slate-50">คะแนนเฉลี่ย 2 เทอม<br/><span className="text-[10px] font-normal">(S1+S2)/2</span></th>
                    <th className="py-2 px-2 border border-slate-800 w-20 bg-slate-100">เกรดตัดสิน<br/><span className="text-[10px] font-normal">(0 - 4)</span></th>
                    <th className="py-2 px-2 border border-slate-800 w-24">ผลการประเมิน</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((st) => {
                    const sc = scoreMap.get(st.id);
                    const s1 = sc?.semester1?.totalSemesterScore ?? 0;
                    const s2 = sc?.semester2?.totalSemesterScore ?? 0;
                    const avg = sc?.finalCombined?.combinedAverageScore ?? ((s1 + s2) / 2);
                    const grade = sc?.finalCombined?.finalGrade ?? 0;
                    const passed = sc?.finalCombined?.passed ?? (grade >= 1);

                    return (
                      <tr key={st.id} className="border-b border-slate-300">
                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold">{st.studentNumber}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center font-mono text-[11px]">{st.studentCode}</td>
                        <td className="py-1.5 px-3 border border-slate-400 font-medium">{st.prefix}{st.firstName} {st.lastName}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center">{s1.toFixed(1)}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center">{s2.toFixed(1)}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold bg-slate-50">{avg.toFixed(2)}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center font-bold bg-slate-100 text-sm">เกรด {grade}</td>
                        <td className="py-1.5 px-2 border border-slate-400 text-center font-semibold text-[11px]">
                          {passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
