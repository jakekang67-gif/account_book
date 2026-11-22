"use client";

import { FormEvent, useEffect, useState } from "react";
import type { MonthlyBudget } from "@/lib/budgetStore";
import { playBudgetWarningSound } from "@/lib/budgetAlert";
import { noAutofillFormProps, noAutofillProps } from "@/lib/noAutofill";
import { formatMonthLabel } from "@/lib/reports";

type BudgetListProps = {
  open: boolean;
  rows: MonthlyBudget[];
  currentMonth: string;
  alertPercent: number;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSelect: (month: string, amount: number) => void;
  onAddCurrent: () => void;
  onAlertPercentChange: (percent: number) => void;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/** 월 예산 목록 모달 */
export function BudgetList({
  open,
  rows,
  currentMonth,
  alertPercent,
  loading = false,
  error = null,
  onClose,
  onSelect,
  onAddCurrent,
  onAlertPercentChange,
}: BudgetListProps) {
  const [percentInput, setPercentInput] = useState(String(alertPercent));
  const [percentMessage, setPercentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPercentInput(String(alertPercent));
    setPercentMessage(null);
  }, [open, alertPercent]);

  if (!open) return null;

  const hasCurrent = Boolean(
    currentMonth && rows.some((row) => row.month === currentMonth),
  );

  function handleSavePercent(event: FormEvent) {
    event.preventDefault();
    const n = Number(percentInput.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      setPercentMessage("1~200 사이 숫자로 입력해 주세요.");
      return;
    }
    onAlertPercentChange(Math.round(n));
    setPercentMessage(`경고 기준 ${Math.round(n)}%로 저장했어요.`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-list-title"
        className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="shrink-0 border-b border-black/5 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="budget-list-title"
                className="text-[17px] font-semibold text-[#1d1d1f]"
              >
                월 예산 목록
              </h2>
              <p className="mt-1 text-[13px] text-[#86868b]">
                항목을 누르면 수정할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#1d1d1f]"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <form
            {...noAutofillFormProps}
            onSubmit={handleSavePercent}
            className="mb-4 rounded-2xl bg-[#f5f5f7] px-3.5 py-3"
          >
            <p className="text-[13px] font-medium text-[#1d1d1f]">
              예산 경고 기준
            </p>
            <p className="mt-0.5 text-[12px] text-[#86868b]">
              이번 달 지출이 이 비율에 처음 도달하면 경고음이 납니다.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                {...noAutofillProps}
                type="text"
                inputMode="numeric"
                name="budget-alert-percent"
                value={percentInput}
                onChange={(e) => setPercentInput(e.target.value)}
                className="w-20 rounded-xl bg-white px-3 py-2 text-center font-mono text-[15px] text-[#1d1d1f] outline-none ring-1 ring-black/5"
                aria-label="경고 기준 퍼센트"
              />
              <span className="text-[14px] text-[#86868b]">%</span>
              <button
                type="submit"
                className="ml-auto rounded-xl bg-[#1d1d1f] px-3 py-2 text-[12px] font-medium text-white"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => playBudgetWarningSound()}
                className="rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-[#1d1d1f] ring-1 ring-black/5"
              >
                미리듣기
              </button>
            </div>
            {percentMessage && (
              <p className="mt-2 text-[12px] text-[#86868b]">{percentMessage}</p>
            )}
          </form>

          {error && (
            <p className="mb-3 text-[12px] leading-relaxed text-red-600">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-[14px] text-[#86868b]">
              불러오는 중...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-[#86868b]">
              아직 저장된 월 예산이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const isCurrent = row.month === currentMonth;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(row.month, row.amount)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors ${
                        isCurrent
                          ? "bg-[#f5f5f7] ring-1 ring-black/10"
                          : "bg-[#fafafa] hover:bg-[#f5f5f7]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[#1d1d1f]">
                          {formatMonthLabel(row.month)}
                          {isCurrent ? (
                            <span className="ml-1.5 text-[11px] font-normal text-[#86868b]">
                              이번 달
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[14px] tabular-nums text-[#1d1d1f]">
                        {formatAmount(row.amount)}
                        <span className="ml-0.5 text-[12px] text-[#86868b]">
                          원
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {currentMonth && !hasCurrent && (
          <div className="shrink-0 border-t border-black/5 px-5 py-3">
            <button
              type="button"
              onClick={onAddCurrent}
              className="w-full rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
            >
              {formatMonthLabel(currentMonth)} 예산 설정
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
