"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  estimateBalance,
  formatNotedAt,
  loadLatestBalanceSnapshot,
  saveBalanceSnapshot,
  type BalanceSnapshot,
} from "@/lib/balanceStore";

type ExpenseLike = {
  amount: number;
  category: string | null;
  created_at: string;
};

type BankBalanceSheetProps = {
  open: boolean;
  onClose: () => void;
  expenses: ExpenseLike[];
  /** 잔액 저장 후 상단 표시 갱신 */
  onSnapshotChange?: (snapshot: BalanceSnapshot | null) => void;
};

function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/** 통장 잔액 맞추기·추정 잔액 확인 */
export function BankBalanceSheet({
  open,
  onClose,
  expenses,
  onSnapshotChange,
}: BankBalanceSheetProps) {
  const [snapshot, setSnapshot] = useState<BalanceSnapshot | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const { snapshot: next, error: loadError } =
        await loadLatestBalanceSnapshot();
      if (cancelled) return;
      if (loadError) {
        setError(
          loadError.includes("balance_snapshots")
            ? "balance_snapshots 테이블이 없습니다. supabase/create_balance_snapshots.sql 을 실행해 주세요."
            : loadError,
        );
        setSnapshot(null);
      } else {
        setSnapshot(next);
        setAmountInput(next ? String(next.amount) : "");
        onSnapshotChange?.(next);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const estimated = snapshot ? estimateBalance(snapshot, expenses) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amountInput.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) {
      setError("숫자를 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    const { snapshot: next, error: saveError } =
      await saveBalanceSnapshot(parsed);
    setSaving(false);

    if (saveError || !next) {
      setError(
        saveError ??
          "저장에 실패했습니다. balance_snapshots 테이블을 확인해 주세요.",
      );
      return;
    }

    setSnapshot(next);
    setAmountInput(String(next.amount));
    onSnapshotChange?.(next);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/30 sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-[1] max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 py-5 shadow-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              통장 잔액
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#86868b]">
              지금 통장에 있는 금액을 입력하면, 그 이후 지출·수입이 자동으로
              반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-[#86868b] hover:bg-[#f5f5f7]"
          >
            닫기
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-[14px] text-[#86868b]">
            불러오는 중...
          </p>
        ) : (
          <>
            <div className="mb-5 rounded-2xl bg-[#f5f5f7] px-4 py-4">
              <p className="text-[12px] font-medium text-[#86868b]">
                추정 통장 잔액
              </p>
              {estimated === null ? (
                <p className="mt-2 text-[15px] text-[#86868b]">
                  아직 기준 잔액이 없습니다. 아래에 입력해 주세요.
                </p>
              ) : (
                <>
                  <p className="mt-1 font-mono text-[1.75rem] font-medium tabular-nums tracking-tight text-[#1d1d1f]">
                    {formatWon(estimated)}
                    <span className="ml-1 text-sm font-normal text-[#86868b]">
                      원
                    </span>
                  </p>
                  <p className="mt-2 text-[12px] text-[#86868b]">
                    기준 {formatWon(snapshot!.amount)}원 ·{" "}
                    {formatNotedAt(snapshot!.noted_at)} 이후 반영
                  </p>
                </>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="bank-balance"
                className="block text-[13px] font-medium text-[#1d1d1f]"
              >
                지금 통장 잔액 맞추기
              </label>
              <input
                id="bank-balance"
                type="number"
                inputMode="numeric"
                step="1"
                required
                placeholder="예: 1500000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-xl bg-[#f5f5f7] px-4 py-3 text-[15px] outline-none focus:bg-[#ebebed]"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-[#1d1d1f] py-3 text-[15px] font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
              >
                {saving ? "저장 중..." : "잔액 저장"}
              </button>
            </form>

            {error && (
              <p className="mt-3 text-[13px] leading-relaxed text-[#b42318]">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
