"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryTree } from "@/lib/categories";
import { koreaToday } from "@/lib/date";
import type { RecurringExpense } from "@/lib/recurringStore";

type RecurringExpenseSheetProps = {
  open: boolean;
  rows: RecurringExpense[];
  categoryTree: CategoryTree;
  loading?: boolean;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: number;
    description: string;
    amount: number;
    category: string;
    subcategory: string;
    interval_months: number;
    start_date: string;
  }) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
};

function formatAmount(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

const fieldClass =
  "w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]";

/** 정기 지출 목록·추가·수정·삭제 */
export function RecurringExpenseSheet({
  open,
  rows,
  categoryTree,
  loading,
  error,
  busy,
  onClose,
  onSave,
  onDelete,
}: RecurringExpenseSheetProps) {
  const categories = Object.keys(categoryTree);
  const defaultCategory =
    categories.find((c) => c !== "수입") ?? categories[0] ?? "기타";

  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subcategory, setSubcategory] = useState(
    (categoryTree[defaultCategory] ?? ["기타"])[0] ?? "기타",
  );
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [startDate, setStartDate] = useState(koreaToday());
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const subs = useMemo(
    () => categoryTree[category] ?? ["기타"],
    [categoryTree, category],
  );

  useEffect(() => {
    if (!subs.includes(subcategory)) {
      setSubcategory(subs[0] ?? "기타");
    }
  }, [subs, subcategory]);

  if (!open) return null;

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setAmount("");
    setCategory(defaultCategory);
    setSubcategory((categoryTree[defaultCategory] ?? ["기타"])[0] ?? "기타");
    setIntervalMonths("1");
    setStartDate(koreaToday());
    setFormError(null);
    setShowForm(false);
  }

  function startEdit(row: RecurringExpense) {
    setEditingId(row.id);
    setDescription(row.description);
    setAmount(String(row.amount));
    setCategory(row.category);
    setSubcategory(row.subcategory);
    setIntervalMonths(String(row.interval_months));
    setStartDate(row.start_date);
    setShowForm(true);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(/,/g, ""));
    const interval = Number(intervalMonths.replace(/,/g, ""));
    if (!description.trim()) {
      setFormError("내용을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("금액을 확인해 주세요.");
      return;
    }
    if (!Number.isFinite(interval) || interval < 1 || interval > 60) {
      setFormError("주기는 1~60개월 숫자로 입력해 주세요.");
      return;
    }
    const err = await onSave({
      id: editingId ?? undefined,
      description: description.trim(),
      amount: n,
      category,
      subcategory,
      interval_months: Math.round(interval),
      start_date: startDate,
    });
    if (err) {
      setFormError(err);
      return;
    }
    resetForm();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2
            id="recurring-title"
            className="text-[16px] font-semibold text-[#1d1d1f]"
          >
            정기 지출
          </h2>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg px-2 py-1 text-[13px] text-[#86868b]"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[12px] leading-relaxed text-[#86868b]">
            주기마다 지출에 자동 저장됩니다. 개월 수로 주기를 정하세요.
          </p>

          {error && (
            <p className="mb-2 rounded-xl bg-[#fff4e5] px-3 py-2 text-[12px] text-[#8a6116]">
              {error}
              {" · "}
              Supabase에서 create_recurring_expenses.sql을 실행했는지 확인해
              주세요.
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-[13px] text-[#86868b]">
              불러오는 중...
            </p>
          ) : rows.length === 0 && !showForm ? (
            <p className="rounded-2xl bg-[#f5f5f7] px-3 py-6 text-center text-[13px] text-[#86868b]">
              등록된 정기 지출이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl bg-[#f5f5f7] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-[#1d1d1f]">
                        {row.description}
                      </p>
                      <p className="text-[11px] text-[#86868b]">
                        {row.interval_months}개월마다 · {row.category}_
                        {row.subcategory}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-medium tabular-nums text-[#1d1d1f]">
                      {formatAmount(row.amount)}원
                    </p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(row)}
                      className="rounded-xl bg-white px-3 py-1.5 text-[12px] font-medium text-[#1d1d1f] ring-1 ring-black/5 disabled:opacity-40"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `"${row.description}" 정기 지출을 삭제할까요? (이미 저장된 지출은 그대로 둡니다)`,
                          )
                        ) {
                          void onDelete(row.id);
                        }
                      }}
                      className="rounded-xl bg-white px-3 py-1.5 text-[12px] font-medium text-[#b42318] ring-1 ring-black/5 disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showForm ? (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mt-4 space-y-2.5 rounded-2xl border border-black/5 p-3"
            >
              <p className="text-[13px] font-medium text-[#1d1d1f]">
                {editingId ? "정기 지출 수정" : "정기 지출 추가"}
              </p>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="내용 (예: 넷플릭스)"
                className={fieldClass}
                disabled={busy}
              />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액"
                className={fieldClass}
                disabled={busy}
              />
              <select
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
              <select
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
              <label className="block">
                <span className="mb-1 block text-[12px] text-[#86868b]">
                  주기 (개월 수 직접 입력)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                    placeholder="예: 1"
                    className={fieldClass}
                    disabled={busy}
                  />
                  <span className="shrink-0 text-[13px] text-[#86868b]">
                    개월마다
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] text-[#86868b]">
                  시작일
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={fieldClass}
                  disabled={busy}
                />
              </label>
              {formError && (
                <p className="text-[12px] text-red-600">{formError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetForm}
                  className="flex-1 rounded-2xl bg-[#f5f5f7] py-2.5 text-[13px] font-medium text-[#1d1d1f]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-2xl bg-[#1d1d1f] py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
                >
                  {busy ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 w-full rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
            >
              정기 지출 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
