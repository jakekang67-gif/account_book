"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FIXED_INCOME_SUBS,
  FIXED_INCOME_CATEGORY,
  type CategoryTree,
} from "@/lib/categories";
import type { CategoryItemRow } from "@/lib/categoryStore";
import { koreaToday } from "@/lib/date";
import { FixedIncomeSubEditor } from "@/components/FixedIncomeSubEditor";
import {
  AutofillDecoys,
  NoAutofillInput,
} from "@/components/NoAutofillField";
import { noAutofillFormProps } from "@/lib/noAutofill";
import type { RecurringExpense } from "@/lib/recurringStore";

export { FIXED_INCOME_CATEGORY };

type RecurringExpenseSheetProps = {
  open: boolean;
  rows: RecurringExpense[];
  categoryTree: CategoryTree;
  categoryRows?: CategoryItemRow[];
  /** expense=정기 지출, income=정기 수입 */
  mode?: "expense" | "income";
  loading?: boolean;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => Promise<void>;
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

/** 정기 지출·정기 수입 목록·추가·수정·삭제 */
export function RecurringExpenseSheet({
  open,
  rows,
  categoryTree,
  categoryRows = [],
  mode = "expense",
  loading,
  error,
  busy,
  onClose,
  onCategoriesChanged,
  onSave,
  onDelete,
}: RecurringExpenseSheetProps) {
  const isIncome = mode === "income";
  const title = isIncome ? "정기 수입" : "정기 지출";
  const categories = isIncome
    ? [FIXED_INCOME_CATEGORY]
    : Object.keys(categoryTree).filter(
        (c) => c !== "수입" && c !== FIXED_INCOME_CATEGORY,
      );
  const defaultCategory = isIncome
    ? FIXED_INCOME_CATEGORY
    : (categories[0] ?? "기타");
  const incomeSubsFromTree =
    categoryTree[FIXED_INCOME_CATEGORY] ?? [...DEFAULT_FIXED_INCOME_SUBS];
  const defaultSubs = isIncome
    ? incomeSubsFromTree
    : (categoryTree[defaultCategory] ?? ["기타"]);

  const [editingId, setEditingId] = useState<number | null>(null);
  /** 목록에서 탭해 수정·삭제를 보여줄 항목 */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [subcategory, setSubcategory] = useState(defaultSubs[0] ?? "기타");
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const subs = useMemo(() => {
    if (isIncome) {
      return (
        categoryTree[FIXED_INCOME_CATEGORY] ?? [...DEFAULT_FIXED_INCOME_SUBS]
      );
    }
    return categoryTree[category] ?? ["기타"];
  }, [isIncome, categoryTree, category]);

  // 시작일 빠른 순 (수입/지출 모드에 맞게 필터)
  const sortedRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      isIncome
        ? row.category === FIXED_INCOME_CATEGORY
        : row.category !== FIXED_INCOME_CATEGORY,
    );
    return [...filtered].sort((a, b) => {
      const byDate = a.start_date.localeCompare(b.start_date);
      if (byDate !== 0) return byDate;
      return a.id - b.id;
    });
  }, [rows, isIncome]);

  const totalAmount = useMemo(
    () => sortedRows.reduce((sum, row) => sum + row.amount, 0),
    [sortedRows],
  );

  useEffect(() => {
    if (!subs.includes(subcategory)) {
      setSubcategory(subs[0] ?? "기타");
    }
  }, [subs, subcategory]);

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setAmount("");
    setCategory(defaultCategory);
    setSubcategory(defaultSubs[0] ?? "기타");
    setIntervalMonths("1");
    setStartDate("");
    setFormError(null);
    setShowForm(false);
  }

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시트 닫힐 때만 초기화
  }, [open]);

  function startAdd() {
    setSelectedId(null);
    setEditingId(null);
    setDescription("");
    setAmount("");
    setCategory(defaultCategory);
    setSubcategory(defaultSubs[0] ?? "기타");
    setIntervalMonths("1");
    setStartDate(koreaToday());
    setFormError(null);
    setShowForm(true);
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

  function toggleSelect(id: number) {
    setSelectedId((prev) => (prev === id ? null : id));
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
    if (!startDate) {
      setFormError("시작일을 선택해 주세요.");
      return;
    }
    const err = await onSave({
      id: editingId ?? undefined,
      description: description.trim(),
      amount: n,
      category: isIncome ? FIXED_INCOME_CATEGORY : category,
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

  if (!open) return null;

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
            {title}
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
            {isIncome
              ? "주기마다 수입으로 자동 저장됩니다. 개월 수로 주기를 정하세요."
              : "주기마다 지출에 자동 저장됩니다. 개월 수로 주기를 정하세요."}
          </p>

          {isIncome && onCategoriesChanged && (
            <FixedIncomeSubEditor
              rows={categoryRows}
              busy={busy}
              onChanged={onCategoriesChanged}
            />
          )}

          {error && (
            <p className="mb-2 rounded-xl bg-[#fff4e5] px-3 py-2 text-[12px] text-[#8a6116]">
              {error}
              {" · "}
              Supabase에서 create_recurring_expenses.sql을 실행했는지 확인해
              주세요.
            </p>
          )}

          <button
            type="button"
            onClick={startAdd}
            disabled={busy}
            className="mb-3 w-full rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white disabled:opacity-40"
          >
            {title} 추가
          </button>

          <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-3.5 py-2.5">
            <p className="text-[13px] font-medium text-[#86868b]">총 합계</p>
            <p className="text-[15px] font-semibold tabular-nums text-[#1d1d1f] [font-feature-settings:'zero'_0]">
              {formatAmount(totalAmount)}
              <span className="ml-0.5 text-[12px] font-normal text-[#86868b]">
                원
              </span>
            </p>
          </div>

          {loading ? (
            <p className="py-8 text-center text-[13px] text-[#86868b]">
              불러오는 중...
            </p>
          ) : sortedRows.length === 0 ? (
            <p className="rounded-2xl bg-[#f5f5f7] px-3 py-6 text-center text-[13px] text-[#86868b]">
              등록된 {title}이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedRows.map((row) => {
                const isSelected = selectedId === row.id;
                return (
                  <li
                    key={row.id}
                    className={`rounded-2xl bg-[#f5f5f7] px-3 py-1.5 ${
                      isSelected ? "ring-1 ring-black/10" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelect(row.id)}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[14px] font-medium text-[#1d1d1f]">
                          {row.description}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {row.start_date} · {row.interval_months}개월마다 ·{" "}
                          {row.category}_{row.subcategory}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] font-medium tabular-nums text-[#1d1d1f] [font-feature-settings:'zero'_0]">
                        {formatAmount(row.amount)}
                        <span className="ml-0.5 text-[11px] font-normal text-[#86868b]">
                          원
                        </span>
                      </p>
                    </button>
                    {isSelected && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(row)}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1d1d1f] disabled:opacity-40"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `"${row.description}" ${title}을 삭제할까요? (이미 저장된 내역은 그대로 둡니다)`,
                              )
                            ) {
                              void onDelete(row.id).then(() => {
                                setSelectedId(null);
                              });
                            }
                          }}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#b42318] disabled:opacity-40"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 추가·수정: 화면 가운데 모달 (목록 스크롤과 무관하게 보임) */}
      {showForm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => {
            if (!busy) resetForm();
          }}
        >
          <form
            {...noAutofillFormProps}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-form-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleSubmit(e)}
            className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
          >
            <p
              id="recurring-form-title"
              className="mb-3 text-[15px] font-semibold text-[#1d1d1f]"
            >
              {editingId ? `${title} 수정` : `${title} 추가`}
            </p>
            <div className="relative space-y-2.5">
              <AutofillDecoys />
              <NoAutofillInput
                name="recurring-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="내용 (예: 넷플릭스)"
                className={fieldClass}
                disabled={busy}
                autoFocus
              />
              <NoAutofillInput
                type="number"
                inputMode="numeric"
                name="recurring-amount"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액"
                className={fieldClass}
                disabled={busy}
              />
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
              <label className="block">
                <span className="mb-1 block text-[12px] text-[#86868b]">
                  주기 (개월 수 직접 입력)
                </span>
                <div className="flex items-center gap-2">
                  <NoAutofillInput
                    type="number"
                    inputMode="numeric"
                    name="recurring-interval"
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
                <NoAutofillInput
                  type="date"
                  name="recurring-start-date"
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
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
