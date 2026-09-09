import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Download,
  ExternalLink,
  Award
} from 'lucide-react';
import { Student, Subject, Exam, ExamRecord, SchoolSettings } from '../types';
import { storage } from '../services/storage';
import { formatStrandDisplay } from '../utils/strandFormatter';

interface PrintExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  classKey: string;
  exam: Exam | null; // null means summary of all exams
  allExams?: Exam[];
  students: Student[];
  examRecord?: ExamRecord;
  allRecords?: ExamRecord[];
  schoolSettings: SchoolSettings;
}

export const PrintExamModal: React.FC<PrintExamModalProps> = ({
  isOpen,
  onClose,
  subject,
  classKey,
  exam,
  allExams = [],
  students,
  examRecord,
  allRecords = [],
  schoolSettings,
}) => {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl('');
      }
      return;
    }

    const timer = setTimeout(() => {
      if (printRef.current) {
        const printContent = printRef.current.innerHTML;
        const htmlDoc = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>ใบลงคะแนนสอบ - ${subject.code} ${subject.name} ห้อง ${classKey}</title>
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <style>
                @page {
                  size: A4 portrait;
                  margin: 10mm 12mm 12mm 12mm;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body {
                  font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
                  font-size: 13px;
                  color: #1e293b;
                  background: #fff;
                  margin: 0;
                  padding: 10px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 8px;
                }
                th, td {
                  border: 1px solid #334155;
                  padding: 4px 6px;
                  text-align: center;
                }
                th {
                  background-color: #f1f5f9;
                  font-weight: 600;
                  font-size: 12px;
                }
                .text-left { text-align: left; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .bg-pass { background-color: #ecfdf5; color: #047857; }
                .bg-fail { background-color: #fff1f2; color: #be123c; }
                .bg-absent { background-color: #fef2f2; color: #b91c1c; }
                @media print {
                  body { padding: 0; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `;

        const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, exam, classKey, subject]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (blobUrl) {
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } else {
      window.print();
    }
  };

  // Sort students by student number
  const sortedStudents = [...students].sort((a, b) => a.studentNumber - b.studentNumber);

  // Stats calculation
  let totalExaminees = 0;
  let totalAbsent = 0;
  let totalPassed = 0;
  let totalScoreSum = 0;
  let maxScoreVal = 0;
  let minScoreVal = 999;

  if (exam && examRecord) {
    sortedStudents.forEach((student) => {
      const scoreObj = examRecord.studentScores[student.id];
      if (scoreObj) {
        if (scoreObj.status === 'absent') {
          totalAbsent++;
        } else {
          const hasScore = scoreObj.status === 'retested' && scoreObj.retestScore !== undefined
            ? true
            : scoreObj.score !== undefined;
          if (hasScore) {
            totalExaminees++;
            const finalScore = scoreObj.status === 'retested' && scoreObj.retestScore !== undefined 
              ? scoreObj.retestScore 
              : (scoreObj.score ?? 0);
            totalScoreSum += finalScore;
            if (finalScore > maxScoreVal) maxScoreVal = finalScore;
            if (finalScore < minScoreVal) minScoreVal = finalScore;
            if (finalScore >= exam.passingScore) totalPassed++;
          }
        }
      }
    });
  }

  const avgScore = totalExaminees > 0 ? (totalScoreSum / totalExaminees).toFixed(1) : '0';
  if (minScoreVal === 999) minScoreVal = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                พิมพ์เอกสารแบบทดสอบ / ใบลงคะแนนสอบ
              </h3>
              <p className="text-xs text-slate-500">
                {exam ? exam.title : 'ใบสรุปคะแนนสอบรวมทุกแบบทดสอบ'} • ชั้น {classKey}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร (Print / PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div 
            ref={printRef}
            className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 max-w-[210mm] w-full min-h-[297mm] text-slate-800 font-sans"
          >
            {/* Header Document */}
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                {schoolSettings.schoolName || 'โรงเรียนสาธิตวิทยาคม'}
              </h2>
              <p className="text-xs text-slate-600">
                {schoolSettings.affiliation || 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)'}
              </p>
              <h3 className="text-sm font-bold text-slate-800 pt-1">
                {exam ? 'ใบลงคะแนนและการประเมินผลการสอบ' : 'ใบสรุปผลการสอบทุกชุด'}
              </h3>
              <p className="text-xs text-slate-700">
                รายวิชา: <span className="font-semibold">{subject.code} {subject.name}</span> | ภาคเรียนที่ {exam ? exam.semester : subject.semester1TargetScore ? '1-2' : '1'} ปีการศึกษา {schoolSettings.academicYear || '2568'}
              </p>
              <p className="text-xs text-slate-700">
                ระดับชั้น/ห้อง: <span className="font-semibold">{classKey}</span> | ครูผู้สอน: <span className="font-semibold">{subject.teacherName || 'ครูประจำวิชา'}</span>
              </p>
            </div>

            {/* Exam Spec Box */}
            {exam && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-300 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-500">แบบทดสอบ: </span>
                  <span className="font-bold text-slate-800">{exam.title}</span>
                </div>
                <div>
                  <span className="text-slate-500">ประเภท: </span>
                  <span className="font-semibold text-slate-800">
                    {exam.examType === 'unit_quiz' ? 'สอบย่อยท้ายบท' :
                     exam.examType === 'midterm' ? 'สอบกลางภาค' :
                     exam.examType === 'final' ? 'สอบปลายภาค' :
                     exam.examType === 'practical' ? 'สอบปฏิบัติ' :
                     exam.examType === 'retest' ? 'สอบแก้ตัว' : 'แบบทดสอบทั่วไป'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">คะแนนเต็ม: </span>
                  <span className="font-bold text-indigo-700">{exam.maxScore} คะแนน</span>
                </div>
                <div>
                  <span className="text-slate-500">เกณฑ์ผ่าน: </span>
                  <span className="font-bold text-emerald-700">{exam.passingScore} คะแนน</span>
                </div>
                {exam.strand && (
                  <div className="col-span-2">
                    <span className="text-slate-500">สาระ: </span>
                    <span className="font-medium text-slate-700">{formatStrandDisplay(exam.strand)}</span>
                  </div>
                )}
                {exam.topic && (
                  <div className="col-span-2">
                    <span className="text-slate-500">เรื่อง/หน่วย: </span>
                    <span className="font-medium text-slate-700">{exam.topic}</span>
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            {exam ? (
              <table className="w-full border-collapse text-xs border border-slate-700">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="py-1.5 px-2 border border-slate-700 w-10">เลขที่</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-18">รหัส</th>
                    <th className="py-1.5 px-3 border border-slate-700 text-left">ชื่อ - สกุล</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-18">คะแนนสอบ<br/>({exam.maxScore})</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-16">ร้อยละ (%)</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-20">สถานะ</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-20">ผลประเมิน</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-28">ลายมือชื่อนักเรียน</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-24">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => {
                    const sc = examRecord?.studentScores[student.id];
                    const hasScore = sc?.score !== undefined || (sc?.status === 'retested' && sc?.retestScore !== undefined);
                    const scoreVal = sc?.score ?? 0;
                    const status = sc?.status ?? 'normal';
                    const isRetest = status === 'retested';
                    const effectiveScore = isRetest && sc?.retestScore !== undefined ? sc.retestScore : scoreVal;
                    const percent = exam.maxScore > 0 && hasScore ? ((effectiveScore / exam.maxScore) * 100).toFixed(0) : '-';
                    const isAbsent = status === 'absent';
                    const isLeave = status === 'leave';
                    const isPassed = !isAbsent && !isLeave && hasScore && effectiveScore >= exam.passingScore;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="py-1 px-2 border border-slate-700 font-mono text-center">{student.studentNumber}</td>
                        <td className="py-1 px-2 border border-slate-700 font-mono text-center">{student.studentCode}</td>
                        <td className="py-1 px-3 border border-slate-700 text-left whitespace-nowrap">
                          {student.prefix}{student.firstName} {student.lastName}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center font-bold font-mono">
                          {isAbsent ? (
                            <span className="text-rose-600 font-semibold">ขาดสอบ</span>
                          ) : isLeave ? (
                            <span className="text-amber-600 font-semibold">ลา</span>
                          ) : !hasScore ? (
                            <span className="text-slate-400 font-normal">-</span>
                          ) : (
                            <span>{effectiveScore}</span>
                          )}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center font-mono">
                          {isAbsent || isLeave ? '-' : percent === '-' ? '-' : `${percent}%`}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center text-[11px]">
                          {status === 'normal' ? 'เข้าสอบปกติ' :
                           status === 'absent' ? 'ขาดสอบ' :
                           status === 'leave' ? 'ลา' :
                           'สอบแก้ตัว'}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center font-semibold text-[11px]">
                          {isAbsent ? (
                            <span className="text-rose-600">มส./ขาดสอบ</span>
                          ) : isLeave ? (
                            <span className="text-amber-600">รอสอบ</span>
                          ) : !hasScore ? (
                            <span className="text-slate-400 font-normal">รอสอบ</span>
                          ) : isPassed ? (
                            <span className="text-emerald-700">✓ ผ่าน</span>
                          ) : (
                            <span className="text-rose-600">✗ ไม่ผ่าน</span>
                          )}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center text-slate-300">
                          .......................
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-left text-[10px] text-slate-500">
                          {sc?.note || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* All Exams Summary Matrix Table */
              <table className="w-full border-collapse text-xs border border-slate-700">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="py-1.5 px-2 border border-slate-700 w-10">เลขที่</th>
                    <th className="py-1.5 px-2 border border-slate-700 w-18">รหัส</th>
                    <th className="py-1.5 px-3 border border-slate-700 text-left">ชื่อ - สกุล</th>
                    {allExams.map((ex) => (
                      <th key={ex.id} className="py-1.5 px-2 border border-slate-700 min-w-16">
                        <div className="font-semibold leading-tight">{ex.title}</div>
                        <div className="text-[10px] font-normal text-slate-600">(เต็ม {ex.maxScore})</div>
                      </th>
                    ))}
                    <th className="py-1.5 px-2 border border-slate-700 bg-slate-200 w-20">คะแนนรวม</th>
                    <th className="py-1.5 px-2 border border-slate-700 bg-slate-200 w-16">ร้อยละ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => {
                    let studentTotal = 0;
                    let maxTotal = 0;

                    return (
                      <tr key={student.id}>
                        <td className="py-1 px-2 border border-slate-700 text-center font-mono">{student.studentNumber}</td>
                        <td className="py-1 px-2 border border-slate-700 text-center font-mono">{student.studentCode}</td>
                        <td className="py-1 px-3 border border-slate-700 text-left whitespace-nowrap">
                          {student.prefix}{student.firstName} {student.lastName}
                        </td>
                        {allExams.map((ex) => {
                          const rec = allRecords.find((r) => r.examId === ex.id && r.classKey === classKey);
                          const sc = rec?.studentScores[student.id];
                          const scoreVal = sc?.score ?? 0;
                          const effective = sc?.status === 'retested' && sc?.retestScore !== undefined ? sc.retestScore : scoreVal;
                          const isAbsent = sc?.status === 'absent';
                          const hasVal = sc && (sc.score !== undefined || (sc.status === 'retested' && sc.retestScore !== undefined));
                          maxTotal += ex.maxScore;
                          if (!isAbsent && hasVal) studentTotal += effective;

                          return (
                            <td key={ex.id} className="py-1 px-2 border border-slate-700 text-center font-mono">
                              {isAbsent ? (
                                <span className="text-rose-600 text-[10px]">ขาด</span>
                              ) : hasVal ? (
                                <span>{effective}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-1 px-2 border border-slate-700 text-center font-bold font-mono bg-slate-50">
                          {studentTotal} / {maxTotal}
                        </td>
                        <td className="py-1 px-2 border border-slate-700 text-center font-mono bg-slate-50">
                          {maxTotal > 0 ? ((studentTotal / maxTotal) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Summary Statistics Footer */}
            {exam && (
              <div className="mt-4 p-3 border border-slate-400 rounded-lg text-xs grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-50 text-center">
                <div>
                  <div className="text-slate-500">นักเรียนทั้งหมด</div>
                  <div className="font-bold text-slate-800">{sortedStudents.length} คน</div>
                </div>
                <div>
                  <div className="text-slate-500">เข้าสอบ</div>
                  <div className="font-bold text-emerald-700">{totalExaminees} คน</div>
                </div>
                <div>
                  <div className="text-slate-500">ขาดสอบ</div>
                  <div className="font-bold text-rose-600">{totalAbsent} คน</div>
                </div>
                <div>
                  <div className="text-slate-500">สอบผ่านเกณฑ์</div>
                  <div className="font-bold text-emerald-700">
                    {totalPassed} คน ({totalExaminees > 0 ? ((totalPassed / totalExaminees) * 100).toFixed(0) : 0}%)
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">คะแนนเฉลี่ย</div>
                  <div className="font-bold text-indigo-700">{avgScore}</div>
                </div>
                <div>
                  <div className="text-slate-500">คะแนนสูงสุด / ต่ำสุด</div>
                  <div className="font-bold text-slate-800">{maxScoreVal} / {minScoreVal}</div>
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-3 text-center text-xs gap-4">
              <div className="space-y-8">
                <div>ลงชื่อ........................................................</div>
                <div>( {subject.teacherName || '...................................................'} )<br/><span className="text-slate-500">ครูผู้สอน / ผู้ตรวจข้อสอบ</span></div>
              </div>
              <div className="space-y-8">
                <div>ลงชื่อ........................................................</div>
                <div>( ................................................... )<br/><span className="text-slate-500">หัวหน้ากลุ่มสาระการเรียนรู้</span></div>
              </div>
              <div className="space-y-8">
                <div>ลงชื่อ........................................................</div>
                <div>( {schoolSettings.directorName || '...................................................'} )<br/><span className="text-slate-500">ผู้อำนวยการสถานศึกษา</span></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
