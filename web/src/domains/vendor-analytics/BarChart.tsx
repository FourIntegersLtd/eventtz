import type { ChartBar } from "@/domains/vendor-analytics/analyticsFormat";
import { seriesMax } from "@/domains/vendor-analytics/analyticsFormat";

/**
 * A hand-rolled monthly bar chart (`web/` has no charting dependency).
 *
 * One sequential hue (the app's primary colour) for a single magnitude
 * series, per the dataviz skill's form rules: thin bars with rounded
 * data-ends, a native `title` for the exact value on hover, and a visible
 * value label on request instead of one on every bar.
 */
export function BarChart({ bars, valueLabel, formatValue }: { bars: ChartBar[]; valueLabel: string; formatValue?: (value: number) => string }) {
  const max = seriesMax(bars);
  const format = formatValue ?? ((value: number) => String(value));

  if (bars.length === 0) {
    return <p className="text-sm text-neutral-500">No data for this period.</p>;
  }

  return (
    <div role="img" aria-label={`${valueLabel} by month`} className="flex h-32 items-end gap-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${bar.label}: ${format(bar.value)}`}>
          <div
            className="w-full rounded-t-md bg-primary"
            style={{ height: `${Math.max(4, Math.round((bar.value / max) * 100))}%` }}
          />
          <span className="text-[11px] text-neutral-500">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
