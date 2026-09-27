"use client";

import { useState } from "react";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Short display for a date chip, e.g. "20 Sep 2026". */
function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateChipLabel(dates: string[], dateFlexible: boolean): string {
  if (dateFlexible) return "Flexible dates";
  if (dates.length === 0) return "Date";
  if (dates.length === 1) return formatShortDate(dates[0]!);
  return `${dates.length} dates`;
}

type MarketplaceDateFilterFieldsProps = {
  dates: string[];
  dateFlexible: boolean;
  onChange: (next: { dates: string[]; dateFlexible: boolean }) => void;
};

/** Date filter section inside the filters drawer. */
export function MarketplaceDateFilterFields({
  dates,
  dateFlexible,
  onChange,
}: MarketplaceDateFilterFieldsProps) {
  const [draftEventDate, setDraftEventDate] = useState("");
  const [datePickerError, setDatePickerError] = useState<string | null>(null);

  const addDate = (iso: string) => {
    if (!iso) return;
    const today = todayIsoDate();
    if (iso < today) {
      setDatePickerError("Date must be today or later");
      return;
    }
    setDatePickerError(null);
    if (dateFlexible) {
      onChange({ dates: [iso], dateFlexible: false });
    } else if (!dates.includes(iso)) {
      onChange({ dates: [...dates, iso].slice(0, 3), dateFlexible: false });
    }
    setDraftEventDate("");
  };

  const removeDate = (iso: string) => {
    onChange({ dates: dates.filter((d) => d !== iso), dateFlexible });
  };

  const toggleFlexible = () => {
    onChange({
      dates: !dateFlexible ? [] : dates,
      dateFlexible: !dateFlexible,
    });
    setDraftEventDate("");
    setDatePickerError(null);
  };

  return (
    <div>
      {dates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => removeDate(d)}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {formatShortDate(d)} &times;
            </button>
          ))}
        </div>
      ) : null}

      {dates.length < 3 && !dateFlexible ? (
        <div className={dates.length > 0 ? "mt-3 min-w-0" : "min-w-0"}>
          <input
            type="date"
            value={draftEventDate}
            min={todayIsoDate()}
            onChange={(e) => {
              const iso = e.target.value;
              setDraftEventDate(iso);
              if (iso) addDate(iso);
            }}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-900 outline-none ring-primary/15 focus:border-primary focus:bg-white focus:ring-2 md:text-sm"
          />
        </div>
      ) : null}

      {datePickerError ? (
        <p className="mt-2 text-xs font-medium text-red-600">{datePickerError}</p>
      ) : null}

      <button
        type="button"
        onClick={toggleFlexible}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
          dateFlexible
            ? "border-primary/30 bg-primary/10 font-medium text-primary"
            : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100"
        }`}
      >
        I&apos;m flexible on dates
      </button>
    </div>
  );
}
