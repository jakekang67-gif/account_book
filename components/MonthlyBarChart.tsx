"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthLabel } from "@/lib/reports";

type MonthlyBarChartProps = {
  data: Array<{ month: string; total: number }>;
  /** YYYY-MM — 당월 막대 강조 */
  currentMonth?: string;
  /** expense=적색 계열, income=기존(하늘·다색) 유지 */
  tone?: "expense" | "income";
};

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function shortMonthLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return month ? `${Number(month)}월` : monthKey;
}

/** 수입(기존): 당월 하늘색, 그 외 월별 구분 색 */
const INCOME_CURRENT_FILL = "#8ec5f7";
const INCOME_MONTH_FILLS = [
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#e76f51",
  "#90be6d",
  "#43aa8b",
  "#f9844a",
  "#577590",
  "#f94144",
  "#4d908e",
  "#f3722c",
  "#277da1",
] as const;

/** 지출: 적색·분홍 계열 */
const EXPENSE_CURRENT_FILL = "#e53935";
const EXPENSE_MONTH_FILLS = [
  "#ffcdd2",
  "#ef9a9a",
  "#e57373",
  "#ef5350",
  "#f44336",
  "#e53935",
  "#d32f2f",
  "#c62828",
  "#ff8a80",
  "#ff5252",
  "#ec407a",
  "#f06292",
] as const;

function fillForMonth(
  monthKey: string,
  currentMonth: string | undefined,
  tone: "expense" | "income",
) {
  const currentFill =
    tone === "expense" ? EXPENSE_CURRENT_FILL : INCOME_CURRENT_FILL;
  const monthFills =
    tone === "expense" ? EXPENSE_MONTH_FILLS : INCOME_MONTH_FILLS;
  if (currentMonth && monthKey === currentMonth) return currentFill;
  const monthNum = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return "#86868b";
  }
  return monthFills[monthNum - 1];
}

/** 월별 총 지출·수입 막대그래프 */
export function MonthlyBarChart({
  data,
  currentMonth,
  tone = "income",
}: MonthlyBarChartProps) {
  // 차트는 오래된 달 → 최신 달 순으로 보이게
  const chartData = [...data]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      label: shortMonthLabel(row.month),
      fullLabel: formatMonthLabel(row.month),
      fill: fillForMonth(row.month, currentMonth, tone),
    }));

  const valueLabel = tone === "expense" ? "총 지출" : "총 수입";

  return (
    <div className="h-56 w-full rounded-2xl bg-white px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ececef" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#86868b", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#86868b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) =>
              v >= 10_000 ? `${Math.round(v / 10_000)}만` : String(v)
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              fontSize: 13,
            }}
            formatter={(value) => [
              `${formatWon(Number(value ?? 0))}원`,
              valueLabel,
            ]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as
                | { fullLabel?: string }
                | undefined;
              return row?.fullLabel ?? "";
            }}
          />
          <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={36}>
            {chartData.map((row) => (
              <Cell key={row.month} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
