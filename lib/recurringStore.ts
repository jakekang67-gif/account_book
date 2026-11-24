import { koreaToday } from "@/lib/date";
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

/** start~current 중 interval에 맞는 달 목록 (오름차순) */
export function dueMonthsForRecurring(
  startDate: string,
  intervalMonths: number,
  lastAppliedMonth: string | null,
  currentMonth: string,
): string[] {
  const startMonth = monthKeyFromDate(startDate);
  if (startMonth > currentMonth) return [];

  const due: string[] = [];
  let cursor = startMonth;
  while (cursor <= currentMonth) {
    const offset = monthsBetween(startMonth, cursor);
    if (offset % intervalMonths === 0) {
      if (!lastAppliedMonth || cursor > lastAppliedMonth) {
        due.push(cursor);
      }
    }
    cursor = addMonths(cursor, 1);
  }
  return due;
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
  const today = koreaToday();
  const date = recurringDateForMonth(input.start_date, input.monthKey);
  // 아직 오지 않은 날짜는 저장하지 않음 (미리 넣으면 정리 로직에 지워짐)
  if (date > today) {
    return {
      error:
        "해당 달 내역이 아직 도래하지 않아 「이번만」을 적용할 수 없습니다. 「이번과 이후」를 선택하거나 도래 후 수정해 주세요.",
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

  const today = koreaToday();
  const date = recurringDateForMonth(input.start_date, input.monthKey);
  if (date <= today) {
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
 * 과거에 미리 넣었던 '아직 오지 않은 날짜'의 정기 지출 행을 제거합니다.
 */
export async function removeFutureRecurringExpenseRows(): Promise<{
  removed: number;
  error: string | null;
}> {
  const today = koreaToday();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .ilike("description", "[정기#%")
    .gt("date", today)
    .select("id");

  if (error) return { removed: 0, error: error.message };
  return { removed: data?.length ?? 0, error: null };
}

/**
 * 주기 도래한 정기 지출을 expenses에 자동 저장.
 * description에 [정기#id] 접두로 중복 방지에 활용.
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

  let applied = 0;
  for (const row of rows) {
    const months = dueMonthsForRecurring(
      row.start_date,
      row.interval_months,
      row.last_applied_month,
      currentMonth,
    );
    if (months.length === 0) continue;

    let lastOk: string | null = row.last_applied_month;
    const today = koreaToday();
    for (const month of months) {
      const marker = `[정기#${row.id}]`;
      const date = recurringDateForMonth(row.start_date, month);
      // 아직 오지 않은 날짜는 지출로 넣지 않음 (구매 내역·합계에 미리 잡히지 않게)
      if (date > today) continue;

      const description = `${marker} ${row.description}`;

      const { data: existing } = await supabase
        .from("expenses")
        .select("id")
        .eq("date", date)
        .eq("amount", row.amount)
        .ilike("description", `${marker}%`)
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

/** 이번 달 도래하는 정기 지출 집계 (채팅용) */
export function summarizeRecurringForMonth(
  rows: RecurringExpense[],
  monthKey: string,
) {
  const due = rows.filter((row) => {
    const months = dueMonthsForRecurring(
      row.start_date,
      row.interval_months,
      null,
      monthKey,
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
