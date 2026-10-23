"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisDate } from "./chartUtils";

type EzAreaChartProps = {
  data: { date: string; value: number }[];
  valueLabel?: string;
};

function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** Single-series area chart over dates (e.g. revenue per day), drawn in the `--ez-chart-1` token. */
export function EzAreaChart({ data, valueLabel = "Value" }: EzAreaChartProps) {
  const fillId = useId().replace(/:/g, "");
  const chartData = data.map((d) => ({
    ...d,
    label: formatAxisDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ez-chart-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--ez-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ez-line)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--ez-ink-3)" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--ez-ink-3)" }}
          width={40}
          tickFormatter={(v) => (v >= 1000 ? `£${Math.round(v / 1000)}k` : `£${v}`)}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--ez-line)" }}
          formatter={(value) => [formatGbp(Number(value ?? 0)), valueLabel]}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { date?: string } | undefined;
            return row?.date ?? "";
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--ez-chart-1)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
