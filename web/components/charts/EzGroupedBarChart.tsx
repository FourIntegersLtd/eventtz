"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisDate } from "./chartUtils";

type EzGroupedBarChartProps = {
  data: { date: string; clients: number; vendors: number }[];
};

/** Clients-versus-vendors signups per period, one pair of bars per date. */
export function EzGroupedBarChart({ data }: EzGroupedBarChartProps) {
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
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--ez-line)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="clients" name="Clients" fill="var(--ez-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="vendors" name="Vendors" fill="var(--ez-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
