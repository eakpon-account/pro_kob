import React from 'react';
import { 
  Assignment, 
  Student, 
  StudentSubjectScore 
} from '../types';
import { 
  getCategoryInfo, 
  getGradeLabel,
  getFormattedStandardText,
  getDisplayTopic,
  formatStrandDisplay
} from '../utils/grading';
import { 
  Check, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  UserCheck, 
  AlertCircle,
  FileText,
  Target,
  Bookmark
} from 'lucide-react';

interface MobileSingleAssignmentViewProps {
  assignment: Assignment;
  assignments: Assignment[];
  students: Student[];
  scoreMap: Map<string, StudentSubjectScore>;
  activeSemester: 1 | 2;
  onScoreChange: (studentId: string, asgId: string, val: string, maxScore: number) => void;
  onSelectAssignment: (asgId: string) => void;
}

export const MobileSingleAssignmentView: React.FC<MobileSingleAssignmentViewProps> = ({
  assignment,
  assignments,
  students,
  scoreMap,
  activeSemester,
  onScoreChange,
  onSelectAssignment,
}) => {
  const catInfo = getCategoryInfo(assignment.category);
  const semKey = activeSemester === 1 ? 'semester1' : 'semester2';
  const currentFormattedStd = getFormattedStandardText(assignment);
  const currentDisplayTopic = getDisplayTopic(assignment);

  // Stats calculation
  const filledCount = students.filter((st) => {
    const sc = scoreMap.get(st.id)?.[semKey]?.assignmentScores?.[assignment.id];
    return sc !== undefined && sc !== null;
  }).length;

  const quickScores = React.useMemo(() => {
    const max = assignment.maxScore;
    const items = [
      { label: `เต็ม (${max})`, val: String(max) },
      { label: `${Math.round(max * 0.8)}`, val: String(Math.round(max * 0.8)) },
      { label: `${Math.round(max * 0.5)}`, val: String(Math.round(max * 0.5)) },
      { label: '0', val: '0' },
      { label: 'ล้าง', val: '' }
    ];
    return items;
  }, [assignment.maxScore]);

  const handleFillAll = (scoreVal: string) => {
    students.forEach((st) => {
      onScoreChange(st.id, assignment.id, scoreVal, assignment.maxScore);
    });
  };

  return (
    <div className="space-y-4">
      {/* Assignment Selector & Quick Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            เลือกชิ้นงานที่กำลังตรวจ
          </label>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            กรอกแล้ว {filledCount} / {students.length} คน
          </span>
        </div>

        {/* Dropdown selector */}
        <div className="relative">
          <select
            value={assignment.id}
            onChange={(e) => onSelectAssignment(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer pr-10"
          >
            {assignments.map((asg, idx) => {
              const std = getFormattedStandardText(asg);
              const top = getDisplayTopic(asg);
              const strandVal = formatStrandDisplay(asg.strand);
              const strandPart = strandVal ? ` [สาระที่ : ${strandVal}]` : '';
              const stdPart = asg.standard ? ` [มาตรฐาน : ${asg.standard}]` : (std ? ` [มาตรฐาน : ${std}]` : '');
              const indPart = asg.indicator ? ` [ตัวชี้วัด : ${asg.indicator}]` : '';
              return (
                <option key={asg.id} value={asg.id}>
                  {idx + 1}. {asg.name}{strandPart}{stdPart}{indPart} [ประเภท : {getCategoryInfo(asg.category).label}]{top ? ` [เรื่อง : ${top}]` : ''} (เต็ม {asg.maxScore} คะแนน)
                </option>
              );
            })}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Assignment Brief: ข้อมูลใบงานและช่องคะแนน */}
        <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
          {/* บรรทัดที่ 1: สาระที่ : */}
          <div className="flex items-center gap-1.5 leading-snug">
            <span className="font-semibold text-slate-500 text-[11px] shrink-0">สาระที่ :</span>
            <span className={`text-[11px] font-medium ${assignment.strand ? 'font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200' : 'text-slate-400'}`}>
              {formatStrandDisplay(assignment.strand) || '-'}
            </span>
          </div>

          {/* บรรทัดที่ 2: มาตราฐาน :              ตัวชี้วัด : */}
          <div className="grid grid-cols-2 gap-2 leading-snug">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-slate-500 text-[11px] shrink-0">มาตราฐาน :</span>
              <span className={`text-[11px] truncate ${assignment.standard || currentFormattedStd ? 'font-bold text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200' : 'text-slate-400'}`} title={assignment.standard || currentFormattedStd || ''}>
                {assignment.standard || currentFormattedStd || '-'}
              </span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-slate-500 text-[11px] shrink-0">ตัวชี้วัด :</span>
              <span className={`text-[11px] truncate ${assignment.indicator ? 'font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200' : 'text-slate-400'}`} title={assignment.indicator || ''}>
                {assignment.indicator || '-'}
              </span>
            </div>
          </div>

          {/* บรรทัดที่ 3: เรื่อง : */}
          <div className="flex items-center gap-1.5 leading-snug min-w-0">
            <span className="font-semibold text-slate-500 text-[11px] shrink-0">เรื่อง :</span>
            <span className={`text-[11px] truncate ${currentDisplayTopic ? 'font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200' : 'text-slate-400'}`} title={currentDisplayTopic || ''}>
              {currentDisplayTopic || '-'}
            </span>
          </div>

          {/* บรรทัดที่ 4: ประเภท :          คะแนนเต็ม:    คะแนน */}
          <div className="grid grid-cols-2 gap-2 leading-snug items-center">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-slate-500 text-[11px] shrink-0">ประเภท :</span>
              <span className={`px-1.5 py-0.2 rounded border font-semibold text-[10px] truncate ${catInfo.bgClass} ${catInfo.textClass} ${catInfo.borderClass}`}>
                {catInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-slate-500 text-[11px] shrink-0">คะแนนเต็ม:</span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 truncate">
                {assignment.maxScore} คะแนน
              </span>
            </div>
          </div>

          {assignment.description && (
            <div className="pt-1 text-[10px] text-slate-500 border-t border-slate-100 truncate" title={assignment.description}>
              {assignment.description}
            </div>
          )}
        </div>

        {/* Quick Batch Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar-x pb-1">
          <span className="text-[11px] font-bold text-slate-600 shrink-0">
            เติมคะแนนด่วนทั้งห้อง:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleFillAll(String(assignment.maxScore))}
              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors shadow-2xs"
            >
              เต็มทุกคน
            </button>
            <button
              type="button"
              onClick={() => handleFillAll('0')}
              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors shadow-2xs"
            >
              ให้ 0 ทุกคน
            </button>
            <button
              type="button"
              onClick={() => handleFillAll('')}
              className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors shadow-2xs"
            >
              ล้างคะแนน
            </button>
          </div>
        </div>
      </div>

      {/* Student List Vertical Cards */}
      <div className="space-y-2">
        {students.map((st, sIndex) => {
          const sc = scoreMap.get(st.id)?.[semKey];
          const rawScore = sc?.assignmentScores?.[assignment.id];
          const displayScore = rawScore !== undefined ? String(rawScore) : '';
          const hasScore = rawScore !== undefined;

          return (
            <div
              key={st.id}
              className={`p-3 rounded-xl border transition-all ${
                hasScore 
                  ? 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs' 
                  : 'bg-amber-50/20 border-amber-200/80 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Student Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                    {st.studentNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 truncate">
                      {st.prefix} {st.firstName} {st.lastName}
                    </div>
                    <div className="text-[11px] font-bold text-slate-600 font-mono">
                      {st.studentCode}
                    </div>
                  </div>
                </div>

                {/* Score Input Box with Max Validation */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    id={`mobile-input-${assignment.id}-${sIndex}`}
                    value={displayScore}
                    placeholder="-"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const clean = raw.replace(/[^0-9.]/g, '');
                      const parts = clean.split('.');
                      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;

                      if (sanitized === '') {
                        onScoreChange(st.id, assignment.id, '', assignment.maxScore);
                        return;
                      }

                      const num = parseFloat(sanitized);
                      if (!isNaN(num)) {
                        if (num > assignment.maxScore) {
                          onScoreChange(st.id, assignment.id, String(assignment.maxScore), assignment.maxScore);
                        } else {
                          onScoreChange(st.id, assignment.id, sanitized, assignment.maxScore);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextInput = document.getElementById(`mobile-input-${assignment.id}-${sIndex + 1}`);
                        if (nextInput) nextInput.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevInput = document.getElementById(`mobile-input-${assignment.id}-${sIndex - 1}`);
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    className="w-16 h-10 text-center font-black text-base text-slate-900 bg-white border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500 rounded-xl shadow-2xs transition-all"
                  />
                  <span className="text-[11px] font-bold text-slate-600 shrink-0">
                    / {assignment.maxScore}
                  </span>
                </div>
              </div>

              {/* Quick Score Chips for One-Tap Input */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto custom-scrollbar-x pb-0.5">
                <span className="text-[10px] font-bold text-slate-600 shrink-0">กดด่วน:</span>
                {quickScores.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onScoreChange(st.id, assignment.id, chip.val, assignment.maxScore)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${
                      displayScore === chip.val && chip.val !== ''
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
