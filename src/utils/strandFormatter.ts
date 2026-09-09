/**
 * ยูทิลิตี้จัดการและจัดรูปแบบสาระการเรียนรู้
 * ตัดคำว่า "สาระที่" หรือ "สาระ" ออก เช่น "สาระที่ 1. วิทยาศาสตร์ชีวภาพ" -> "1. วิทยาศาสตร์ชีวภาพ"
 */
export function formatStrandDisplay(strand?: string): string {
  if (!strand) return '-';
  const trimmed = strand.trim();
  const cleaned = trimmed
    .replace(/^สาระที่\s*/gi, '')
    .replace(/^สาระ\s*/gi, '')
    .trim();
  return cleaned || '-';
}

export function cleanStrandInput(strand?: string): string {
  if (!strand) return '';
  return strand
    .trim()
    .replace(/^สาระที่\s*/gi, '')
    .replace(/^สาระ\s*/gi, '')
    .trim();
}
