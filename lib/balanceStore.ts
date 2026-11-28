import { supabase } from "@/lib/supabase";
import { isIncomeCategory } from "@/lib/reports";

export type BalanceSnapshot = {
  id: number;
  amount: number;
  noted_at: string;
};

type ExpenseLike = {
  amount: number;
  category: string | null;
  created_at: string;
};

/** 가장 최근 통장 잔액 기준 불러오기 (RLS로 본인 데이터만) */
export async function loadLatestBalanceSnapshot(): Promise<{
  snapshot: BalanceSnapshot | null;
  error: string | null;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { snapshot: null, error: "로그인이 필요합니다." };
  }

  const { data, error } = await supabase
    .from("balance_snapshots")
    .select("id, amount, noted_at")
    .order("noted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { snapshot: null, error: error.message };
  }

  return {
    snapshot: (data as BalanceSnapshot | null) ?? null,
    error: null,
  };
}

/** 지금 통장 잔액을 기준으로 저장 (이후 거래부터 자동 반영) */
export async function saveBalanceSnapshot(amount: number): Promise<{
  snapshot: BalanceSnapshot | null;
  error: string | null;
}> {
  const rounded = Math.round(amount);
  if (!Number.isFinite(rounded)) {
    return { snapshot: null, error: "올바른 금액을 입력해 주세요." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { snapshot: null, error: "로그인이 필요합니다." };
  }

  const { data, error } = await supabase
    .from("balance_snapshots")
    .insert({
      user_id: user.id,
      amount: rounded,
      noted_at: new Date().toISOString(),
    })
    .select("id, amount, noted_at")
    .single();

  if (error) {
    return { snapshot: null, error: error.message };
  }

  return { snapshot: data as BalanceSnapshot, error: null };
}

/**
 * 추정 통장 잔액 =
 * 기준 금액 + (기준 시각 이후 수입) − (기준 시각 이후 지출)
 */
export function estimateBalance(
  snapshot: BalanceSnapshot,
  expenses: ExpenseLike[],
): number {
  let balance = snapshot.amount;
  const since = snapshot.noted_at;

  for (const row of expenses) {
    if (!row.created_at || row.created_at <= since) continue;
    if (isIncomeCategory(row.category)) {
      balance += row.amount;
    } else {
      balance -= row.amount;
    }
  }

  return balance;
}

/** 기준 시각을 사람이 읽기 쉬운 한국 시각 문자열로 */
export function formatNotedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
