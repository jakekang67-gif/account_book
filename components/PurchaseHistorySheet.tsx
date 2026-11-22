"use client";

import { useEffect, useMemo, useState } from "react";
import { NoAutofillInput } from "@/components/NoAutofillField";

export type PurchaseHistoryItem = {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  subcategory: string | null;
};

type PurchaseHistorySheetProps = {
  open: boolean;
  items: PurchaseHistoryItem[];
  formatAmount: (n: number) => string;
  formatCategoryLabel: (item: PurchaseHistoryItem) => string | null;
  onClose: () => void;
  onSelectItem?: (item: PurchaseHistoryItem) => void;
  renderActions?: (item: PurchaseHistoryItem) => React.ReactNode;
  renderEditForm?: (item: PurchaseHistoryItem) => React.ReactNode;
  selectedId?: number | null;
  editingId?: number | null;
};

/** 구매 내역 전체·검색 */
export function PurchaseHistorySheet({
  open,
  items,
  formatAmount,
  formatCategoryLabel,
  onClose,
  onSelectItem,
  renderActions,
  renderEditForm,
  selectedId,
  editingId,
}: PurchaseHistorySheetProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "search">("all");
  /** 찾아보기 시 키보드 위 보이는 영역 (visualViewport) */
  const [visibleBox, setVisibleBox] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    const base =
      mode === "all" || !q
        ? items
        : items.filter((item) => {
            const hay = [
              item.description,
              item.date,
              item.category ?? "",
              item.subcategory ?? "",
              String(item.amount),
              formatAmount(item.amount),
            ]
              .join(" ")
              .toLowerCase()
              .replace(/\s+/g, "");
            return hay.includes(q);
          });
    // 구매 날짜 최신순 (같은 날이면 id 큰 순)
    return [...base].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.id - a.id;
    });
  }, [items, query, mode, formatAmount]);

  useEffect(() => {
    if (!open) {
      setMode("all");
      setQuery("");
      setVisibleBox(null);
      return;
    }
    if (mode !== "search") {
      setVisibleBox(null);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) {
      setVisibleBox({ top: 0, height: window.innerHeight });
      return;
    }

    const update = () => {
      // iOS 키보드: 보이는 영역만 시트로 써서 검색칸이 항상 위에 있게 함
      setVisibleBox({
        top: Math.round(vv.offsetTop),
        height: Math.round(vv.height),
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open, mode]);

  if (!open) return null;

  const searchPinnedTop = mode === "search";
  const overlayStyle =
    searchPinnedTop && visibleBox
      ? {
          top: visibleBox.top,
          height: visibleBox.height,
          bottom: "auto" as const,
        }
      : undefined;

  return (
    <div
      style={overlayStyle}
      className={`fixed inset-x-0 z-[65] flex justify-center bg-black/35 sm:p-4 ${
        searchPinnedTop
          ? "top-0 h-dvh items-stretch sm:items-stretch"
          : "inset-y-0 items-end sm:items-center"
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-history-title"
        className={`flex w-full max-w-md flex-col bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${
          searchPinnedTop
            ? "h-full max-h-full rounded-none sm:rounded-3xl"
            : "max-h-[85dvh] rounded-t-3xl sm:rounded-3xl"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-4 py-3">
          <h2
            id="purchase-history-title"
            className="text-[16px] font-semibold text-[#1d1d1f]"
          >
            구매 내역 확인
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-[#86868b]"
          >
            닫기
          </button>
        </div>

        <div className="flex shrink-0 gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={() => {
              setMode("all");
              setQuery("");
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              mode === "all"
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              mode === "search"
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#1d1d1f]"
            }`}
          >
            찾아보기
          </button>
        </div>

        {mode === "search" && (
          <div className="shrink-0 px-4 pt-3">
            <NoAutofillInput
              type="search"
              name="purchase-history-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="단어 입력 (예: 담배)"
              autoFocus
              enterKeyHint="search"
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:bg-[#ebebed]"
            />
          </div>
        )}

        <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <li className="rounded-2xl bg-[#f5f5f7] px-3 py-6 text-center text-[13px] text-[#86868b]">
              {items.length === 0
                ? "아직 저장된 내역이 없습니다."
                : "검색 결과가 없습니다."}
            </li>
          ) : (
            filtered.map((item) => {
              const categoryLabel = formatCategoryLabel(item);
              const isEditing = editingId === item.id;
              const isSelected = selectedId === item.id;

              if (isEditing && renderEditForm) {
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-black/5 bg-white px-3 py-2"
                  >
                    {renderEditForm(item)}
                  </li>
                );
              }

              return (
                <li
                  key={item.id}
                  className={`rounded-2xl bg-[#f5f5f7] px-3 py-1.5 ${
                    isSelected ? "ring-1 ring-black/10" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectItem?.(item)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-[14px] font-medium text-[#1d1d1f]">
                        {item.description}
                      </p>
                      <p className="text-[11px] text-[#86868b]">
                        {item.date}
                        {categoryLabel ? ` · ${categoryLabel}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-medium tabular-nums text-[#1d1d1f] [font-feature-settings:'zero'_0]">
                      {formatAmount(item.amount)}
                      <span className="ml-0.5 text-[11px] font-normal text-[#86868b]">
                        원
                      </span>
                    </p>
                  </button>
                  {isSelected && renderActions?.(item)}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
