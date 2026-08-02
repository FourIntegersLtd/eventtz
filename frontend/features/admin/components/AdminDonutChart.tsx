"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#94a3b8"];

type AdminDonutChartProps = {
  data: { name: string; value: number; color?: string }[];
  /** Override the center label (defaults to sum of values). */
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
  /** Chart height in px. */
  height?: number;
};

export function AdminDonutChart({
  data,
  centerLabel,
  valueFormatter,
  height = 220,
}: AdminDonutChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  const center = centerLabel ?? (valueFormatter ? valueFormatter(total) : String(total));
  const slices = filtered.length ? filtered : [{ name: "None", value: 1 }];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={2}
        >
          {slices.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={
                filtered.length
                  ? (entry.color ?? COLORS[i % COLORS.length])
                  : "#e5e5e5"
              }
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          formatter={(value, name) => [
            valueFormatter ? valueFormatter(Number(value ?? 0)) : (value ?? 0),
            name,
          ]}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-neutral-900 text-sm font-semibold"
        >
          {center}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
