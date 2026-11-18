import { supabase } from "@/lib/supabase";

export type MonthlyBudget = {
  id: number;
  month: string;
  amount: number;
};

/** 특정 월 예산 조회 */
export async function loadMonthlyBudget(month: string): Promise<{
  budget: MonthlyBudget | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("id, month, amount")
    .eq("month", month)
    .maybeSingle();

  if (error) {
    return { budget: null, error: error.message };
  }

  return {
    budget: data as MonthlyBudget | null,
    error: null,
  };
}

/** 저장된 월 예산 전체 (최신 월 위) */
export async function loadMonthlyBudgets(): Promise<{
  budgets: MonthlyBudget[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("id, month, amount")
    .order("month", { ascending: false });

  if (error) {
    return { budgets: [], error: error.message };
  }

  return {
    budgets: (data as MonthlyBudget[]) ?? [],
    error: null,
  };
}

/** 월 예산 저장(없으면 추가, 있으면 수정) */
export async function saveMonthlyBudget(
  month: string,
  amount: number,
): Promise<{ budget: MonthlyBudget | null; error: string | null }> {
  const rounded = Math.round(amount);
  if (!month || rounded <= 0) {
    return { budget: null, error: "올바른 예산 금액을 입력해 주세요." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { budget: null, error: "로그인이 필요합니다." };
  }

  const { data, error } = await supabase
    .from("monthly_budgets")
    .upsert(
      {
        user_id: user.id,
        month,
        amount: rounded,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" },
    )
    .select("id, month, amount")
    .single();

  if (error) {
    return { budget: null, error: error.message };
  }

  return { budget: data as MonthlyBudget, error: null };
}

/** 월 예산 삭제 */
export async function clearMonthlyBudget(month: string) {
  const { error } = await supabase
    .from("monthly_budgets")
    .delete()
    .eq("month", month);
  return { error: error?.message ?? null };
}
