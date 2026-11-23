"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CategoryItemRow } from "@/lib/categoryStore";
import {
  addSubcategory,
  deleteSubcategory,
  renameSubcategory,
} from "@/lib/categoryStore";
import { FIXED_INCOME_CATEGORY } from "@/lib/categories";
import {
  AutofillDecoys,
  NoAutofillInput,
} from "@/components/NoAutofillField";
import { noAutofillFormProps } from "@/lib/noAutofill";

type FixedIncomeSubEditorProps = {
  rows: CategoryItemRow[];
  busy?: boolean;
  onChanged: () => Promise<void>;
};

/** 정기 수입용 — 대분류 「고정 수입」은 고정, 소분류만 추가·수정·삭제 */
export function FixedIncomeSubEditor({
  rows,
  busy: parentBusy,
  onChanged,
}: FixedIncomeSubEditorProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const subs = useMemo(
    () => rows.filter((r) => r.category === FIXED_INCOME_CATEGORY),
    [rows],
  );

  const locked = busy || parentBusy;

  async function run(action: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    if (result.error) {
      setMessage(result.error);
      setBusy(false);
      return false;
    }
    await onChanged();
    setBusy(false);
    return true;
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setMessage("소분류 이름을 입력해 주세요.");
      return;
    }
    const ok = await run(() => addSubcategory(FIXED_INCOME_CATEGORY, name));
    if (ok) {
      setNewName("");
      setMessage(`「${name}」을(를) 추가했습니다.`);
    }
  }

  async function handleRename(row: CategoryItemRow) {
    const name = editName.trim();
    if (!name) {
      setMessage("소분류 이름을 입력해 주세요.");
      return;
    }
    const ok = await run(() => renameSubcategory(row.id, name));
    if (ok) {
      setEditingId(null);
      setEditName("");
      setMessage(`「${row.subcategory}」→「${name}」으로 바꿨습니다.`);
    }
  }

  async function handleDelete(row: CategoryItemRow) {
    if (!window.confirm(`소분류 「${row.subcategory}」을(를) 삭제할까요?`)) {
      return;
    }
    const ok = await run(() => deleteSubcategory(row.id));
    if (ok) {
      setMessage(`「${row.subcategory}」을(를) 삭제했습니다.`);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-black/5 bg-[#fafafa] px-3 py-3">
      <p className="text-[13px] font-semibold text-[#1d1d1f]">
        고정 수입 · 소분류 편집
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[#86868b]">
        대분류 「고정 수입」은 그대로 두고, 소분류만 추가·수정·삭제합니다.
      </p>

      <ul className="mt-2 space-y-1">
        {subs.length === 0 ? (
          <li className="py-2 text-center text-[12px] text-[#86868b]">
            소분류가 없습니다. 아래에서 추가해 주세요.
          </li>
        ) : (
          subs.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-1.5 rounded-xl bg-white px-2 py-1.5"
            >
              {editingId === row.id ? (
                <>
                  <NoAutofillInput
                    name={`income-sub-edit-${row.id}`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-h-8 min-w-0 flex-1 rounded-lg bg-[#f5f5f7] px-2 text-[13px] outline-none"
                    disabled={locked}
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void handleRename(row)}
                    className="shrink-0 rounded-lg bg-[#1d1d1f] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                    className="shrink-0 rounded-lg bg-[#f5f5f7] px-2 py-1 text-[11px] text-[#1d1d1f]"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[#1d1d1f]">
                    {row.subcategory}
                  </span>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setEditingId(row.id);
                      setEditName(row.subcategory);
                    }}
                    className="shrink-0 text-[11px] font-medium text-[#1d1d1f] disabled:opacity-40"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void handleDelete(row)}
                    className="shrink-0 text-[11px] font-medium text-[#b42318] disabled:opacity-40"
                  >
                    삭제
                  </button>
                </>
              )}
            </li>
          ))
        )}
      </ul>

      <form
        {...noAutofillFormProps}
        onSubmit={(e) => void handleAdd(e)}
        className="relative mt-2 flex gap-1.5"
      >
        <AutofillDecoys />
        <NoAutofillInput
          name="income-sub-new"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 소분류 (예: 보너스)"
          disabled={locked}
          className="min-h-9 min-w-0 flex-1 rounded-xl bg-white px-2.5 text-[13px] outline-none ring-1 ring-black/5"
        />
        <button
          type="submit"
          disabled={locked}
          className="shrink-0 rounded-xl bg-[#1d1d1f] px-3 text-[12px] font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
      </form>

      {message && (
        <p className="mt-2 text-[11px] leading-relaxed text-[#86868b]">
          {message}
        </p>
      )}
    </div>
  );
}
