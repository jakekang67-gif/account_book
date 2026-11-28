"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";
import {
  formatRecurringDisplayDescription,
  isRecurringExpenseDescription,
} from "@/lib/date";
import { isKoreanHoliday } from "@/lib/koreanHolidays";
import { isIncomeCategory, formatMonthLabel } from "@/lib/reports";

export type CalendarExpenseItem = {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  subcategory: string | null;
};

type CalendarKind =
  | "expense"
  | "fixed-expense"
  | "income"
  | "fixed-income";

const KIND_COLOR: Record<CalendarKind, string> = {
  expense: "#e53935",
  "fixed-expense": "#8d6e63",
  income: "#43a047",
  "fixed-income": "#29b6f6",
};

const KIND_LABEL: Record<CalendarKind, string> = {
  expense: "일반 지출",
  "fixed-expense": "고정 지출",
  income: "일반 수입",
  "fixed-income": "고정 수입",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 가로 스와이프로 달·일 넘김 (px). 세로 스크롤과 구분 */
const SWIPE_MIN_DX = 56;

type CalendarMonthViewProps = {
  monthKey: string;
  items: CalendarExpenseItem[];
  onMonthChange: (monthKey: string) => void;
};

function addMonthKey(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD 에 일수 더하기 */
function addDays(date: string, delta: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d + delta);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatAmountShort(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function classifyKind(item: CalendarExpenseItem): CalendarKind {
  const income = isIncomeCategory(item.category);
  const fixed = isRecurringExpenseDescription(item.description);
  if (income) return fixed ? "fixed-income" : "income";
  return fixed ? "fixed-expense" : "expense";
}

function displayName(item: CalendarExpenseItem) {
  const raw = formatRecurringDisplayDescription(item.description);
  // 표시용 [고정] 접두 제거 (본문만)
  return raw.replace(/^\[고정\]\s*/u, "").replace(/^\[정기\]\s*/u, "").trim() || raw;
}

function displayLabel(item: CalendarExpenseItem) {
  return `${displayName(item)} ${formatAmountShort(item.amount)}`;
}

function formatDayTitle(date: string) {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** 한국 달력(일요일 시작) — 지출·수입을 날짜 칸에 표시 */
export function CalendarMonthView({
  monthKey,
  items,
  onMonthChange,
}: CalendarMonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  /** 1=다음(왼쪽 밀기), -1=이전(오른쪽 밀기) */
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [slideAnimKey, setSlideAnimKey] = useState(0);
  const [daySlideAnimKey, setDaySlideAnimKey] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  /** 스와이프 직후 날짜 칸 click 오발 방지 */
  const suppressClickRef = useRef(false);
  const animatingRef = useRef(false);
  /** 일 이동으로 달이 바뀔 때 selectedDate 유지 */
  const keepDayOnMonthChangeRef = useRef(false);

  useEffect(() => {
    if (keepDayOnMonthChangeRef.current) {
      keepDayOnMonthChangeRef.current = false;
      return;
    }
    setSelectedDate(null);
  }, [monthKey]);

  function goMonth(delta: 1 | -1) {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setSlideDir(delta);
    setSlideAnimKey((k) => k + 1);
    onMonthChange(addMonthKey(monthKey, delta));
    window.setTimeout(() => {
      animatingRef.current = false;
    }, 300);
  }

  function goDay(delta: 1 | -1) {
    if (!selectedDate || animatingRef.current) return;
    animatingRef.current = true;
    setSlideDir(delta);
    setDaySlideAnimKey((k) => k + 1);
    const next = addDays(selectedDate, delta);
    const nextMonth = next.slice(0, 7);
    if (nextMonth !== monthKey) {
      keepDayOnMonthChangeRef.current = true;
      onMonthChange(nextMonth);
    }
    setSelectedDate(next);
    window.setTimeout(() => {
      animatingRef.current = false;
    }, 300);
  }

  function onSwipeTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function onSwipeTouchEnd(e: TouchEvent, mode: "month" | "day") {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DX) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.65) return;
    suppressClickRef.current = true;
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    if (mode === "day") goDay(dir);
    else goMonth(dir);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);
  }

  function onDayClick(date: string) {
    if (suppressClickRef.current) return;
    setSelectedDate(date);
  }

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarExpenseItem[]>();
    for (const item of items) {
      if (!item.date.startsWith(monthKey)) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.id - b.id);
    }
    return map;
  }, [items, monthKey]);

  /** 선택일이 다른 달로 넘어가도 합계용으로 전체 items에서 조회 */
  const detailItems = useMemo(() => {
    if (!selectedDate) return [];
    return items
      .filter((item) => item.date === selectedDate)
      .sort((a, b) => a.id - b.id);
  }, [items, selectedDate]);

  const dayExpenseTotal = useMemo(() => {
    return detailItems
      .filter((item) => !isIncomeCategory(item.category))
      .reduce((sum, item) => sum + item.amount, 0);
  }, [detailItems]);

  const dayIncomeTotal = useMemo(() => {
    return detailItems
      .filter((item) => isIncomeCategory(item.category))
      .reduce((sum, item) => sum + item.amount, 0);
  }, [detailItems]);

  const cells = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const out: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < total; i++) {
      const dayNum = i - startPad + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        out.push(null);
        continue;
      }
      const date = `${monthKey}-${String(dayNum).padStart(2, "0")}`;
      out.push({ day: dayNum, date });
    }
    return out;
  }, [monthKey]);

  const weekCount = cells.length / 7;

  const gridStyle = {
    gridTemplateRows: `auto repeat(${weekCount}, minmax(0, 1fr))`,
  } satisfies CSSProperties;

  if (selectedDate) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col bg-white px-3 pb-3 pt-2"
        onTouchStart={onSwipeTouchStart}
        onTouchEnd={(e) => onSwipeTouchEnd(e, "day")}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-black/5 pb-2">
          <button
            type="button"
            aria-label="이전 날"
            onClick={() => goDay(-1)}
            className="px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">
              {formatDayTitle(selectedDate)} 내역
            </h2>
            <p className="mt-0.5 text-[12px] tabular-nums text-[#86868b]">
              총지출{" "}
              <span className="font-medium text-[#e53935]">
                {formatAmountShort(dayExpenseTotal)}원
              </span>
              {dayIncomeTotal > 0 && (
                <>
                  {" · "}
                  수입{" "}
                  <span className="font-medium text-[#43a047]">
                    {formatAmountShort(dayIncomeTotal)}원
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="다음 날"
            onClick={() => goDay(1)}
            className="px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            ›
          </button>
        </div>

        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                "expense",
                "fixed-expense",
                "income",
                "fixed-income",
              ] as const
            ).map((kind) => (
              <span
                key={kind}
                className="px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: KIND_COLOR[kind] }}
              >
                {KIND_LABEL[kind]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(null)}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7]"
          >
            닫기
          </button>
        </div>

        <ul
          key={`${selectedDate}-${daySlideAnimKey}`}
          className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto ${
            daySlideAnimKey > 0
              ? slideDir === 1
                ? "cal-slide-next"
                : "cal-slide-prev"
              : ""
          }`}
        >
          {detailItems.length === 0 ? (
            <li className="rounded-xl bg-[#f5f5f7] px-3 py-6 text-center text-[13px] text-[#86868b]">
              이 날짜에 저장된 내역이 없습니다.
            </li>
          ) : (
            detailItems.map((item) => {
              const kind = classifyKind(item);
              const cat = [item.category, item.subcategory]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-[#f5f5f7] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[14px] font-medium"
                      style={{ color: KIND_COLOR[kind] }}
                    >
                      {formatRecurringDisplayDescription(item.description)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#86868b]">
                      {KIND_LABEL[kind]}
                      {cat ? ` · ${cat}` : ""}
                    </p>
                  </div>
                  <p
                    className="shrink-0 text-[14px] font-medium tabular-nums"
                    style={{ color: KIND_COLOR[kind] }}
                  >
                    {formatAmountShort(item.amount)}
                    <span className="ml-0.5 text-[11px] font-normal text-[#86868b]">
                      원
                    </span>
                  </p>
                </li>
              );
            })
          )}
        </ul>

        <p className="mt-2 shrink-0 text-center text-[11px] text-[#86868b]">
          좌우로 밀면 이전·다음 날로 이동합니다.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white px-1.5 pb-2 pt-1.5"
      onTouchStart={onSwipeTouchStart}
      onTouchEnd={(e) => onSwipeTouchEnd(e, "month")}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => goMonth(-1)}
          className="px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          ‹
        </button>
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1565c0]">
          {formatMonthLabel(monthKey)}
        </h2>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => goMonth(1)}
          className="px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          ›
        </button>
      </div>

      <div className="mb-1 flex shrink-0 flex-wrap justify-center gap-1 px-0.5">
        {(
          [
            "expense",
            "fixed-expense",
            "income",
            "fixed-income",
          ] as const
        ).map((kind) => (
          <span
            key={kind}
            className="px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: KIND_COLOR[kind] }}
          >
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>

      <div
        key={`${monthKey}-${slideAnimKey}`}
        className={`grid min-h-0 w-full flex-[0_0_72%] grid-cols-7 gap-px overflow-hidden border border-black/15 bg-black/15 ${
          slideAnimKey > 0
            ? slideDir === 1
              ? "cal-slide-next"
              : "cal-slide-prev"
            : ""
        }`}
        style={gridStyle}
      >
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className="flex items-center justify-center bg-[#f5f5f7] py-0.5 text-[11px] font-semibold leading-none"
            style={{
              color: i === 0 ? "#e53935" : i === 6 ? "#1565c0" : "#1d1d1f",
            }}
          >
            {wd}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return (
              <div key={`empty-${idx}`} className="min-h-0 bg-[#fafafa]" />
            );
          }
          const weekday = idx % 7;
          const holiday = isKoreanHoliday(cell.date);
          const dayColor =
            weekday === 0 || holiday
              ? "#e53935"
              : weekday === 6
                ? "#1565c0"
                : "#1d1d1f";
          const dayItems = byDate.get(cell.date) ?? [];

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onDayClick(cell.date)}
              className="flex min-h-0 flex-col overflow-hidden bg-white p-px text-left hover:bg-[#f8f8f8]"
            >
              <p
                className="shrink-0 text-center font-bold leading-none"
                style={{ color: dayColor, fontSize: "11px" }}
              >
                {cell.day}
              </p>
              <div className="min-h-0 flex-1 overflow-hidden">
                {dayItems.map((item) => {
                  const kind = classifyKind(item);
                  return (
                    <p
                      key={item.id}
                      className="w-full truncate tabular-nums leading-none"
                      style={{
                        color: KIND_COLOR[kind],
                        fontSize: "6px",
                        lineHeight: 1.15,
                      }}
                      title={displayLabel(item)}
                    >
                      {displayLabel(item)}
                    </p>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-auto shrink-0 px-1 pb-1 pt-2 text-center text-[12px] leading-snug text-[#86868b]">
        날짜를 누르면 그날 내역을 볼 수 있어요.
      </p>
    </div>
  );
}
