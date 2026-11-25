"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  formatRecurringDisplayDescription,
  isRecurringExpenseDescription,
} from "@/lib/date";
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

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

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

function formatAmountShort(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function classifyKind(item: CalendarExpenseItem): CalendarKind {
  const income = isIncomeCategory(item.category);
  const fixed = isRecurringExpenseDescription(item.description);
  if (income) return fixed ? "fixed-income" : "income";
  return fixed ? "fixed-expense" : "expense";
}

function displayLabel(item: CalendarExpenseItem) {
  const raw = formatRecurringDisplayDescription(item.description);
  // 달력 칸이 좁아 "[정기] "는 색으로 구분하고 본문만 짧게
  const name = raw.replace(/^\[정기\]\s*/u, "").trim() || raw;
  return `${name} ${formatAmountShort(item.amount)}`;
}

/** 칸 너비에 맞춰 글자 크기를 줄임 */
function AutoFitText({
  text,
  color,
  maxPx = 11,
  minPx = 7,
}: {
  text: string;
  color: string;
  maxPx?: number;
  minPx?: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(maxPx);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function fit() {
      if (!el) return;
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      while (size > minPx && el.scrollWidth > el.clientWidth + 1) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    }

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxPx, minPx]);

  return (
    <p
      ref={ref}
      className="w-full truncate leading-tight tabular-nums"
      style={{ color, fontSize: `${fontSize}px` }}
      title={text}
    >
      {text}
    </p>
  );
}

/** 한국 달력(일요일 시작) — 지출·수입을 날짜 칸에 표시 */
export function CalendarMonthView({
  monthKey,
  items,
  onMonthChange,
}: CalendarMonthViewProps) {
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

  const cells = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay(); // 0=일
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white px-2 pb-2 pt-2">
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-1">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => onMonthChange(addMonthKey(monthKey, -1))}
          className="rounded-lg px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          ‹
        </button>
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1565c0]">
          {formatMonthLabel(monthKey)}
        </h2>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => onMonthChange(addMonthKey(monthKey, 1))}
          className="rounded-lg px-2 py-1 text-[18px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
        >
          ›
        </button>
      </div>

      <div className="mb-1.5 flex shrink-0 flex-wrap justify-center gap-1.5 px-0.5">
        {(
          [
            { kind: "expense" as const, label: "일반 지출" },
            { kind: "fixed-expense" as const, label: "고정지출" },
            { kind: "income" as const, label: "일반수입" },
            { kind: "fixed-income" as const, label: "고정수입" },
          ] as const
        ).map((item) => (
          <span
            key={item.kind}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: KIND_COLOR[item.kind] }}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10"
        style={gridStyle}
      >
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className="flex items-center justify-center bg-[#f5f5f7] py-1 text-[11px] font-semibold"
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
          const dayColor =
            weekday === 0 ? "#e53935" : weekday === 6 ? "#1565c0" : "#1d1d1f";
          const dayItems = byDate.get(cell.date) ?? [];

          return (
            <div
              key={cell.date}
              className="flex min-h-0 flex-col gap-0.5 overflow-hidden bg-white p-0.5"
            >
              <p
                className="shrink-0 text-center text-[12px] font-bold leading-none"
                style={{ color: dayColor }}
              >
                {cell.day}
              </p>
              <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                {dayItems.map((item) => {
                  const kind = classifyKind(item);
                  return (
                    <AutoFitText
                      key={item.id}
                      text={displayLabel(item)}
                      color={KIND_COLOR[kind]}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
