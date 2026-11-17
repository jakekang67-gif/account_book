"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthLabel } from "@/lib/reports";

type MonthlyBarChartProps = {
  data: Array<{ month: string; total: number }>;
};

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function shortMonthLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return month ? `${Number(month)}월` : monthKey;
}

/** 월별 총 지출 막대그래프 */
export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  // 차트는 오래된 달 → 최신 달 순으로 보이게
  const chartData = [...data]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      label: shortMonthLabel(row.month),
      fullLabel: formatMonthLabel(row.month),
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
          <Bar
            dataKey="total"
            fill="#1d1d1f"
            radius={[8, 8, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
