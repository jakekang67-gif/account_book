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

/** 수입 대분류 (지출 합계·차트에서 제외) */
export function isIncomeCategory(category: string | null | undefined) {
  const c = category?.trim() ?? "";
  return c === "수입" || c === "고정 수입";
}

/** 월별 총액 (최신 월 위). 수입 분류는 제외 */
export function summarizeByMonth(expenses: ExpenseLike[]) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (!item.date || item.date.length < 7) continue;
    if (isIncomeCategory(item.category)) continue;
    const key = monthKeyFromDate(item.date);
    map.set(key, (map.get(key) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 월별 수입 총액 (수입·고정 수입만, 최신 월 위) */
export function summarizeIncomeByMonth(expenses: ExpenseLike[]) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (!item.date || item.date.length < 7) continue;
    if (!isIncomeCategory(item.category)) continue;
    const key = monthKeyFromDate(item.date);
    map.set(key, (map.get(key) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 특정 월 수입 합계 */
export function sumIncomeForMonth(expenses: ExpenseLike[], monthKey: string) {
  let total = 0;
  for (const item of expenses) {
    if (monthKeyFromDate(item.date) !== monthKey) continue;
    if (!isIncomeCategory(item.category)) continue;
    total += item.amount;
  }
  return total;
}

/** 전체 수입 합계 */
export function sumIncomeAll(expenses: ExpenseLike[]) {
  let total = 0;
  for (const item of expenses) {
    if (!isIncomeCategory(item.category)) continue;
    total += item.amount;
  }
  return total;
}

/** 특정 월의 대분류별 합계 (금액 큰 순). 수입 분류는 제외 */
export function summarizeByCategory(expenses: ExpenseLike[], monthKey: string) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (monthKeyFromDate(item.date) !== monthKey) continue;
    if (isIncomeCategory(item.category)) continue;
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
    if (isIncomeCategory(item.category)) continue;
    const cat = item.category?.trim() || "미분류";
    if (cat !== category) continue;
    const sub = item.subcategory?.trim() || "미분류";
    map.set(sub, (map.get(sub) ?? 0) + item.amount);
  }
  return [...map.entries()]
    .map(([subcategory, total]) => ({ subcategory, total }))
    .sort((a, b) => b.total - a.total);
}

/** 내역이 있는 달 기준 월 평균 지출 */
export function averageMonthlyExpense(expenses: ExpenseLike[]) {
  const months = summarizeByMonth(expenses);
  if (months.length === 0) return { average: 0, monthCount: 0, months };
  const sum = months.reduce((s, row) => s + row.total, 0);
  return {
    average: Math.round(sum / months.length),
    monthCount: months.length,
    months,
  };
}

/**
 * 대분류별 월 평균 = (해당 대분류 전체 합계) ÷ (내역 있는 달 수)
 * 수입 분류는 제외. 금액 큰 순.
 */
export function averageMonthlyByCategory(expenses: ExpenseLike[]) {
  const months = summarizeByMonth(expenses);
  const monthCount = months.length;
  if (monthCount === 0) return { monthCount: 0, categories: [] as Array<{ category: string; average: number }> };

  const totals = new Map<string, number>();
  for (const item of expenses) {
    if (!item.date || item.date.length < 7) continue;
    if (isIncomeCategory(item.category)) continue;
    const category = item.category?.trim() || "미분류";
    totals.set(category, (totals.get(category) ?? 0) + item.amount);
  }

  const categories = [...totals.entries()]
    .map(([category, total]) => ({
      category,
      average: Math.round(total / monthCount),
    }))
    .sort((a, b) => b.average - a.average);

  return { monthCount, categories };
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
    if (isIncomeCategory(cat)) continue;
    if (t.includes(cat.replace(/\s+/g, ""))) return cat;
  }
  return null;
}

/**
 * 분류 탭과 동일한 집계로 통계 답변 생성.
 * - 대분류만: 대분류 총액 + 소분류 목록
 * - 소분류까지: 해당 소분류 금액만
 */
export function formatStatsBreakdownReply(
  expenses: ExpenseLike[],
  monthKey: string,
  filterCategory?: string | null,
  filterSubcategory?: string | null,
) {
  const monthLabel = formatMonthLabel(monthKey);

  // 소분류 질문 → 해당 소분류만
  if (filterCategory && filterSubcategory) {
    const hit = summarizeBySubcategory(
      expenses,
      monthKey,
      filterCategory,
    ).find((row) => row.subcategory === filterSubcategory);
    if (!hit) {
      return `${monthLabel} 「${filterCategory}_${filterSubcategory}」 기록이 아직 없어요.`;
    }
    return `${monthLabel}\n${filterCategory}_${filterSubcategory} : ${formatWon(hit.total)}`;
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
