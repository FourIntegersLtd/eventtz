export type ProgressBarProps = {
  /** Filled share, 0 to 100; values outside are clamped. */
  percent: number;
  /** Accessible name; when set the bar is announced as a progressbar, otherwise it is decorative. */
  label?: string;
};

/** Thin brand progress bar (`ez-progress`). The width is data, so it is the one inline style. */
export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const meaning = label
    ? { role: "progressbar", "aria-label": label, "aria-valuenow": clamped, "aria-valuemin": 0, "aria-valuemax": 100 }
    : { "aria-hidden": true };
  return (
    <div className="ez-progress" {...meaning}>
      <div className="ez-progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  );
}
