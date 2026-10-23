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

type EzHorizontalBarChartProps = {
  data: { label: string; value: number; color?: string }[];
  valueLabel?: string;
  color?: string;
  /** Max rows to show (longest labels stay readable). */
  maxRows?: number;
};

/**
 * Category / ranking bars - labels on the Y axis so long names are not date-truncated
 * or clipped the way vertical X-axis ticks are.
 */
/** Ranked horizontal bars for a short list of named counts. */
export function EzHorizontalBarChart({
  data,
  valueLabel = "Count",
  color = "var(--ez-chart-1)",
  maxRows = 6,
}: EzHorizontalBarChartProps) {
  const chartData = data.slice(0, maxRows).map((d) => ({
    ...d,
    shortLabel: d.label.length > 18 ? `${d.label.slice(0, 16)}…` : d.label,
  }));
  const height = Math.max(180, chartData.length * 36 + 24);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--ez-line)" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--ez-ink-3)" }} />
        <YAxis
          type="category"
          dataKey="shortLabel"
          width={112}
          tick={{ fontSize: 11, fill: "var(--ez-ink-2)" }}
          interval={0}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--ez-line)" }}
          formatter={(value) => [value ?? 0, valueLabel]}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { label?: string } | undefined;
            return row?.label ?? "";
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((entry) => (
            <Cell key={entry.label} fill={entry.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
