"use client";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown beside the label; hidden when zero or absent. */
  count?: number;
};

export type TabsProps<T extends string> = {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label": string;
};

/** Underline tab bar (controlled, `ez-tabs`). Use SegmentedControl for compact filter rows instead. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className = "",
  ...aria
}: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={aria["aria-label"]} className={`ez-tabs ${className}`.trim()}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`ez-tab${active ? " ez-tab--active" : ""}`}
          >
            {option.label}
            {option.count != null && option.count > 0 ? (
              <span className="ez-tab__count">{option.count > 99 ? "99+" : option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
