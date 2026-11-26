import {
  isRecurringExpenseDescription,
  koreaRecurringReflectDate,
  koreaToday,
} from "@/lib/date";
import { normalizeExpenseDescription } from "@/lib/expenseDescription";
import { isIncomeCategory, monthKeyFromDate } from "@/lib/reports";
import { supabase } from "@/lib/supabase";

/** 동시 호출 시 한 번만 실행 (중복 insert 방지) */
let applyDueInflight: Promise<{
  applied: number;
  removedFuture: number;
  error: string | null;
}> | null = null;

function stripRecurringMarker(description: string) {
  return description.replace(/^\[정기(#\d+)?\]\s*/u, "").trim();
}

function normalizeRecurringMatchText(description: string) {
  return normalizeExpenseDescription(stripRecurringMarker(description))
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）[\]【】]/g, "");
}

/** 내용이 같거나 한쪽이 다른 쪽을 포함하면 유사 */
export function recurringDescriptionsSimilar(a: string, b: string) {
  const na = normalizeRecurringMatchText(a);
  const nb = normalizeRecurringMatchText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function recurringDescriptionsExact(a: string, b: string) {
  const na = normalizeRecurringMatchText(a);
  const nb = normalizeRecurringMatchText(b);
  return !!na && na === nb;
}

export type RecurringExpense = {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  interval_months: number;
  start_date: string;
  last_applied_month: string | null;
  active: boolean;
};

function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function clampDay(year: number, month: number, day: number) {
  const last = new Date(year, month, 0).getDate();
  return Math.min(Math.max(1, day), last);
}

/** 해당 달에 정기 지출을 반영할 날짜 YYYY-MM-DD */
export function recurringDateForMonth(
  startDate: string,
  monthKey: string,
): string {
  const day = Number(startDate.slice(8, 10)) || 1;
  const [y, m] = monthKey.split("-").map(Number);
  const d = clampDay(y, m, day);
  return `${monthKey}-${String(d).padStart(2, "0")}`;
}

/**
 * start~current 중 interval에 맞는 달 목록 (오름차순).
 * lastAppliedMonth가 있으면 그 달 다음부터만 (하위 호환).
 * reflectDate가 있으면 예정일이 아직 도래하지 않은 달은 제외.
 */
export function dueMonthsForRecurring(
  startDate: string,
  intervalMonths: number,
  lastAppliedMonth: string | null,
  currentMonth: string,
  reflectDate?: string | null,
): string[] {
  const startMonth = monthKeyFromDate(startDate);
  if (startMonth > currentMonth) return [];

  const due: string[] = [];
  let cursor = startMonth;
  while (cursor <= currentMonth) {
    const offset = monthsBetween(startMonth, cursor);
    if (offset % intervalMonths === 0) {
      if (!lastAppliedMonth || cursor > lastAppliedMonth) {
        if (
          !reflectDate ||
          recurringDateForMonth(startDate, cursor) <= reflectDate
        ) {
          due.push(cursor);
        }
      }
    }
    cursor = addMonths(cursor, 1);
  }
  return due;
}

/** interval만 맞는 달 전체 (last_applied 무시, 누락 복구용) */
export function intervalMonthsForRecurring(
  startDate: string,
  intervalMonths: number,
  currentMonth: string,
): string[] {
  return dueMonthsForRecurring(
    startDate,
    intervalMonths,
    null,
    currentMonth,
    null,
  );
}

export async function loadRecurringExpenses(): Promise<{
  rows: RecurringExpense[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(
      "id, description, amount, category, subcategory, interval_months, start_date, last_applied_month, active",
    )
    .eq("active", true)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });

  if (error) return { rows: [], error: error.message };
  return { rows: (data as RecurringExpense[]) ?? [], error: null };
}

export async function saveRecurringExpense(input: {
  id?: number;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  interval_months: number;
  start_date: string;
}): Promise<{ row: RecurringExpense | null; error: string | null }> {
  const payload = {
    description: input.description.trim(),
    amount: Math.round(input.amount),
    category: input.category.trim(),
    subcategory: input.subcategory.trim(),
    interval_months: Math.max(1, Math.round(input.interval_months)),
    start_date: input.start_date,
    active: true,
    updated_at: new Date().toISOString(),
  };

  if (!payload.description || payload.amount <= 0) {
    return { row: null, error: "내용과 금액을 확인해 주세요." };
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("recurring_expenses")
      .update(payload)
      .eq("id", input.id)
      .select(
        "id, description, amount, category, subcategory, interval_months, start_date, last_applied_month, active",
      )
      .single();
    if (error) return { row: null, error: error.message };
    return { row: data as RecurringExpense, error: null };
  }

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({ ...payload, last_applied_month: null })
    .select(
      "id, description, amount, category, subcategory, interval_months, start_date, last_applied_month, active",
    )
    .single();
  if (error) return { row: null, error: error.message };
  return { row: data as RecurringExpense, error: null };
}

export async function deleteRecurringExpense(id: number) {
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export type RecurringEditScope = "this-only" | "this-and-future";

async function upsertRecurringExpenseForMonth(input: {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  start_date: string;
  monthKey: string;
}): Promise<{ error: string | null }> {
  const reflectDate = koreaRecurringReflectDate();
  const date = recurringDateForMonth(input.start_date, input.monthKey);
  // 오전 10시 전·미래 날짜는 저장하지 않음 (미리 넣으면 정리 로직에 지워짐)
  if (date > reflectDate) {
    return {
      error:
        "해당 달 내역이 아직 도래하지 않아 「이번만」을 적용할 수 없습니다. 「이번과 이후」를 선택하거나 도래 후(오전 10시 이후) 수정해 주세요.",
    };
  }

  const marker = `[정기#${input.id}]`;
  const description = `${marker} ${input.description.trim()}`;
  const amount = Math.round(input.amount);

  const { data: existing } = await supabase
    .from("expenses")
    .select("id")
    .ilike("description", `${marker}%`)
    .gte("date", `${input.monthKey}-01`)
    .lte("date", `${input.monthKey}-31`)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("expenses")
      .update({
        date,
        amount,
        description,
        category: input.category,
        subcategory: input.subcategory,
      })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("expenses").insert({
    date,
    amount,
    description,
    category: input.category,
    subcategory: input.subcategory,
  });
  return { error: error?.message ?? null };
}

/**
 * 이번 달만 수정: 정기 템플릿은 그대로 두고, 해당 달 expenses만 변경.
 */
export async function saveRecurringThisMonthOnly(input: {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  start_date: string;
  monthKey: string;
}): Promise<{ error: string | null }> {
  return upsertRecurringExpenseForMonth(input);
}

/**
 * 이번과 이후: 템플릿 수정 + 이번 달 이미 저장된 건 반영. 과거 달은 유지.
 */
export async function saveRecurringThisAndFuture(input: {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory: string;
  interval_months: number;
  start_date: string;
  monthKey: string;
}): Promise<{ error: string | null }> {
  const saved = await saveRecurringExpense({
    id: input.id,
    description: input.description,
    amount: input.amount,
    category: input.category,
    subcategory: input.subcategory,
    interval_months: input.interval_months,
    start_date: input.start_date,
  });
  if (saved.error) return { error: saved.error };

  const reflectDate = koreaRecurringReflectDate();
  const date = recurringDateForMonth(input.start_date, input.monthKey);
  if (date <= reflectDate) {
    const instance = await upsertRecurringExpenseForMonth({
      id: input.id,
      description: input.description,
      amount: input.amount,
      category: input.category,
      subcategory: input.subcategory,
      start_date: input.start_date,
      monthKey: input.monthKey,
    });
    if (instance.error) return instance;
  }

  return { error: null };
}

/**
 * 예정일이 아직 도래하지 않은 정기 행을 제거합니다.
 * - 저장된 date가 반영 기준일보다 미래이거나
 * - 해당 달의 예정일(시작일의 일)이 아직 도래 전인데 같은 달에 미리 들어간 경우
 */
export async function removeFutureRecurringExpenseRows(): Promise<{
  removed: number;
  error: string | null;
}> {
  const reflectDate = koreaRecurringReflectDate();
  const currentMonth = reflectDate.slice(0, 7);

  const { data: futureDated, error: futureError } = await supabase
    .from("expenses")
    .delete()
    .ilike("description", "[정기#%")
    .gt("date", reflectDate)
    .select("id");

  if (futureError) return { removed: 0, error: futureError.message };
  let removed = futureDated?.length ?? 0;

  const { rows, error: loadError } = await loadRecurringExpenses();
  if (loadError) return { removed, error: loadError };

  for (const row of rows) {
    const months = intervalMonthsForRecurring(
      row.start_date,
      row.interval_months,
      currentMonth,
    );
    const marker = `[정기#${row.id}]`;
    for (const month of months) {
      const scheduled = recurringDateForMonth(row.start_date, month);
      if (scheduled <= reflectDate) continue;

      // 예정일이 아직인데 그 달에 들어간 [정기#id] 행 제거 (날짜가 앞당겨 저장된 경우 포함)
      const { data, error } = await supabase
        .from("expenses")
        .delete()
        .ilike("description", `${marker}%`)
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`)
        .select("id");
      if (error) return { removed, error: error.message };
      removed += data?.length ?? 0;
    }
  }

  return { removed, error: null };
}

/**
 * 같은 달 [정기#id] 중복을 1건만 남기고 삭제. 남긴 행 id를 반환.
 */
async function dedupeRecurringMarkerInMonth(
  marker: string,
  month: string,
  keep: {
    date: string;
    amount: number;
    description: string;
    category: string;
    subcategory: string;
  },
): Promise<{ keptId: number | null; removed: number; error: string | null }> {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("id, date, amount")
    .ilike("description", `${marker}%`)
    .gte("date", `${month}-01`)
    .lte("date", `${month}-31`)
    .order("id", { ascending: true });

  if (error) return { keptId: null, removed: 0, error: error.message };
  const list = rows ?? [];
  if (list.length === 0) return { keptId: null, removed: 0, error: null };

  const keeper = list[0];
  const extraIds = list.slice(1).map((r) => r.id as number);
  let removed = 0;
  if (extraIds.length > 0) {
    const { error: delError } = await supabase
      .from("expenses")
      .delete()
      .in("id", extraIds);
    if (delError) {
      return { keptId: keeper.id as number, removed: 0, error: delError.message };
    }
    removed = extraIds.length;
  }

  // 날짜·금액은 실제 지출 유지, 표시용 description·분류만 맞춤
  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      description: keep.description,
      category: keep.category,
      subcategory: keep.subcategory,
    })
    .eq("id", keeper.id);
  if (updateError) {
    return {
      keptId: keeper.id as number,
      removed,
      error: updateError.message,
    };
  }

  return { keptId: keeper.id as number, removed, error: null };
}

/** 메뉴 정기 템플릿과 수동 지출이 같은 건인지 */
function expenseMatchesRecurringTemplate(
  expense: {
    description: string;
    amount: number;
    category?: string | null;
    subcategory?: string | null;
  },
  template: {
    description: string;
    amount: number;
    category: string;
    subcategory: string;
  },
) {
  if (recurringDescriptionsSimilar(expense.description, template.description)) {
    return true;
  }
  // 이름 표기가 달라도 같은 달·같은 금액·같은 분류면 동일 정기로 봄
  if (Number(expense.amount) !== Number(template.amount)) return false;
  const cat = (expense.category ?? "").trim();
  const sub = (expense.subcategory ?? "").trim();
  return cat === template.category.trim() && sub === template.subcategory.trim();
}

/**
 * 같은 달·아직 날짜가 지난 미태깅(수동) 지출 중 템플릿과 맞는 건을 찾음.
 * 예정일 전이라도, 이미 지출된 날(maxDate 이하)이면 태깅 대상.
 */
async function findSimilarManualInMonth(input: {
  month: string;
  date: string;
  amount: number;
  baseDescription: string;
  category: string;
  subcategory: string;
  /** 이 날짜 이하만 (보통 반영 기준일) */
  maxDate: string;
}): Promise<{
  id: number;
  date: string;
  description: string;
  amount: number;
} | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, date, description, amount, category, subcategory")
    .gte("date", `${input.month}-01`)
    .lte("date", `${input.month}-31`)
    .order("id", { ascending: true });

  if (error || !data?.length) return null;

  const template = {
    description: input.baseDescription,
    amount: input.amount,
    category: input.category,
    subcategory: input.subcategory,
  };

  const manuals = data.filter((row) => {
    const desc = String(row.description ?? "");
    if (isRecurringExpenseDescription(desc)) return false;
    if (String(row.date) > input.maxDate) return false;
    return expenseMatchesRecurringTemplate(
      {
        description: desc,
        amount: Number(row.amount),
        category: row.category as string | null,
        subcategory: row.subcategory as string | null,
      },
      template,
    );
  });
  if (manuals.length === 0) return null;

  function score(row: (typeof manuals)[number]) {
    let s = 0;
    if (row.date === input.date) s += 4;
    if (Number(row.amount) === input.amount) s += 4;
    if (recurringDescriptionsExact(String(row.description), input.baseDescription)) {
      s += 3;
    }
    if (recurringDescriptionsSimilar(String(row.description), input.baseDescription)) {
      s += 2;
    }
    return s;
  }

  const ranked = [...manuals].sort(
    (a, b) => score(b) - score(a) || (a.id as number) - (b.id as number),
  );
  const pick = ranked[0];
  return {
    id: pick.id as number,
    date: String(pick.date),
    description: String(pick.description ?? ""),
    amount: Number(pick.amount),
  };
}

/**
 * 정기 marker 행과 같은 달·매칭되는 수동 지출은 삭제 (정기 건 유지).
 */
async function removeSimilarManualDuplicates(input: {
  marker: string;
  month: string;
  baseDescription: string;
  amount: number;
  category: string;
  subcategory: string;
  keepId: number;
}): Promise<{ removed: number; error: string | null }> {
  const { data: candidates, error } = await supabase
    .from("expenses")
    .select("id, description, amount, category, subcategory")
    .gte("date", `${input.month}-01`)
    .lte("date", `${input.month}-31`);

  if (error) return { removed: 0, error: error.message };

  const template = {
    description: input.baseDescription,
    amount: input.amount,
    category: input.category,
    subcategory: input.subcategory,
  };

  const toDelete: number[] = [];
  for (const row of candidates ?? []) {
    const id = row.id as number;
    if (id === input.keepId) continue;
    const desc = String(row.description ?? "");
    if (desc.includes(input.marker)) continue;
    if (isRecurringExpenseDescription(desc)) continue;
    if (
      expenseMatchesRecurringTemplate(
        {
          description: desc,
          amount: Number(row.amount),
          category: row.category as string | null,
          subcategory: row.subcategory as string | null,
        },
        template,
      )
    ) {
      toDelete.push(id);
    }
  }

  if (toDelete.length === 0) return { removed: 0, error: null };

  const { error: delError } = await supabase
    .from("expenses")
    .delete()
    .in("id", toDelete);
  if (delError) return { removed: 0, error: delError.message };
  return { removed: toDelete.length, error: null };
}

async function applyDueRecurringExpensesInner(
  currentMonth: string,
): Promise<{ applied: number; removedFuture: number; error: string | null }> {
  const cleaned = await removeFutureRecurringExpenseRows();
  if (cleaned.error) {
    return { applied: 0, removedFuture: 0, error: cleaned.error };
  }

  const { rows, error } = await loadRecurringExpenses();
  if (error) return { applied: 0, removedFuture: cleaned.removed, error };

  const reflectDate = koreaRecurringReflectDate();
  let applied = 0;
  let removedExtra = cleaned.removed;

  for (const row of rows) {
    // 이번 달까지 interval에 해당하는 모든 달 (예정일 전이라도 수동분이 있으면 태깅)
    const months = intervalMonthsForRecurring(
      row.start_date,
      row.interval_months,
      currentMonth,
    );
    if (months.length === 0) continue;

    let lastOk: string | null = row.last_applied_month;
    const marker = `[정기#${row.id}]`;

    for (const month of months) {
      const date = recurringDateForMonth(row.start_date, month);
      const description = `${marker} ${row.description}`;
      const scheduledPassed = date <= reflectDate;

      const deduped = await dedupeRecurringMarkerInMonth(marker, month, {
        date,
        amount: row.amount,
        description,
        category: row.category,
        subcategory: row.subcategory,
      });
      if (deduped.error) {
        return {
          applied,
          removedFuture: removedExtra,
          error: deduped.error,
        };
      }
      removedExtra += deduped.removed;

      let keepId = deduped.keptId;

      if (keepId == null) {
        // 이미 지출된 날의 수동 건이면 예정일 전이라도 [정기#id] 태깅
        const similar = await findSimilarManualInMonth({
          month,
          date,
          amount: row.amount,
          baseDescription: row.description,
          category: row.category,
          subcategory: row.subcategory,
          maxDate: reflectDate,
        });

        if (similar) {
          const { error: tagError } = await supabase
            .from("expenses")
            .update({
              description,
              category: row.category,
              subcategory: row.subcategory,
            })
            .eq("id", similar.id);
          if (tagError) {
            return {
              applied,
              removedFuture: removedExtra,
              error: tagError.message,
            };
          }
          keepId = similar.id;
          applied += 1;
        } else if (scheduledPassed) {
          // 수동 건이 없고 예정일이 지났으면 새로 삽입
          const { data: inserted, error: insertError } = await supabase
            .from("expenses")
            .insert({
              date,
              amount: row.amount,
              description,
              category: row.category,
              subcategory: row.subcategory,
            })
            .select("id")
            .single();
          if (insertError) {
            return {
              applied,
              removedFuture: removedExtra,
              error: insertError.message,
            };
          }
          keepId = inserted?.id as number;
          applied += 1;
        }
      }

      if (keepId != null) {
        const manual = await removeSimilarManualDuplicates({
          marker,
          month,
          baseDescription: row.description,
          amount: row.amount,
          category: row.category,
          subcategory: row.subcategory,
          keepId,
        });
        if (manual.error) {
          return {
            applied,
            removedFuture: removedExtra,
            error: manual.error,
          };
        }
        removedExtra += manual.removed;
        lastOk = month;
      }
    }

    if (lastOk && lastOk !== row.last_applied_month) {
      await supabase
        .from("recurring_expenses")
        .update({
          last_applied_month: lastOk,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return { applied, removedFuture: removedExtra, error: null };
}

/**
 * 주기 도래한 정기 지출을 expenses에 자동 저장.
 * - 예정일 ≤ 반영 기준일(당일 오전 10시)인 달만 삽입
 * - 같은 [정기#id]·같은 달은 1건만 유지
 * - 같은 날·금액·유사 내용 수동 건은 삭제(정기 유지)
 * - 동시 호출은 하나로 합침
 */
export async function applyDueRecurringExpenses(
  currentMonth = koreaToday().slice(0, 7),
): Promise<{ applied: number; removedFuture: number; error: string | null }> {
  if (applyDueInflight) return applyDueInflight;

  applyDueInflight = (async () => {
    try {
      return await applyDueRecurringExpensesInner(currentMonth);
    } finally {
      applyDueInflight = null;
    }
  })();

  return applyDueInflight;
}

export type RecurringSummaryKind = "all" | "expense" | "income";

type TaggedExpenseLike = {
  date: string;
  amount: number;
  category: string | null;
  subcategory?: string | null;
  description: string;
};

/**
 * 메뉴 정기 지출「총 합계」와 같은 기준: 활성 정기 지출 템플릿 금액 합.
 */
export function sumRecurringExpenseTemplates(
  templates: RecurringExpense[],
  options?: {
    category?: string | null;
    subcategory?: string | null;
    allowedCategories?: Set<string> | null;
  },
) {
  let total = 0;
  let count = 0;
  for (const row of templates) {
    if (!row.active) continue;
    if (isIncomeCategory(row.category)) continue;
    if (options?.category && row.category !== options.category) continue;
    if (options?.subcategory && row.subcategory !== options.subcategory) {
      continue;
    }
    if (
      options?.allowedCategories &&
      !options.allowedCategories.has(row.category)
    ) {
      continue;
    }
    total += row.amount;
    count += 1;
  }
  return { total, count };
}

/**
 * 실제 지출 내역 중 `[정기…]` 태그가 붙은 건만 합산 (채팅「정기 지출 얼마」용).
 * 항목명 나열 없이 대분류 합계만 반환.
 * categoryFilter / subcategoryFilter 가 있으면 해당 분류만 합산.
 */
export function summarizeTaggedRecurringExpenses(
  expenses: TaggedExpenseLike[],
  monthKey: string,
  kind: RecurringSummaryKind = "expense",
  categoryFilter?: string | null,
  subcategoryFilter?: string | null,
) {
  const filterNorm = categoryFilter?.trim() || null;
  const subFilterNorm = subcategoryFilter?.trim() || null;
  const matched = expenses.filter((item) => {
    if (monthKeyFromDate(item.date) !== monthKey) return false;
    if (!isRecurringExpenseDescription(item.description)) return false;
    const isIncome = isIncomeCategory(item.category);
    if (kind === "expense" && isIncome) return false;
    if (kind === "income" && !isIncome) return false;
    if (filterNorm) {
      const cat = item.category?.trim() || "기타";
      if (cat !== filterNorm) return false;
    }
    if (subFilterNorm) {
      const sub = item.subcategory?.trim() || "기타";
      if (sub !== subFilterNorm) return false;
    }
    return true;
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const item of matched) {
    total += item.amount;
    const cat = item.category?.trim() || "기타";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.amount);
  }

  return {
    total,
    count: matched.length,
    categories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export const AUTO_APPLIED_RECURRING_MESSAGE =
  "이미 자동으로 반영되었습니다.";

/**
 * 수동/채팅 저장 전: 이번 달 정기 지출로 이미 있거나 자동 반영된 건과 겹치는지 확인.
 */
export async function findAutoAppliedRecurringConflict(input: {
  date: string;
  amount: number;
  description: string;
}): Promise<{ conflict: boolean; message: string | null }> {
  const monthKey = monthKeyFromDate(input.date);
  const amount = Math.round(input.amount);
  const { rows, error } = await loadRecurringExpenses();
  if (error) return { conflict: false, message: null };

  for (const row of rows) {
    if (isIncomeCategory(row.category)) continue;

    const dueMonths = intervalMonthsForRecurring(
      row.start_date,
      row.interval_months,
      monthKey,
    );
    if (!dueMonths.includes(monthKey)) continue;

    const amountMatch = Math.round(row.amount) === amount;
    const nameSimilar = recurringDescriptionsSimilar(
      input.description,
      row.description,
    );
    const nameExact = recurringDescriptionsExact(
      input.description,
      row.description,
    );
    if (!nameSimilar) continue;
    if (!amountMatch && !nameExact) continue;

    const marker = `[정기#${row.id}]`;

    // 1) 이미 [정기#id]로 자동 반영된 건
    const { data: tagged, error: taggedError } = await supabase
      .from("expenses")
      .select("id")
      .ilike("description", `${marker}%`)
      .gte("date", `${monthKey}-01`)
      .lte("date", `${monthKey}-31`)
      .limit(1);
    if (taggedError) return { conflict: false, message: null };
    if (tagged && tagged.length > 0) {
      return { conflict: true, message: AUTO_APPLIED_RECURRING_MESSAGE };
    }

    // 2) 같은 달·같은 금액·유사 내용의 기존 지출 (수동 중복 포함)
    const { data: existing, error: existingError } = await supabase
      .from("expenses")
      .select("id, description, amount")
      .eq("amount", amount)
      .gte("date", `${monthKey}-01`)
      .lte("date", `${monthKey}-31`);
    if (existingError) return { conflict: false, message: null };

    const dup = (existing ?? []).some((item) =>
      recurringDescriptionsSimilar(
        String(item.description ?? ""),
        row.description,
      ),
    );
    if (dup) {
      return { conflict: true, message: AUTO_APPLIED_RECURRING_MESSAGE };
    }
  }

  return { conflict: false, message: null };
}

/**
 * 해당 월 정기 템플릿 집계 (알림 등).
 * 예정일이 아직 도래하지 않은 항목은 제외 (오전 10시 기준).
 */
export function summarizeRecurringForMonth(
  rows: RecurringExpense[],
  monthKey: string,
  reflectDate = koreaRecurringReflectDate(),
  kind: RecurringSummaryKind = "all",
) {
  const due = rows.filter((row) => {
    const isIncome = isIncomeCategory(row.category);
    if (kind === "expense" && isIncome) return false;
    if (kind === "income" && !isIncome) return false;
    const months = dueMonthsForRecurring(
      row.start_date,
      row.interval_months,
      null,
      monthKey,
      reflectDate,
    );
    return months.includes(monthKey);
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const row of due) {
    total += row.amount;
    byCategory.set(
      row.category,
      (byCategory.get(row.category) ?? 0) + row.amount,
    );
  }

  return {
    total,
    due,
    categories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
