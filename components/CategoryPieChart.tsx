"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type CategoryPieChartProps = {
  data: Array<{ category: string; total: number }>;
};

const COLORS = [
  "#1d1d1f",
  "#3a5a40",
  "#588157",
  "#a3b18a",
  "#bc6c25",
  "#dda15e",
  "#6c757d",
  "#495057",
  "#343a40",
  "#adb5bd",
];

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

/** 카테고리별 지출 원그래프 */
export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const chartData = data.map((row) => ({
    name: row.category,
    value: row.total,
  }));

  return (
    <div className="rounded-2xl bg-white px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
              formatter={(value, name) => [
                `${formatWon(Number(value ?? 0))}원`,
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 px-1 pb-1">
        {chartData.map((entry, index) => (
          <li
            key={entry.name}
            className="flex items-center gap-1.5 text-[12px] text-[#424245]"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            {entry.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
