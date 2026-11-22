"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AutofillDecoys,
  NoAutofillInput,
} from "@/components/NoAutofillField";
import { noAutofillFormProps } from "@/lib/noAutofill";
import { formatMonthLabel } from "@/lib/reports";

type BudgetEditorProps = {
  open: boolean;
  month: string;
  currentAmount: number | null;
  onClose: () => void;
  onSave: (amount: number) => Promise<string | null>;
  onClear: () => Promise<string | null>;
};

/** 월 예산 설정 모달 */
export function BudgetEditor({
  open,
  month,
  currentAmount,
  onClose,
  onSave,
  onClear,
}: BudgetEditorProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(currentAmount != null ? String(currentAmount) : "");
    setError(null);
  }, [open, currentAmount]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("예산은 0보다 큰 숫자로 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSave(Math.round(amount));
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  async function handleClear() {
    if (!window.confirm("이번 달 예산을 삭제할까요?")) return;
    setBusy(true);
    setError(null);
    const message = await onClear();
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-editor-title"
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="budget-editor-title"
          className="text-[17px] font-semibold text-[#1d1d1f]"
        >
          월 예산 설정
        </h2>
        <p className="mt-1 text-[13px] text-[#86868b]">
          {formatMonthLabel(month)} 예산을 입력해 주세요.
        </p>

        <form
          {...noAutofillFormProps}
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-4 space-y-3"
        >
          <div className="relative">
            <AutofillDecoys />
            <label className="block">
              <span className="mb-1 block text-[12px] text-[#86868b]">
                예산 금액 (원)
              </span>
              <NoAutofillInput
                type="text"
                inputMode="numeric"
                name="budget-month-amount"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
                placeholder="예: 1000000"
                className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
              />
            </label>
          </div>

          {error && (
            <p className="text-[12px] leading-relaxed text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex-1 rounded-2xl bg-[#f5f5f7] py-2.5 text-[14px] font-medium text-[#1d1d1f] disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "저장 중..." : "저장"}
            </button>
          </div>

          {currentAmount != null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleClear()}
              className="w-full py-1 text-[12px] text-[#b42318] disabled:opacity-40"
            >
              예산 삭제
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
