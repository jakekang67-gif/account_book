"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CategoryItemRow } from "@/lib/categoryStore";
import {
  addCategory,
  addSubcategory,
  deleteCategory,
  deleteSubcategory,
} from "@/lib/categoryStore";
import type { CategoryTree } from "@/lib/categories";
import { noAutofillFormProps, noAutofillProps } from "@/lib/noAutofill";

type CategoryEditorProps = {
  open: boolean;
  rows: CategoryItemRow[];
  tree: CategoryTree;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function CategoryEditor({
  open,
  rows,
  tree,
  onClose,
  onChanged,
}: CategoryEditorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categories = useMemo(() => Object.keys(tree).sort(), [tree]);

  const activeCategory =
    selectedCategory && tree[selectedCategory]
      ? selectedCategory
      : categories[0] ?? "";

  const activeSubs = useMemo(() => {
    if (!activeCategory) return [] as CategoryItemRow[];
    return rows.filter((row) => row.category === activeCategory);
  }, [rows, activeCategory]);

  if (!open) return null;

  async function run(action: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    if (result.error) {
      setMessage(result.error);
      setBusy(false);
      return;
    }
    await onChanged();
    setBusy(false);
  }

  async function handleAddCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) {
      setMessage("대분류 이름을 입력해 주세요.");
      return;
    }
    await run(() => addCategory(name, "기타"));
    setNewCategory("");
    setSelectedCategory(name);
    setMessage(`대분류 "${name}"을(를) 추가했습니다.`);
  }

  async function handleAddSubcategory(event: FormEvent) {
    event.preventDefault();
    if (!activeCategory) {
      setMessage("대분류를 먼저 선택해 주세요.");
      return;
    }
    const name = newSubcategory.trim();
    if (!name) {
      setMessage("소분류 이름을 입력해 주세요.");
      return;
    }
    await run(() => addSubcategory(activeCategory, name));
    setNewSubcategory("");
    setMessage(`소분류 "${name}"을(를) 추가했습니다.`);
  }

  async function handleDeleteSub(row: CategoryItemRow) {
    if (!window.confirm(`소분류 "${row.subcategory}"을(를) 삭제할까요?`)) {
      return;
    }
    await run(() => deleteSubcategory(row.id));
    setMessage(`소분류 "${row.subcategory}"을(를) 삭제했습니다.`);
  }

  async function handleDeleteCategory() {
    if (!activeCategory) return;
    if (
      !window.confirm(
        `대분류 "${activeCategory}"와 하위 소분류를 모두 삭제할까요?`,
      )
    ) {
      return;
    }
    await run(() => deleteCategory(activeCategory));
    setSelectedCategory("");
    setMessage(`대분류 "${activeCategory}"을(를) 삭제했습니다.`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
            카테고리 편집
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-[#86868b] hover:bg-[#f5f5f7]"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <form
            {...noAutofillFormProps}
            onSubmit={handleAddCategory}
            className="space-y-2"
          >
            <p className="text-[13px] font-medium text-[#1d1d1f]">대분류 추가</p>
            <div className="flex gap-2">
              <input
                {...noAutofillProps}
                name="category-new-name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="예: 여행"
                disabled={busy}
                className="min-h-10 flex-1 rounded-xl bg-[#f5f5f7] px-3 text-[14px] outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#1d1d1f] px-3 text-[13px] font-medium text-white disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#1d1d1f]">대분류 선택</p>
              <button
                type="button"
                onClick={() => void handleDeleteCategory()}
                disabled={busy || !activeCategory}
                className="text-[12px] font-medium text-[#b42318] disabled:opacity-40"
              >
                대분류 삭제
              </button>
            </div>
            <select
              value={activeCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={busy || categories.length === 0}
              className="min-h-10 w-full rounded-xl bg-[#f5f5f7] px-3 text-[14px] outline-none"
            >
              {categories.length === 0 ? (
                <option value="">카테고리 없음</option>
              ) : (
                categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))
              )}
            </select>
          </div>

          <form
            {...noAutofillFormProps}
            onSubmit={handleAddSubcategory}
            className="space-y-2"
          >
            <p className="text-[13px] font-medium text-[#1d1d1f]">소분류 추가</p>
            <div className="flex gap-2">
              <input
                {...noAutofillProps}
                name="subcategory-new-name"
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                placeholder="예: 항공권"
                disabled={busy || !activeCategory}
                className="min-h-10 flex-1 rounded-xl bg-[#f5f5f7] px-3 text-[14px] outline-none"
              />
              <button
                type="submit"
                disabled={busy || !activeCategory}
                className="rounded-xl bg-[#1d1d1f] px-3 text-[13px] font-medium text-white disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-[#1d1d1f]">
              {activeCategory ? `${activeCategory} 소분류` : "소분류"}
            </p>
            {activeSubs.length === 0 ? (
              <p className="rounded-xl bg-[#f5f5f7] px-3 py-4 text-center text-[13px] text-[#86868b]">
                소분류가 없습니다.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {activeSubs.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2.5"
                  >
                    <span className="text-[14px] text-[#1d1d1f]">
                      {row.subcategory}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteSub(row)}
                      className="text-[12px] font-medium text-[#b42318] disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {message && (
            <p className="text-[12px] leading-relaxed text-[#86868b]">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
