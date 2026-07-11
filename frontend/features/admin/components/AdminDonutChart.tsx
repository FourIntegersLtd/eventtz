"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#94a3b8"];

type AdminDonutChartProps = {
  data: { name: string; value: number }[];
};

export function AdminDonutChart({ data }: AdminDonutChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered.length ? filtered : [{ name: "None", value: 1 }]}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={2}
        >
          {(filtered.length ? filtered : [{ name: "None", value: 1 }]).map((entry, i) => (
            <Cell
              key={entry.name}
              fill={filtered.length ? COLORS[i % COLORS.length] : "#e5e5e5"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          formatter={(value, name) => [value ?? 0, name]}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-neutral-900 text-lg font-semibold"
        >
          {total}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
