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

type AdminGroupedBarChartProps = {
  data: { date: string; clients: number; vendors: number }[];
};

export function AdminGroupedBarChart({ data }: AdminGroupedBarChartProps) {
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
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="clients" name="Clients" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="vendors" name="Vendors" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
