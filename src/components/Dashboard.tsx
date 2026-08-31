import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  School, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Table as TableIcon,
  Sparkles,
  ArrowUpRight,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { Student, StudentSubjectScore, Subject, ClassroomSummary } from '../types';
import { calculateClassStats, getGradeLabel } from '../utils/grading';

interface DashboardProps {
  students: Student[];
  subjects: Subject[];
  scores: StudentSubjectScore[];
  onSelectClassAndSubject?: (subjectId: string, classKey: string) => void;
}

const GRADE_COLORS: Record<string, string> = {
  'เกรด 4': '#10b981', // emerald-500
  'เกรด 3.5': '#059669', // emerald-600
  'เกรด 3': '#14b8a6', // teal-500
  'เกรด 2.5': '#0d9488', // teal-600
  'เกรด 2': '#f59e0b', // amber-500
  'เกรด 1.5': '#d97706', // amber-600
  'เกรด 1': '#94a3b8', // slate-400
  'เกรด 0': '#f43f5e', // rose-500
};

export const Dashboard: React.FC<DashboardProps> = ({
  students,
  subjects,
  scores,
  onSelectClassAndSubject,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('all');
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  // รายการระดับชั้นที่มีในระบบ
  const gradeLevels = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.gradeLevel));
    return Array.from(set).sort();
  }, [students]);

  // รายการห้องเรียนทั้งหมด
  const classKeys = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => set.add(s.classKey));
    return Array.from(set).sort();
  }, [students]);

  // ประมวลผลสถิติรายห้องเรียน
  const classroomSummaries: ClassroomSummary[] = useMemo(() => {
    return classKeys.map((cKey) => {
      const roomStudents = students.filter((s) => s.classKey === cKey);
      const studentIds = new Set(roomStudents.map((s) => s.id));

      // กรองคะแนนของห้องนี้
      let roomScores = scores.filter((sc) => studentIds.has(sc.studentId));
      if (selectedSubjectId !== 'all') {
        roomScores = roomScores.filter((sc) => sc.subjectId === selectedSubjectId);
      }

      const s1ScoresList = roomScores.map((sc) => sc.semester1?.totalSemesterScore || 0);
      const s2ScoresList = roomScores.map((sc) => sc.semester2?.totalSemesterScore || 0);
      const finalScoresList = roomScores.map((sc) => sc.finalCombined?.combinedAverageScore || 0);

      const s1Stats = calculateClassStats(s1ScoresList);
      const s2Stats = calculateClassStats(s2ScoresList);
      const finalStats = calculateClassStats(finalScoresList);

      // นับจำนวนเกรดแต่ละช่วง (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)
      const gradeDistribution: Record<number, number> = {
        4: 0, 3.5: 0, 3: 0, 2.5: 0, 2: 0, 1.5: 0, 1: 0, 0: 0
      };

      let passedCount = 0;
      let highGradeCount = 0;

      roomScores.forEach((sc) => {
        const g = sc.finalCombined?.finalGrade ?? 0;
        gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
        if (g >= 1) passedCount++;
        if (g >= 3) highGradeCount++;
      });

      const totalRecorded = roomScores.length || 1;
      const passRate = Number(((passedCount / totalRecorded) * 100).toFixed(1));
      const highGradeRate = Number(((highGradeCount / totalRecorded) * 100).toFixed(1));

      const [lvl, rm] = cKey.split('/');

      return {
        classKey: cKey,
        gradeLevel: lvl || '',
        roomNumber: rm || '',
        studentCount: roomStudents.length,
        semester1Avg: s1Stats.mean,
        semester2Avg: s2Stats.mean,
        finalAvg: finalStats.mean,
        minScore: finalStats.min,
        maxScore: finalStats.max,
        standardDeviation: finalStats.sd,
        gradeDistribution,
        passRate,
        highGradeRate,
      };
    }).filter((summary) => {
      if (selectedGradeLevel !== 'all' && summary.gradeLevel !== selectedGradeLevel) {
        return false;
      }
      if (searchTableQuery.trim()) {
        const q = searchTableQuery.toLowerCase();
        return summary.classKey.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, classKeys, scores, selectedSubjectId, selectedGradeLevel, searchTableQuery]);

  // คำนวณสรุปรวมภาพรวมทั้งโรงเรียน
  const overallMetrics = useMemo(() => {
    const totalStudents = students.length;
    const totalClasses = classKeys.length;
    
    // กรองคะแนนตามเงื่อนไข
    let filteredScores = scores;
    if (selectedSubjectId !== 'all') {
      filteredScores = filteredScores.filter((sc) => sc.subjectId === selectedSubjectId);
    }
    if (selectedGradeLevel !== 'all') {
      const validStudentIds = new Set(
        students.filter((s) => s.gradeLevel === selectedGradeLevel).map((s) => s.id)
      );
      filteredScores = filteredScores.filter((sc) => validStudentIds.has(sc.studentId));
    }

    const s1List = filteredScores.map((s) => s.semester1?.totalSemesterScore || 0);
    const s2List = filteredScores.map((s) => s.semester2?.totalSemesterScore || 0);
    const finalList = filteredScores.map((s) => s.finalCombined?.combinedAverageScore || 0);
    const gradeList = filteredScores.map((s) => s.finalCombined?.finalGrade || 0);

    const s1Avg = s1List.length ? Number((s1List.reduce((a, b) => a + b, 0) / s1List.length).toFixed(2)) : 0;
    const s2Avg = s2List.length ? Number((s2List.reduce((a, b) => a + b, 0) / s2List.length).toFixed(2)) : 0;
    const overallFinalAvg = finalList.length ? Number((finalList.reduce((a, b) => a + b, 0) / finalList.length).toFixed(2)) : 0;
    const overallGpa = gradeList.length ? Number((gradeList.reduce((a, b) => a + b, 0) / gradeList.length).toFixed(2)) : 0;

    let passCount = 0;
    let grade4Count = 0;
    const totalGradeCounts: Record<string, number> = {
      'เกรด 4': 0,
      'เกรด 3.5': 0,
      'เกรด 3': 0,
      'เกรด 2.5': 0,
      'เกรด 2': 0,
      'เกรด 1.5': 0,
      'เกรด 1': 0,
      'เกรด 0': 0,
    };

    filteredScores.forEach((sc) => {
      const g = sc.finalCombined?.finalGrade ?? 0;
      if (g >= 1) passCount++;
      if (g === 4) grade4Count++;

      const key = `เกรด ${g}`;
      if (totalGradeCounts[key] !== undefined) {
        totalGradeCounts[key]++;
      }
    });

    const totalEvals = filteredScores.length || 1;
    const overallPassRate = Number(((passCount / totalEvals) * 100).toFixed(1));
    const grade4Rate = Number(((grade4Count / totalEvals) * 100).toFixed(1));

    const pieData = Object.entries(totalGradeCounts).map(([name, value]) => ({
      name,
      value,
    })).filter(d => d.value > 0);

    return {
      totalStudents,
      totalClasses,
      s1Avg,
      s2Avg,
      overallFinalAvg,
      overallGpa,
      overallPassRate,
      grade4Rate,
      pieData,
    };
  }, [students, classKeys, scores, selectedSubjectId, selectedGradeLevel]);

  // ข้อมูลสำหรับกราฟแท่งเปรียบเทียบคะแนนเฉลี่ยรายห้อง
  const chartData = useMemo(() => {
    return classroomSummaries.map((c) => ({
      name: c.classKey,
      'ภาคเรียนที่ 1 (เฉลี่ย)': c.semester1Avg,
      'ภาคเรียนที่ 2 (เฉลี่ย)': c.semester2Avg,
      'คะแนนรวมเฉลี่ย 2 ภาคเรียน': c.finalAvg,
    }));
  }, [classroomSummaries]);

  return (
    <div className="space-y-6">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span>ภาพรวมผลสัมฤทธิ์และสถิติรายห้องเรียน</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เปรียบเทียบผลคะแนนเฉลี่ย ภาคเรียนที่ 1, ภาคเรียนที่ 2 และคะแนนรวม 2 ภาคเรียน
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            
            <select
              id="filter-subject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-xs bg-transparent border-0 font-medium text-slate-700 focus:ring-0 cursor-pointer pr-3 py-1"
            >
              <option value="all">ทุกรายวิชา ({subjects.length} วิชา)</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name} ({sub.gradeLevel})
                </option>
              ))}
            </select>

            <div className="h-4 w-px bg-slate-200" />

            <select
              id="filter-grade-level"
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value)}
              className="text-xs bg-transparent border-0 font-medium text-slate-700 focus:ring-0 cursor-pointer pr-3 py-1"
            >
              <option value="all">ทุกระดับชั้น</option>
              {gradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  ระดับ {lvl}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* KPI 1: Average GPA / Overall Average Score */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              เกรดเฉลี่ยรวม (GPA)
            </p>
            <p className="text-3xl font-black text-emerald-500 mt-1 tracking-tight">
              {overallMetrics.overallGpa > 0 ? overallMetrics.overallGpa.toFixed(2) : (overallMetrics.overallFinalAvg / 25).toFixed(2)}
            </p>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-500 rounded-full" 
                style={{ width: `${Math.min(100, (overallMetrics.overallFinalAvg || 75))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              คะแนนเฉลี่ยรวม: <strong className="text-slate-700">{overallMetrics.overallFinalAvg}</strong> / 100 คะแนน
            </p>
          </div>
        </div>

        {/* KPI 2: Students Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              จำนวนนักเรียนทั้งหมด
            </p>
            <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">
              {overallMetrics.totalStudents} <span className="text-base font-semibold text-slate-400">คน</span>
            </p>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-400">
              ครอบคลุมทั้งหมด <strong className="text-slate-700">{classroomSummaries.length}</strong> ห้องเรียน
            </p>
          </div>
        </div>

        {/* KPI 3: Passing Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              อัตราการผ่านเกณฑ์
            </p>
            <p className="text-3xl font-black text-amber-500 mt-1 tracking-tight">
              {overallMetrics.overallPassRate}%
            </p>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-400 transition-all duration-500 rounded-full" 
                style={{ width: `${overallMetrics.overallPassRate}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              เกรดตั้งแต่ 1.0 ขึ้นไป (ผ่านเกณฑ์ประเมิน)
            </p>
          </div>
        </div>

        {/* KPI 4: Excellence Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              เกรด 4.0 (ผลการเรียนดีเยี่ยม)
            </p>
            <p className="text-3xl font-black text-emerald-500 mt-1 tracking-tight">
              {overallMetrics.grade4Rate}%
            </p>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-400">
              คะแนนช่วง 80 - 100 (เกรด 4 ดีเยี่ยม)
            </p>
          </div>
        </div>

      </div>

      {/* Charts Row: Bar Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                แผนภูมิเปรียบเทียบคะแนนเฉลี่ยรายห้องเรียน
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                คะแนนเฉลี่ย ภาคเรียนที่ 1, ภาคเรียนที่ 2 และ คะแนนรวมเฉลี่ย 2 ภาคเรียน (สัดส่วน 70/30)
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'sans-serif' }} 
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'sans-serif' }} 
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${value} คะแนน`, '']}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
                <Bar dataKey="ภาคเรียนที่ 1 (เฉลี่ย)" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="ภาคเรียนที่ 2 (เฉลี่ย)" fill="#2dd4bf" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="คะแนนรวมเฉลี่ย 2 ภาคเรียน" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grade Distribution Donut */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              สัดส่วนการกระจายตัวของเกรด
            </h3>
            <p className="text-xs text-slate-400">
              สัดส่วนการกระจายตัวของเกรดตัดสิน (ระดับ 0 - 4)
            </p>
          </div>

          <div className="h-52 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overallMetrics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {overallMetrics.pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={GRADE_COLORS[entry.name] || '#10b981'} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [`${val} คน`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            {overallMetrics.pieData.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: GRADE_COLORS[item.name] || '#10b981' }} 
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800 ml-1">{item.value} คน</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Classroom Summary Statistics Table */}
      <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
        
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <h3 className="font-bold text-slate-800 px-1">
            ตารางสรุปผลสัมฤทธิ์ทางการเรียนรายห้อง
          </h3>

          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="ค้นหาห้องเรียน..." 
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              className="text-xs border border-slate-200 px-3 py-1.5 rounded-md w-44 sm:w-48 bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none" 
            />
            <span className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600">
              {classroomSummaries.length} ห้องเรียน
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                <th className="px-6 py-3.5">ห้องเรียน</th>
                <th className="px-4 py-3.5">จำนวนนักเรียน</th>
                <th className="px-4 py-3.5">ภาคเรียนที่ 1</th>
                <th className="px-4 py-3.5">ภาคเรียนที่ 2</th>
                <th className="px-4 py-3.5 text-center">คะแนนเฉลี่ย 2 เทอม</th>
                <th className="px-4 py-3.5 text-center">อัตราการผ่าน</th>
                <th className="px-4 py-3.5 text-center">เกรด 3 ขึ้นไป</th>
                <th className="px-6 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {classroomSummaries.map((summary) => (
                <tr 
                  key={summary.classKey}
                  className="hover:bg-emerald-50/30 transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-slate-800">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs">
                      <School className="w-3.5 h-3.5 text-emerald-600" />
                      ห้อง {summary.classKey}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-600 font-medium">
                    {summary.studentCount} คน
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden inline-block">
                        <div 
                          className="bg-emerald-400 h-full rounded-full" 
                          style={{ width: `${Math.min(100, summary.semester1Avg)}%` }} 
                        />
                      </span>
                      <span className="font-mono text-xs text-slate-700">{summary.semester1Avg.toFixed(1)}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden inline-block">
                        <div 
                          className="bg-teal-400 h-full rounded-full" 
                          style={{ width: `${Math.min(100, summary.semester2Avg)}%` }} 
                        />
                      </span>
                      <span className="font-mono text-xs text-slate-700">{summary.semester2Avg.toFixed(1)}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs">
                      {summary.finalAvg.toFixed(1)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs ${
                      summary.passRate >= 90 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : summary.passRate >= 70
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {summary.passRate}%
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center font-semibold text-slate-700 text-xs">
                    {summary.highGradeRate}%
                  </td>

                  <td className="px-6 py-4 text-right">
                    {onSelectClassAndSubject && (
                      <button
                        onClick={() => {
                          const targetSubId = selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || '');
                          onSelectClassAndSubject(targetSubId, summary.classKey);
                        }}
                        className="text-slate-600 hover:text-slate-900 text-xs font-bold bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>ดูคะแนน / บันทึกผล</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400 font-medium">
          <p>แสดงสรุปผลการเรียน {classroomSummaries.length} ห้องเรียน ประจำปีการศึกษา 2568</p>
          <div className="flex gap-1">
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-semibold">หน้า 1</span>
          </div>
        </div>

      </div>

    </div>
  );
};
