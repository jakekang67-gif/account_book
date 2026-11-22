"use client";

import { useEffect, useState } from "react";
import type { CategoryTree } from "@/lib/categories";
import { koreaToday } from "@/lib/date";
import { noAutofillFormProps, noAutofillProps } from "@/lib/noAutofill";

type ManualExpenseFormProps = {
  categoryTree: CategoryTree;
  todayMax: string;
  busy?: boolean;
  onSave: (payload: {
    date: string;
    amount: number;
    description: string;
    category: string;
    subcategory: string;
  }) => Promise<boolean>;
};

const fieldClass =
  "w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]";

/** 채팅 없이 날짜·내용·금액·분류를 직접 입력 */
export function ManualExpenseForm({
  categoryTree,
  todayMax,
  busy,
  onSave,
}: ManualExpenseFormProps) {
  const categories = Object.keys(categoryTree);
  const defaultCategory =
    categories.find((c) => c !== "수입") ?? categories[0] ?? "기타";
  const defaultSubs = categoryTree[defaultCategory] ?? ["기타"];

  const [date, setDate] = useState(todayMax || koreaToday());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subcategory, setSubcategory] = useState(defaultSubs[0] ?? "기타");
  const [error, setError] = useState<string | null>(null);

  const subs = categoryTree[category] ?? ["기타"];

  useEffect(() => {
    if (todayMax && !date) setDate(todayMax);
  }, [todayMax, date]);

  useEffect(() => {
    if (!categories.includes(category) && defaultCategory) {
      setCategory(defaultCategory);
    }
  }, [categories, category, defaultCategory]);

  useEffect(() => {
    if (!subs.includes(subcategory)) {
      setSubcategory(subs[0] ?? "기타");
    }
  }, [subs, subcategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount.replace(/,/g, ""));
    const desc = description.trim();
    if (!date) {
      setError("날짜를 선택해 주세요.");
      return;
    }
    if (!desc) {
      setError("내용을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError("금액을 확인해 주세요.");
      return;
    }
    if (!category || !subcategory) {
      setError("카테고리를 선택해 주세요.");
      return;
    }

    const ok = await onSave({
      date,
      amount: Math.round(n),
      description: desc,
      category,
      subcategory,
    });
    if (ok) {
      setDescription("");
      setAmount("");
      setDate(todayMax || koreaToday());
    }
  }

  return (
    <form
      {...noAutofillFormProps}
      onSubmit={(e) => void handleSubmit(e)}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-4"
    >
      <p className="px-1 text-[13px] text-[#86868b]">
        날짜·금액·내용·분류를 직접 입력해 저장합니다.
      </p>

      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">날짜</span>
        <input
          {...noAutofillProps}
          type="date"
          name="manual-expense-date"
          value={date}
          max={todayMax || undefined}
          onChange={(e) => setDate(e.target.value)}
          className={fieldClass}
          disabled={busy}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">금액</span>
        <input
          {...noAutofillProps}
          type="number"
          inputMode="numeric"
          name="manual-expense-amount"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="예: 10000"
          className={`${fieldClass} tabular-nums [font-feature-settings:'zero'_0]`}
          disabled={busy}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">내용</span>
        <input
          {...noAutofillProps}
          name="manual-expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="내용 (예: 넷플릭스)"
          className={fieldClass}
          disabled={busy}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">
          카테고리 대분류
        </span>
        <select
          autoComplete="off"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={fieldClass}
          disabled={busy}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">
          카테고리 소분류
        </span>
        <select
          autoComplete="off"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          className={fieldClass}
          disabled={busy}
        >
          {subs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="px-1 text-[13px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-[#1d1d1f] py-3 text-[15px] font-medium text-white disabled:opacity-40"
      >
        {busy ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
