"use client";

import { formatMonthLabel } from "@/lib/reports";

type MonthIncomeExpenseSheetProps = {
  open: boolean;
  month: string;
  /** 수입 = 월 예산 */
  income: number | null;
  expense: number;
  /** 전체 기간 수입(예산) 합 */
  totalIncome: number | null;
  /** 전체 기간 지출 합 */
  totalExpense: number;
  onClose: () => void;
  onEditIncome?: () => void;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatSigned(amount: number) {
  if (amount < 0) return `- ${formatAmount(Math.abs(amount))}`;
  return formatAmount(amount);
}

/** 이번 달 수입·지출·결과 요약 */
export function MonthIncomeExpenseSheet({
  open,
  month,
  income,
  expense,
  totalIncome,
  totalExpense,
  onClose,
  onEditIncome,
}: MonthIncomeExpenseSheetProps) {
  if (!open) return null;

  const hasIncome = income != null && income > 0;
  const incomeValue = hasIncome ? income : 0;
  // 수입 없으면 지출을 마이너스로 표시
  const expenseDisplay = hasIncome ? expense : -expense;
  const monthlyResult = hasIncome ? incomeValue - expense : -expense;

  const hasTotalIncome = totalIncome != null && totalIncome > 0;
  const totalResult = hasTotalIncome
    ? (totalIncome ?? 0) - totalExpense
    : -totalExpense;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="month-income-expense-title"
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="month-income-expense-title"
          className="text-[17px] font-semibold text-[#1d1d1f]"
        >
          이번 달 수입·지출
        </h2>
        <p className="mt-1 text-[13px] text-[#86868b]">
          {month ? formatMonthLabel(month) : "이번 달"}
        </p>

        <table className="mt-4 w-full border-collapse overflow-hidden rounded-2xl text-[15px]">
          <tbody>
            <tr className="border-b border-black/5 bg-[#f5f5f7]">
              <th
                scope="row"
                className="px-3.5 py-3 text-left font-medium text-[#1d1d1f]"
              >
                수입
              </th>
              <td className="px-3.5 py-3 text-right tabular-nums text-[#1d1d1f] [font-feature-settings:'zero'_0]">
                {hasIncome ? formatAmount(incomeValue) : "—"}
              </td>
            </tr>
            <tr className="border-b border-black/5 bg-white">
              <th
                scope="row"
                className="px-3.5 py-3 text-left font-medium text-[#1d1d1f]"
              >
                지출
              </th>
              <td
                className={`px-3.5 py-3 text-right tabular-nums [font-feature-settings:'zero'_0] ${
                  expenseDisplay < 0 ? "text-[#b42318]" : "text-[#1d1d1f]"
                }`}
              >
                {formatSigned(expenseDisplay)}
              </td>
            </tr>
            <tr className="border-b border-black/5 bg-[#f5f5f7]">
              <th
                scope="row"
                className="px-3.5 py-3 text-left font-semibold text-[#1d1d1f]"
              >
                결과 (월별)
              </th>
              <td
                className={`px-3.5 py-3 text-right font-semibold tabular-nums [font-feature-settings:'zero'_0] ${
                  monthlyResult < 0 ? "text-[#b42318]" : "text-[#1d1d1f]"
                }`}
              >
                {formatSigned(monthlyResult)}
              </td>
            </tr>
            <tr className="bg-white">
              <th
                scope="row"
                className="px-3.5 py-3 text-left font-semibold text-[#1d1d1f]"
              >
                결과 (총합계)
              </th>
              <td
                className={`px-3.5 py-3 text-right font-semibold tabular-nums [font-feature-settings:'zero'_0] ${
                  totalResult < 0 ? "text-[#b42318]" : "text-[#1d1d1f]"
                }`}
              >
                {formatSigned(totalResult)}
              </td>
            </tr>
          </tbody>
        </table>

        {!hasIncome && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#86868b]">
            수입(월 예산)이 없어 지출·결과를 마이너스로 표시합니다.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-[#f5f5f7] py-2.5 text-[14px] font-medium text-[#1d1d1f]"
          >
            닫기
          </button>
          {onEditIncome && (
            <button
              type="button"
              onClick={onEditIncome}
              className="flex-1 rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
            >
              {hasIncome ? "수입 수정" : "수입 설정"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
