/** 지출 집계용 최소 필드 */
export type ExpenseLike = {
  date: string;
  amount: number;
  category: string | null;
  subcategory?: string | null;
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

function formatWon(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
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

/** 특정 월·대분류의 소분류별 합계 (금액 큰 순) */
export function summarizeBySubcategory(
  expenses: ExpenseLike[],
  monthKey: string,
  category: string,
) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (monthKeyFromDate(item.date) !== monthKey) continue;
    if (item.category === "수입") continue;
    const cat = item.category?.trim() || "미분류";
    if (cat !== category) continue;
    const sub = item.subcategory?.trim() || "미분류";
    map.set(sub, (map.get(sub) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([subcategory, total]) => ({ subcategory, total }))
    .sort((a, b) => b.total - a.total);
}

/** 데이터가 있는 월 목록 (최신 순) */
export function listMonths(expenses: ExpenseLike[]) {
  return summarizeByMonth(expenses).map((row) => row.month);
}

/** 질문 문구에서 조회 월(YYYY-MM) 추정 */
export function resolveStatsMonthKey(text: string, currentMonth: string) {
  const t = text.replace(/\s+/g, "");
  const ym = t.match(/(20\d{2})년(\d{1,2})월/);
  if (ym) {
    return `${ym[1]}-${String(Number(ym[2])).padStart(2, "0")}`;
  }
  const mOnly = t.match(/(\d{1,2})월/);
  if (mOnly && currentMonth.length >= 7) {
    const year = currentMonth.slice(0, 4);
    return `${year}-${String(Number(mOnly[1])).padStart(2, "0")}`;
  }
  if (/저번\s*달|지난\s*달|전달/.test(text)) {
    const [y, m] = currentMonth.split("-").map(Number);
    if (!y || !m) return currentMonth;
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return currentMonth;
}

/** 질문에서 대분류 이름 매칭 */
export function matchCategoryFromText(
  text: string,
  categories: string[],
): string | null {
  const t = text.replace(/\s+/g, "");
  const sorted = [...categories].sort((a, b) => b.length - a.length);
  for (const cat of sorted) {
    if (cat === "수입") continue;
    if (t.includes(cat.replace(/\s+/g, ""))) return cat;
  }
  return null;
}

/**
 * 분류 탭과 동일한 집계로 통계 답변 생성.
 * 형식:
 * 대분류 : 금액
 *  - 소분류 : 금액
 */
export function formatStatsBreakdownReply(
  expenses: ExpenseLike[],
  monthKey: string,
  filterCategory?: string | null,
  filterSubcategory?: string | null,
) {
  const monthLabel = formatMonthLabel(monthKey);

  if (filterCategory && filterSubcategory) {
    const subs = summarizeBySubcategory(
      expenses,
      monthKey,
      filterCategory,
    ).filter((row) => row.subcategory === filterSubcategory);
    if (subs.length === 0) {
      return `${monthLabel} 「${filterCategory}_${filterSubcategory}」 기록이 아직 없어요.`;
    }
    const total = subs.reduce((s, r) => s + r.total, 0);
    return `${monthLabel}\n${filterCategory} : ${formatWon(total)}\n - ${filterSubcategory} : ${formatWon(total)}`;
  }

  const categories = filterCategory
    ? summarizeByCategory(expenses, monthKey).filter(
        (row) => row.category === filterCategory,
      )
    : summarizeByCategory(expenses, monthKey);

  if (categories.length === 0) {
    return filterCategory
      ? `${monthLabel} 「${filterCategory}」 기록이 아직 없어요.`
      : `${monthLabel} 지출 기록이 아직 없어요.`;
  }

  const lines: string[] = [];
  let grand = 0;
  for (const row of categories) {
    grand += row.total;
    lines.push(`${row.category} : ${formatWon(row.total)}`);
    const subs = summarizeBySubcategory(expenses, monthKey, row.category);
    for (const sub of subs) {
      lines.push(` - ${sub.subcategory} : ${formatWon(sub.total)}`);
    }
  }

  if (!filterCategory && categories.length > 1) {
    lines.push(`합계 : ${formatWon(grand)}`);
  }

  return `${monthLabel}\n${lines.join("\n")}`;
}
