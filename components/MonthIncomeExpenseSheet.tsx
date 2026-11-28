"use client";

import { formatMonthLabel } from "@/lib/reports";

type MonthIncomeExpenseSheetProps = {
  /** 모달로 띄울 때 true. false면 월별 탭 인라인 패널 */
  open?: boolean;
  month: string;
  /** 이번 달 수입 (정기+일반 자동 합산) */
  income: number;
  expense: number;
  /** 전체 기간 수입 합 */
  totalIncome: number;
  /** 전체 기간 지출 합 */
  totalExpense: number;
  onClose?: () => void;
  /** inline: 월별 탭용 (닫기 버튼 없음) */
  variant?: "modal" | "inline";
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatSigned(amount: number) {
  if (amount < 0) return `- ${formatAmount(Math.abs(amount))}`;
  return formatAmount(amount);
}

function ResultTable({
  month,
  income,
  expense,
  totalIncome,
  totalExpense,
}: {
  month: string;
  income: number;
  expense: number;
  totalIncome: number;
  totalExpense: number;
}) {
  const hasIncome = income > 0;
  const incomeValue = hasIncome ? income : 0;
  const expenseDisplay = hasIncome ? expense : -expense;
  const monthlyResult = hasIncome ? incomeValue - expense : -expense;

  const hasTotalIncome = totalIncome > 0;
  const totalResult = hasTotalIncome
    ? totalIncome - totalExpense
    : -totalExpense;

  return (
    <>
      <p className="text-[13px] text-[#86868b]">
        {month ? formatMonthLabel(month) : "이번 달"}
      </p>

      <table className="mt-3 w-full border-collapse overflow-hidden rounded-2xl text-[15px]">
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

      <p className="mt-3 text-[12px] leading-relaxed text-[#86868b]">
        수입은 고정 수입·일반 수입을 합산한 금액입니다.
        {!hasIncome && " 이번 달 수입 내역이 없어 지출을 마이너스로 표시합니다."}
      </p>
    </>
  );
}

/** 이번 달 수입·지출·결과 요약 (수입은 자동 합산) */
export function MonthIncomeExpenseSheet({
  open = true,
  month,
  income,
  expense,
  totalIncome,
  totalExpense,
  onClose,
  variant = "modal",
}: MonthIncomeExpenseSheetProps) {
  if (variant === "inline") {
    return (
      <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="text-[16px] font-semibold text-[#1d1d1f]">결과</h2>
        <ResultTable
          month={month}
          income={income}
          expense={expense}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
        />
      </div>
    );
  }

  if (!open) return null;

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
        <ResultTable
          month={month}
          income={income}
          expense={expense}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
        />

        <div className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
