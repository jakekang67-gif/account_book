"use client";

import { koreaToday } from "@/lib/date";
import { noAutofillProps } from "@/lib/noAutofill";

type SaveExpenseToDateDialogProps = {
  open: boolean;
  description: string;
  dateValue: string;
  amountValue: string;
  busy?: boolean;
  onDateChange: (date: string) => void;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSave: () => void;
};

/** 다른 날짜·금액으로 새 지출 저장 (달력 + 금액) */
export function SaveExpenseToDateDialog({
  open,
  description,
  dateValue,
  amountValue,
  busy,
  onDateChange,
  onAmountChange,
  onClose,
  onSave,
}: SaveExpenseToDateDialogProps) {
  if (!open) return null;

  const today = koreaToday();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-to-date-title"
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="save-to-date-title"
          className="text-[17px] font-semibold text-[#1d1d1f]"
        >
          다른 날짜로 저장
        </h2>
        <p className="mt-1 text-[13px] text-[#86868b]">
          기존 내역은 그대로 둡니다. · {description}
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] text-[#86868b]">날짜</span>
          <input
            {...noAutofillProps}
            type="date"
            name="save-to-date"
            value={dateValue || today}
            max={today}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-[13px] text-[#86868b]">금액</span>
          <input
            {...noAutofillProps}
            type="number"
            inputMode="numeric"
            name="save-to-amount"
            min="1"
            value={amountValue}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] tabular-nums text-[#1d1d1f] outline-none focus:bg-[#ebebed] [font-feature-settings:'zero'_0]"
            placeholder="금액"
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl bg-[#f5f5f7] py-2.5 text-[14px] font-medium text-[#1d1d1f] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy || !dateValue || !amountValue}
            onClick={onSave}
            className="flex-1 rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
