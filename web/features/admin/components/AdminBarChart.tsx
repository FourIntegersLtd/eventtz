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

type AdminBarChartProps = {
  data: { date: string; value: number }[];
  valueLabel?: string;
  color?: string;
};

export function AdminBarChart({
  data,
  valueLabel = "Count",
  color = "var(--color-primary, #7c3aed)",
}: AdminBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatAxisDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#737373" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#737373" }} width={32} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
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
