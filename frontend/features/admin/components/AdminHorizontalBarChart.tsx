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

type AdminHorizontalBarChartProps = {
  data: { label: string; value: number }[];
  valueLabel?: string;
  color?: string;
  /** Max rows to show (longest labels stay readable). */
  maxRows?: number;
};

/**
 * Category / ranking bars — labels on the Y axis so long names are not date-truncated
 * or clipped the way vertical X-axis ticks are.
 */
export function AdminHorizontalBarChart({
  data,
  valueLabel = "Count",
  color = "var(--color-primary, #7c3aed)",
  maxRows = 6,
}: AdminHorizontalBarChartProps) {
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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e5e5" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#737373" }} />
        <YAxis
          type="category"
          dataKey="shortLabel"
          width={112}
          tick={{ fontSize: 11, fill: "#525252" }}
          interval={0}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          formatter={(value) => [value ?? 0, valueLabel]}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { label?: string } | undefined;
            return row?.label ?? "";
          }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
