"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/** Series colours: the design-language chart tokens (see design/canvas/project/eventtz.css). */
const COLORS = [
  "var(--ez-chart-1)",
  "var(--ez-chart-2)",
  "var(--ez-chart-3)",
  "var(--ez-chart-4)",
  "var(--ez-chart-5)",
];

type EzDonutChartProps = {
  data: { name: string; value: number; color?: string }[];
  /** Override the center label (defaults to sum of values). */
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
  /** Chart height in px. */
  height?: number;
};

/** Donut with a centre total; slices cycle through the `--ez-chart-1..5` tokens unless a slice sets `color`. */
export function EzDonutChart({
  data,
  centerLabel,
  valueFormatter,
  height = 220,
}: EzDonutChartProps) {
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
                  : "var(--ez-line)"
              }
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--ez-line)" }}
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
          className="fill-ink text-sm font-semibold"
        >
          {center}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
