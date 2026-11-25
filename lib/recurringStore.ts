import { koreaRecurringReflectDate, koreaToday } from "@/lib/date";
import { monthKeyFromDate } from "@/lib/reports";
import { supabase } from "@/lib/supabase";

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
 * 주기 도래한 정기 지출을 expenses에 자동 저장.
 * - 예정일 ≤ 반영 기준일(당일 오전 10시)인 달만 삽입
 * - last_applied와 무관하게 누락 행은 다시 넣음 (중복은 marker+달로 방지)
 */
export async function applyDueRecurringExpenses(
  currentMonth = koreaToday().slice(0, 7),
): Promise<{ applied: number; removedFuture: number; error: string | null }> {
  const cleaned = await removeFutureRecurringExpenseRows();
  if (cleaned.error) {
    return { applied: 0, removedFuture: 0, error: cleaned.error };
  }

  const { rows, error } = await loadRecurringExpenses();
  if (error) return { applied: 0, removedFuture: cleaned.removed, error };

  const reflectDate = koreaRecurringReflectDate();
  let applied = 0;

  for (const row of rows) {
    const months = intervalMonthsForRecurring(
      row.start_date,
      row.interval_months,
      currentMonth,
    ).filter(
      (month) => recurringDateForMonth(row.start_date, month) <= reflectDate,
    );
    if (months.length === 0) continue;

    let lastOk: string | null = row.last_applied_month;
    const marker = `[정기#${row.id}]`;

    for (const month of months) {
      const date = recurringDateForMonth(row.start_date, month);
      const description = `${marker} ${row.description}`;

      // 같은 정기 id + 같은 달이면 중복 삽입하지 않음 (날짜가 달라도 1건만)
      const { data: existing } = await supabase
        .from("expenses")
        .select("id, date, amount")
        .ilike("description", `${marker}%`)
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase.from("expenses").insert({
          date,
          amount: row.amount,
          description,
          category: row.category,
          subcategory: row.subcategory,
        });
        if (insertError) {
          return {
            applied,
            removedFuture: cleaned.removed,
            error: insertError.message,
          };
        }
        applied += 1;
      } else if (
        existing.date !== date ||
        Number(existing.amount) !== row.amount
      ) {
        // 예정일·금액이 어긋난 기존 행은 교정
        const { error: updateError } = await supabase
          .from("expenses")
          .update({
            date,
            amount: row.amount,
            description,
            category: row.category,
            subcategory: row.subcategory,
          })
          .eq("id", existing.id);
        if (updateError) {
          return {
            applied,
            removedFuture: cleaned.removed,
            error: updateError.message,
          };
        }
      }

      lastOk = month;
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

  return { applied, removedFuture: cleaned.removed, error: null };
}

/**
 * 해당 월 정기 지출 집계 (채팅용).
 * 예정일이 아직 도래하지 않은 항목은 제외 (오전 10시 기준).
 */
export function summarizeRecurringForMonth(
  rows: RecurringExpense[],
  monthKey: string,
  reflectDate = koreaRecurringReflectDate(),
) {
  const due = rows.filter((row) => {
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
