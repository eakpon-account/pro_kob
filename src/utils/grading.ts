import { Assignment, AssignmentCategory, SemesterScoreData } from '../types';

/**
 * ตัดเกรดตามเกณฑ์มาตรฐาน 8 ระดับ (0, 1, 1.5, 2, 2.5, 3, 3.5, 4):
 * 80 - 100 = 4   (ดีเยี่ยม)
 * 75 - 79  = 3.5 (ดีมาก)
 * 70 - 74  = 3   (ดี)
 * 65 - 69  = 2.5 (ค่อนข้างดี)
 * 60 - 64  = 2   (ปานกลาง)
 * 55 - 59  = 1.5 (พอใช้)
 * 50 - 54  = 1   (ผ่านเกณฑ์ขั้นต่ำ)
 * 0 - 49   = 0   (ไม่ผ่าน / ต้องสอบซ่อม)
 */
export function calculateGrade(score: number): number {
  const rounded = Math.round(score * 100) / 100;
  if (rounded >= 80) return 4;
  if (rounded >= 75) return 3.5;
  if (rounded >= 70) return 3;
  if (rounded >= 65) return 2.5;
  if (rounded >= 60) return 2;
  if (rounded >= 55) return 1.5;
  if (rounded >= 50) return 1;
  return 0;
}

export function getGradeLabel(grade: number): { label: string; textClass: string; bgClass: string; borderClass: string } {
  switch (grade) {
    case 4:
      return {
        label: 'เกรด 4 (ดีเยี่ยม)',
        textClass: 'text-emerald-800',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
      };
    case 3.5:
      return {
        label: 'เกรด 3.5 (ดีมาก)',
        textClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50/90',
        borderClass: 'border-emerald-200',
      };
    case 3:
      return {
        label: 'เกรด 3 (ดี)',
        textClass: 'text-teal-800',
        bgClass: 'bg-teal-50',
        borderClass: 'border-teal-200',
      };
    case 2.5:
      return {
        label: 'เกรด 2.5 (ค่อนข้างดี)',
        textClass: 'text-sky-800',
        bgClass: 'bg-sky-50',
        borderClass: 'border-sky-200',
      };
    case 2:
      return {
        label: 'เกรด 2 (ปานกลาง)',
        textClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
      };
    case 1.5:
      return {
        label: 'เกรด 1.5 (พอใช้)',
        textClass: 'text-orange-800',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-200',
      };
    case 1:
      return {
        label: 'เกรด 1 (ผ่านเกณฑ์)',
        textClass: 'text-stone-700',
        bgClass: 'bg-stone-100',
        borderClass: 'border-stone-200',
      };
    default:
      return {
        label: 'เกรด 0 (ไม่ผ่าน)',
        textClass: 'text-rose-700',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-200',
      };
  }
}

/**
 * ข้อมูลและป้ายกำกับประเภทคะแนน / ชิ้นงาน
 */
export function getCategoryInfo(category: AssignmentCategory): { label: string; bgClass: string; textClass: string; borderClass: string } {
  switch (category) {
    case 'worksheet':
      return { label: 'ใบงาน', bgClass: 'bg-emerald-50', textClass: 'text-emerald-700', borderClass: 'border-emerald-200' };
    case 'exercise':
      return { label: 'แบบฝึกหัด', bgClass: 'bg-teal-50', textClass: 'text-teal-700', borderClass: 'border-teal-200' };
    case 'project':
      return { label: 'โครงงาน', bgClass: 'bg-indigo-50', textClass: 'text-indigo-700', borderClass: 'border-indigo-200' };
    case 'report':
      return { label: 'รายงาน', bgClass: 'bg-purple-50', textClass: 'text-purple-700', borderClass: 'border-purple-200' };
    case 'homework_book':
      return { label: 'สมุดการบ้าน', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200' };
    case 'test':
      return { label: 'แบบทดสอบ', bgClass: 'bg-rose-50', textClass: 'text-rose-700', borderClass: 'border-rose-200' };
    case 'custom':
    default:
      return { label: 'กำหนดเอง', bgClass: 'bg-slate-100', textClass: 'text-slate-700', borderClass: 'border-slate-300' };
  }
}

/**
 * ตัวย่อของช่องคะแนน/ใบงาน:
 * - แบบทดสอบ (category: test) -> ใช้ตัวย่อ 'ท' (หรือ 'ท1', 'ท2'... หากมีหลายชุด)
 * - ใบงาน/แบบฝึกหัด/งานอื่นๆ -> ใช้ตัวเลข 1, 2, 3, 4, 5... ตามลำดับ
 */
export function getAssignmentAbbreviation(
  assignment: Assignment,
  allSemesterAssignments: Assignment[]
): string {
  if (assignment.category === 'test') {
    const testList = allSemesterAssignments.filter((a) => a.category === 'test');
    if (testList.length <= 1) {
      return 'ท';
    }
    const testIdx = testList.findIndex((a) => a.id === assignment.id) + 1;
    return `ท${testIdx > 0 ? testIdx : 1}`;
  }

  const nonTestList = allSemesterAssignments.filter((a) => a.category !== 'test');
  const idx = nonTestList.findIndex((a) => a.id === assignment.id) + 1;
  return `${idx > 0 ? idx : 1}`;
}

/**
 * จัดรูปแบบมาตรฐานและตัวชี้วัด โดยรองรับทั้งระบบใหม่ (สาระที่, มาตรฐาน, ตัวชี้วัด)
 * และระบบเดิม (indicator, gradeLevel, indicatorNo)
 */
export function getFormattedStandardText(assignment: {
  strand?: string;
  standard?: string;
  indicator?: string;
  gradeLevel?: string;
  indicatorNo?: string;
  topic?: string;
}): string {
  const std = assignment.standard?.trim() || '';
  const ind = assignment.indicator?.trim() || '';
  const grade = assignment.gradeLevel?.trim() || '';
  const no = assignment.indicatorNo?.trim() || '';
  const topic = assignment.topic?.trim() || '';

  // รูปแบบใหม่ที่มี standard และ indicator
  if (std && ind) {
    if (ind.includes(std)) {
      return ind;
    }
    return `${std} ${ind}`;
  }

  if (std) {
    return std;
  }

  // ถ้ามีเฉพาะ indicator
  if (ind) {
    if (ind.includes('/')) {
      return ind;
    }

    let itemNumber = no;
    if (!itemNumber && /^\d+$/.test(topic)) {
      itemNumber = topic;
    }

    if (grade && itemNumber) {
      if (itemNumber.includes('/') || itemNumber.startsWith(grade)) {
        return `${ind} ${itemNumber}`;
      }
      return `${ind} ${grade}/${itemNumber}`;
    }

    if (grade) {
      return `${ind} ${grade}`;
    }

    if (itemNumber) {
      return `${ind}/${itemNumber}`;
    }

    return ind;
  }

  // รูปแบบเดิม (legacy)
  if (grade && no) {
    return `${grade}/${no}`;
  }

  return '';
}

/**
 * ดึงชื่อเรื่องที่แท้จริง (ถ้า topic เป็นเพียงตัวเลขตัวชี้วัดที่ถูกนำไปรวมแล้ว จะไม่แสดงซ้ำ)
 */
export function getDisplayTopic(assignment: {
  topic?: string;
  indicatorNo?: string;
}): string {
  const topic = assignment.topic?.trim() || '';
  if (!topic) return '';
  // ถ้าไม่มี indicatorNo และ topic เป็นตัวเลขล้วน แสดงว่าถูกนำไปรวมเป็นเลขตัวชี้วัดแล้ว
  if (/^\d+$/.test(topic) && !assignment.indicatorNo?.trim()) {
    return '';
  }
  return topic;
}

/**
 * ตัดข้อความ "สาระที่" หรือ "สาระ" ออกจากค่าสาระ เช่น:
 * "สาระที่ 1. วิทยาศาสตร์ชีวภาพ" -> "1. วิทยาศาสตร์ชีวภาพ"
 * "สาระที่ 1" -> "1"
 * "สาระที่: 1" -> "1"
 */
export function formatStrandDisplay(strand?: string): string {
  if (!strand) return '';
  return strand
    .replace(/^สาระที่\s*[:\.]?\s*/i, '')
    .replace(/^สาระ\s*[:\.]?\s*/i, '')
    .trim();
}

/**
 * ข้อความสรุปข้อมูลใบงานท้ายตาราง เช่น "1.ใบงานที่ 1 'สาระที่ : 1' 'มาตรฐาน : ว 1.1' 'ตัวชี้วัด : ป.1/1' ,'ประเภท : ใบงาน' ,'เรื่อง : พืช' ,'คะแนนเต็ม : 10 คะแนน'"
 */
export function getAssignmentSummaryText(
  assignment: Assignment,
  allSemesterAssignments: Assignment[]
): string {
  const abbr = getAssignmentAbbreviation(assignment, allSemesterAssignments);
  const catInfo = getCategoryInfo(assignment.category);
  const strandValue = formatStrandDisplay(assignment.strand);
  const strandStr = strandValue ? ` ,"สาระ : ${strandValue}"` : '';
  
  let stdStr = '';
  let indStr = '';
  if (assignment.standard?.trim()) {
    stdStr = ` ,"มาตราฐาน : ${assignment.standard.trim()}"`;
    if (assignment.indicator?.trim()) {
      indStr = ` ,"ตัวชี้วัด : ${assignment.indicator.trim()}"`;
    }
  } else {
    const formatted = getFormattedStandardText(assignment);
    if (formatted) {
      stdStr = ` ,"มาตราฐาน : ${formatted}"`;
    } else if (assignment.indicator?.trim()) {
      indStr = ` ,"ตัวชี้วัด : ${assignment.indicator.trim()}"`;
    }
  }

  const topic = getDisplayTopic(assignment);
  const topicStr = topic ? ` ,"เรื่อง : ${topic}"` : '';
  const catStr = ` ,"ประเภท : ${catInfo.label}"`;
  const scoreStr = ` ,"คะแนนเต็ม : ${assignment.maxScore} คะแนน"`;
  return `${abbr}.${assignment.name}${strandStr}${stdStr}${indStr}${topicStr}${catStr}${scoreStr}`;
}

/**
 * คำนวณคะแนนภาคเรียน 1 หรือ 2
 * สูตร: (คะแนนรวมที่ได้ ÷ คะแนนเต็มรวมทั้งหมด) × targetScore (คะแนนเก็บทั้งหมด เช่น 100 หรือตามที่กำหนด)
 * ตัวอย่าง: คะแนนเต็มรวมทั้งหมดคือ 150 คะแนน คุณทำคะแนนรวมได้ 120 คะแนน กำหนดคะแนนเก็บทั้งหมดคือ 100
 *           เข้าสูตร: (120 ÷ 150) × 100 = 80
 * และตัดเกรดเป็น 8 ระดับ 0, 1, 1.5, 2, 2.5, 3, 3.5, 4 (จากร้อยละ)
 */
export function computeSemesterScore(
  assignmentScores: Record<string, number>,
  assignments: Assignment[],
  targetScore: number = 100
): SemesterScoreData {
  let totalRawAssignments = 0;
  let maxRawAssignments = 0;

  assignments.forEach((asg) => {
    maxRawAssignments += asg.maxScore;
    const score = assignmentScores[asg.id];
    if (typeof score === 'number' && !isNaN(score)) {
      totalRawAssignments += Math.max(0, Math.min(score, asg.maxScore));
    }
  });

  const validTarget = targetScore > 0 ? targetScore : 100;

  // เข้าสูตรคำนวณ: (คะแนนรวมที่ได้ ÷ คะแนนเต็มรวมทั้งหมด) × validTarget
  let totalSemesterScore = 0;
  let percentage = 0;
  if (maxRawAssignments > 0) {
    totalSemesterScore = Number(((totalRawAssignments / maxRawAssignments) * validTarget).toFixed(2));
    totalSemesterScore = Math.max(0, Math.min(validTarget, totalSemesterScore));
    percentage = (totalSemesterScore / validTarget) * 100;
  }

  // ตัดเกรดเป็น 8 ระดับ (0 - 4) จากร้อยละเทียบเต็ม 100
  const grade = calculateGrade(percentage);

  return {
    assignmentScores: { ...assignmentScores },
    totalRawAssignments: Number(totalRawAssignments.toFixed(2)),
    maxRawAssignments,
    calculatedCoursework: totalSemesterScore,
    totalSemesterScore,
    grade,
  };
}

/**
 * รวมคะแนน 2 ภาคเรียนแล้วหาร 2 และตัดเกรด 8 ระดับ (0 - 4)
 */
export function computeFinalCombinedScore(
  semester1Total: number,
  semester2Total: number,
  targetScore1: number = 100,
  targetScore2: number = 100
): {
  s1Total: number;
  s2Total: number;
  combinedAverageScore: number;
  finalGrade: number;
  passed: boolean;
  remark?: string;
} {
  const t1 = targetScore1 > 0 ? targetScore1 : 100;
  const t2 = targetScore2 > 0 ? targetScore2 : 100;

  const s1 = Number(Math.max(0, Math.min(t1, semester1Total || 0)).toFixed(2));
  const s2 = Number(Math.max(0, Math.min(t2, semester2Total || 0)).toFixed(2));
  
  // รวม 2 ภาคเรียนแล้วหาร 2
  const combinedAverageScore = Number(((s1 + s2) / 2).toFixed(2));
  const combinedTarget = (t1 + t2) / 2;
  const percentage = combinedTarget > 0 ? (combinedAverageScore / combinedTarget) * 100 : 0;
  const finalGrade = calculateGrade(percentage);
  const passed = finalGrade >= 1;

  let remark = '';
  if (finalGrade === 4) remark = 'ผลการเรียนระดับดีเยี่ยม';
  else if (finalGrade === 3.5) remark = 'ผลการเรียนระดับดีมาก';
  else if (finalGrade === 3) remark = 'ผลการเรียนระดับดี';
  else if (finalGrade === 2.5) remark = 'ผลการเรียนระดับค่อนข้างดี';
  else if (finalGrade === 2) remark = 'ผลการเรียนระดับปานกลาง';
  else if (finalGrade === 1.5) remark = 'ผลการเรียนระดับพอใช้';
  else if (finalGrade === 1) remark = 'ผลการเรียนผ่านเกณฑ์ขั้นต่ำ';
  else remark = 'ผลการเรียนไม่ผ่านเกณฑ์ (ต้องสอบซ่อม)';

  return {
    s1Total: s1,
    s2Total: s2,
    combinedAverageScore,
    finalGrade,
    passed,
    remark,
  };
}

/**
 * คำนวณค่าสถิติห้องเรียน: Mean, Min, Max, SD, Grade distribution
 */
export function calculateClassStats(scores: number[]) {
  if (scores.length === 0) {
    return { mean: 0, min: 0, max: 0, sd: 0 };
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = Number((sum / scores.length).toFixed(2));

  // Standard Deviation
  const squareDiffs = scores.map((val) => Math.pow(val - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / (scores.length > 1 ? scores.length - 1 : 1);
  const sd = Number(Math.sqrt(avgSquareDiff).toFixed(2));

  return { mean, min, max, sd };
}
