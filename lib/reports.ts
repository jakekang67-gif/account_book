/** 지출 집계용 최소 필드 */
export type ExpenseLike = {
  date: string;
  amount: number;
  category: string | null;
};

/** YYYY-MM */
export function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

/** 2026-11 → 2026년 11월 */
export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  return `${year}년 ${Number(month)}월`;
}

/** 월별 총액 (최신 월 위). 수입 분류는 제외 */
export function summarizeByMonth(expenses: ExpenseLike[]) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (!item.date || item.date.length < 7) continue;
    if (item.category === "수입") continue;
    const key = monthKeyFromDate(item.date);
    map.set(key, (map.get(key) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 특정 월의 대분류별 합계 (금액 큰 순). 수입 분류는 제외 */
export function summarizeByCategory(expenses: ExpenseLike[], monthKey: string) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (monthKeyFromDate(item.date) !== monthKey) continue;
    if (item.category === "수입") continue;
    const category = item.category?.trim() || "미분류";
    map.set(category, (map.get(category) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** 데이터가 있는 월 목록 (최신 순) */
export function listMonths(expenses: ExpenseLike[]) {
  return summarizeByMonth(expenses).map((row) => row.month);
}
