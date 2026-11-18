"use client";

import { koreaDateString, koreaToday } from "@/lib/date";

type SaveExpenseToDateDialogProps = {
  open: boolean;
  description: string;
  amountLabel: string;
  dateValue: string;
  busy?: boolean;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onSave: () => void;
};

/** 기존 지출을 다른 날짜로 새로 저장 */
export function SaveExpenseToDateDialog({
  open,
  description,
  amountLabel,
  dateValue,
  busy,
  onDateChange,
  onClose,
  onSave,
}: SaveExpenseToDateDialogProps) {
  if (!open) return null;

  const today = koreaToday();
  const yesterday = koreaDateString(-1);

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
        <p className="mt-1 text-[13px] leading-relaxed text-[#86868b]">
          기존 내역은 그대로 두고, 같은 내용으로 새 지출을 만듭니다.
        </p>
        <p className="mt-3 rounded-2xl bg-[#f5f5f7] px-3.5 py-2.5 text-[14px] text-[#1d1d1f]">
          {description}
          <span className="ml-2 font-mono tabular-nums text-[#86868b]">
            {amountLabel}
          </span>
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] text-[#86868b]">날짜</span>
          <input
            type="date"
            value={dateValue}
            max={today}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
          />
        </label>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className="flex-1 rounded-xl bg-[#f5f5f7] py-2 text-[13px] font-medium text-[#1d1d1f]"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => onDateChange(yesterday)}
            className="flex-1 rounded-xl bg-[#f5f5f7] py-2 text-[13px] font-medium text-[#1d1d1f]"
          >
            어제
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl bg-[#f5f5f7] py-3 text-[14px] font-medium text-[#1d1d1f] disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy || !dateValue}
            onClick={onSave}
            className="flex-1 rounded-2xl bg-[#1d1d1f] py-3 text-[14px] font-medium text-white disabled:opacity-40"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
