"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadExpensesExcel,
  type ExcelExpenseRow,
} from "@/lib/excel";

type AppMenuProps = {
  expenses: ExcelExpenseRow[];
  onOpenCategoryEditor?: () => void;
  onOpenBudgetList?: () => void;
  onOpenMonthSummary?: () => void;
  onOpenRecurring?: () => void;
  onOpenInstallHelp?: () => void;
  onOpenChatCleanup?: () => void;
  onOpenChatNotice?: () => void;
  /** 메뉴 열림/닫힘 — 차트 겹침 방지용 */
  onOpenChange?: (open: boolean) => void;
  accountEmail?: string | null;
  onSignOut?: () => void;
};

export function AppMenu({
  expenses,
  onOpenCategoryEditor,
  onOpenBudgetList,
  onOpenMonthSummary,
  onOpenRecurring,
  onOpenInstallHelp,
  onOpenChatCleanup,
  onOpenChatNotice,
  onOpenChange,
  accountEmail,
  onSignOut,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function setMenuOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // setMenuOpen는 open/onOpenChange에 묶이므로 리스너만 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpenChange]);

  function handleDownload() {
    if (expenses.length === 0) {
      setStatus("내보낼 지출 내역이 없습니다.");
      return;
    }
    downloadExpensesExcel(expenses);
    setStatus("엑셀 파일을 다운로드했습니다.");
    setMenuOpen(false);
  }

  return (
    <div className="relative z-[110]" ref={menuRef}>
      <button
        type="button"
        aria-label="메뉴"
        onClick={() => setMenuOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1d1d1f] hover:bg-[#f5f5f7]"
      >
        <span className="text-[20px] leading-none">☰</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[120] w-64 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="border-b border-black/5 px-3 py-2.5">
            <p className="text-[12px] text-[#86868b]">
              {accountEmail
                ? `로그인: ${accountEmail}`
                : "가계부 미로그인"}
            </p>
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                엑셀 다운로드
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenMonthSummary?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                이번 달 수입·지출
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenRecurring?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                정기 지출
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenBudgetList?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                월 예산 목록
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChatNotice?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                안내 다시 보기
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChatCleanup?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                채팅 삭제
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenInstallHelp?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                홈화면에 추가 안내
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCategoryEditor?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                카테고리 편집
              </button>
            </li>
            {onSignOut && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-3 py-2.5 text-left text-[14px] text-[#b42318] hover:bg-[#f5f5f7]"
                >
                  로그아웃
                </button>
              </li>
            )}
          </ul>
          {status && (
            <p className="border-t border-black/5 px-3 py-2 text-[12px] leading-relaxed text-[#86868b]">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
