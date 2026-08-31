/**
 * ข้อมูลวันหยุดนักขัตฤกษ์และวันสำคัญของไทย
 */

export interface ThaiHoliday {
  day: number;
  month: number; // 1-12
  name: string;
  isOfficialHoliday: boolean;
}

// วันหยุดประจำปีแบบระบุวันที่ตายตัว
export const FIXED_THAI_HOLIDAYS: ThaiHoliday[] = [
  { day: 1, month: 1, name: 'วันขึ้นปีใหม่', isOfficialHoliday: true },
  { day: 2, month: 1, name: 'วันหยุดชดเชยวันขึ้นปีใหม่', isOfficialHoliday: true },
  { day: 16, month: 1, name: 'วันครูแห่งชาติ', isOfficialHoliday: false },
  { day: 6, month: 4, name: 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชและวันที่ระลึกมหาจักรีบรมราชวงศ์ (วันจักรี)', isOfficialHoliday: true },
  { day: 13, month: 4, name: 'วันสงกรานต์', isOfficialHoliday: true },
  { day: 14, month: 4, name: 'วันสงกรานต์ / วันครอบครัว', isOfficialHoliday: true },
  { day: 15, month: 4, name: 'วันสงกรานต์', isOfficialHoliday: true },
  { day: 16, month: 4, name: 'วันหยุดชดเชยวันสงกรานต์', isOfficialHoliday: true },
  { day: 1, month: 5, name: 'วันแรงงานแห่งชาติ', isOfficialHoliday: true },
  { day: 4, month: 5, name: 'วันฉัตรมงคล', isOfficialHoliday: true },
  { day: 3, month: 6, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', isOfficialHoliday: true },
  { day: 28, month: 7, name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว', isOfficialHoliday: true },
  { day: 12, month: 8, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ', isOfficialHoliday: true },
  { day: 13, month: 10, name: 'วันนวมินทรมหาราช (วันคล้ายวันสวรรคต ร.9)', isOfficialHoliday: true },
  { day: 23, month: 10, name: 'วันปิยมหาราช', isOfficialHoliday: true },
  { day: 5, month: 12, name: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันชาติ / วันพ่อแห่งชาติ', isOfficialHoliday: true },
  { day: 10, month: 12, name: 'วันรัฐธรรมนูญ', isOfficialHoliday: true },
  { day: 31, month: 12, name: 'วันสิ้นปี', isOfficialHoliday: true },
];

// วันหยุดตามจันทรคติ (ประมาณการสำหรับปี 2567-2569)
export const LUNAR_HOLIDAYS: Record<number, ThaiHoliday[]> = {
  2024: [
    { day: 24, month: 2, name: 'วันมาฆบูชา', isOfficialHoliday: true },
    { day: 26, month: 2, name: 'วันหยุดชดเชยวันมาฆบูชา', isOfficialHoliday: true },
    { day: 22, month: 5, name: 'วันวิสาขบูชา', isOfficialHoliday: true },
    { day: 20, month: 7, name: 'วันอาสาฬหบูชา', isOfficialHoliday: true },
    { day: 21, month: 7, name: 'วันเข้าพรรษา', isOfficialHoliday: true },
  ],
  2025: [
    { day: 12, month: 2, name: 'วันมาฆบูชา', isOfficialHoliday: true },
    { day: 11, month: 5, name: 'วันวิสาขบูชา', isOfficialHoliday: true },
    { day: 12, month: 5, name: 'วันหยุดชดเชยวันวิสาขบูชา', isOfficialHoliday: true },
    { day: 10, month: 7, name: 'วันอาสาฬหบูชา', isOfficialHoliday: true },
    { day: 11, month: 7, name: 'วันเข้าพรรษา', isOfficialHoliday: true },
  ],
  2026: [
    { day: 3, month: 3, name: 'วันมาฆบูชา', isOfficialHoliday: true },
    { day: 31, month: 5, name: 'วันวิสาขบูชา', isOfficialHoliday: true },
    { day: 1, month: 6, name: 'วันหยุดชดเชยวันวิสาขบูชา', isOfficialHoliday: true },
    { day: 29, month: 7, name: 'วันอาสาฬหบูชา', isOfficialHoliday: true },
    { day: 30, month: 7, name: 'วันเข้าพรรษา', isOfficialHoliday: true },
  ],
  2027: [
    { day: 21, month: 2, name: 'วันมาฆบูชา', isOfficialHoliday: true },
    { day: 20, month: 5, name: 'วันวิสาขบูชา', isOfficialHoliday: true },
    { day: 18, month: 7, name: 'วันอาสาฬหบูชา', isOfficialHoliday: true },
  ],
};

/**
 * ตรวจสอบว่าวันที่และเดือนที่ระบุเป็นวันหยุดนักขัตฤกษ์หรือไม่
 */
export function getThaiHoliday(year: number, month: number, day: number): ThaiHoliday | null {
  // ตรวจสอบวันหยุดคงที่
  const fixed = FIXED_THAI_HOLIDAYS.find((h) => h.month === month && h.day === day);
  if (fixed) return fixed;

  // ตรวจสอบวันหยุดจันทรคติ
  const lunarList = LUNAR_HOLIDAYS[year] || [];
  const lunar = lunarList.find((h) => h.month === month && h.day === day);
  if (lunar) return lunar;

  return null;
}

/**
 * ตรวจสอบว่าเป็นวันหยุดสุดสัปดาห์ (เสาร์ หรือ อาทิตย์) หรือไม่
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = อาทิตย์, 6 = เสาร์
}

/**
 * ตรวจสอบว่าวันที่สามารถเช็คชื่อได้หรือไม่ (ไม่เกินวันที่ปัจจุบัน)
 */
export function isDateInFuture(date: Date, referenceDate: Date = new Date()): boolean {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return target.getTime() > today.getTime();
}

/**
 * แปลงวันที่เป็นข้อความภาษาไทยแบบเต็ม
 */
export function formatThaiDateLong(date: Date): string {
  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const dayName = thaiDays[date.getDay()];
  const day = date.getDate();
  const monthName = thaiMonths[date.getMonth()];
  const thaiYear = date.getFullYear() + 543;

  return `${dayName}ที่ ${day} ${monthName} พ.ศ. ${thaiYear}`;
}

export function formatThaiDateShort(date: Date): string {
  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  return `${date.getDate()} ${thaiMonthsShort[date.getMonth()]} ${date.getFullYear() + 543}`;
}
