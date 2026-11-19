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
  /** YYYY-MM — 당월 막대는 하늘색 */
  currentMonth?: string;
};

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function shortMonthLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return month ? `${Number(month)}월` : monthKey;
}

/** 당월: 연한 하늘색. 그 외: 월(1~12)별 구분 색 */
const CURRENT_MONTH_FILL = "#8ec5f7";
const MONTH_FILLS = [
  "#f4a261", // 1
  "#e9c46a", // 2
  "#2a9d8f", // 3
  "#e76f51", // 4
  "#90be6d", // 5
  "#43aa8b", // 6
  "#f9844a", // 7
  "#577590", // 8
  "#f94144", // 9
  "#4d908e", // 10
  "#f3722c", // 11
  "#277da1", // 12
] as const;

function fillForMonth(monthKey: string, currentMonth?: string) {
  if (currentMonth && monthKey === currentMonth) return CURRENT_MONTH_FILL;
  const monthNum = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return "#86868b";
  }
  return MONTH_FILLS[monthNum - 1];
}

/** 월별 총 지출 막대그래프 */
export function MonthlyBarChart({ data, currentMonth }: MonthlyBarChartProps) {
  // 차트는 오래된 달 → 최신 달 순으로 보이게
  const chartData = [...data]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      label: shortMonthLabel(row.month),
      fullLabel: formatMonthLabel(row.month),
      fill: fillForMonth(row.month, currentMonth),
    }));

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
              "총 지출",
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
