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
import { formatAxisDate } from "./chartUtils";

type EzBarChartProps = {
  data: { date: string; value: number }[];
  valueLabel?: string;
  color?: string;
};

/** Single-series bar chart over dates; `color` takes any CSS colour, normally an `--ez-chart-N` token. */
export function EzBarChart({
  data,
  valueLabel = "Count",
  color = "var(--ez-chart-1)",
}: EzBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatAxisDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ez-line)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--ez-ink-3)" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--ez-ink-3)" }} width={32} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--ez-line)" }}
          formatter={(value) => [value ?? 0, valueLabel]}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { date?: string } | undefined;
            return row?.date ?? "";
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
