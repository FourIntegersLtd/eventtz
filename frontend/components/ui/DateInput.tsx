"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";
import {
  dayOptions,
  isoToParts,
  monthLabel,
  monthOptions,
  partsToIso,
  yearOptions,
} from "@/lib/isoDateParts";
import { todayIsoDate } from "@/lib/eventDateValidation";

export type DateInputProps = {
  id?: string;
  value?: string;
  defaultValue?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
  shellClassName?: string;
  /** Admin-style filters: start blank until the user picks a date. */
  allowEmpty?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

type PartState = {
  day: string;
  month: string;
  year: string;
};

function partsFromIso(iso: string | undefined, allowEmpty: boolean, min: string): PartState {
  const parsed = iso ? isoToParts(iso) : null;
  if (parsed) {
    return {
      day: String(parsed.day),
      month: String(parsed.month),
      year: String(parsed.year),
    };
  }
  if (allowEmpty) {
    return { day: "", month: "", year: "" };
  }
  const fallback = isoToParts(min) ?? isoToParts(todayIsoDate())!;
  return {
    day: String(fallback.day),
    month: String(fallback.month),
    year: String(fallback.year),
  };
}

function emitChange(onChange: DateInputProps["onChange"], iso: string) {
  if (!onChange) return;
  onChange({ target: { value: iso } } as ChangeEvent<HTMLInputElement>);
}

const selectClass = (className: string) =>
  `box-border h-11 min-w-0 w-full max-w-full appearance-none rounded-lg border border-neutral-200 bg-white px-1.5 py-2 text-[13px] text-neutral-900 sm:px-2 sm:text-sm ${FOCUS_RING} ${RADIUS.sm} ${className}`.trim();

/**
 * Cross-browser date picker (day / month / year selects).
 * Avoids Safari iOS `input[type=date]` overflow and inconsistent chrome.
 */
export function DateInput({
  id,
  value,
  defaultValue,
  min = todayIsoDate(),
  disabled = false,
  className = "",
  shellClassName = "",
  allowEmpty = false,
  onChange,
}: DateInputProps) {
  const groupId = useId();
  const isControlled = value !== undefined;
  const [parts, setParts] = useState<PartState>(() =>
    partsFromIso(isControlled ? value : defaultValue, allowEmpty, min),
  );

  useEffect(() => {
    if (!isControlled) return;
    setParts(partsFromIso(value, allowEmpty, min));
  }, [allowEmpty, isControlled, min, value]);

  const numeric = useMemo(() => {
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    return {
      year: Number.isFinite(year) ? year : 0,
      month: Number.isFinite(month) ? month : 0,
      day: Number.isFinite(day) ? day : 0,
    };
  }, [parts.day, parts.month, parts.year]);

  const years = yearOptions(min);
  const months = numeric.year ? monthOptions(numeric.year, min) : monthOptions(new Date().getFullYear(), min);
  const days = numeric.year && numeric.month ? dayOptions(numeric.year, numeric.month, min) : [];

  const updateParts = (next: PartState) => {
    setParts(next);
    const iso = partsToIso(Number(next.year), Number(next.month), Number(next.day));
    if (iso) emitChange(onChange, iso);
    else if (allowEmpty && (!next.day || !next.month || !next.year)) emitChange(onChange, "");
  };

  const handlePart =
    (key: keyof PartState) => (event: ChangeEvent<HTMLSelectElement>) => {
      const next = { ...parts, [key]: event.target.value };
      if (next.year && next.month && next.day) {
        const iso = partsToIso(Number(next.year), Number(next.month), Number(next.day));
        if (iso) {
          const validDays = dayOptions(Number(next.year), Number(next.month), min);
          if (!validDays.includes(Number(next.day))) {
            next.day = String(validDays[0] ?? "");
          }
        }
      }
      updateParts(next);
    };

  const fieldId = id ?? groupId;

  return (
    <div className={`date-picker-shell min-w-0 max-w-full ${shellClassName}`.trim()} role="group" aria-labelledby={fieldId}>
      <span id={fieldId} className="sr-only">
        Date
      </span>
      <div className={`date-picker-grid ${className}`.trim()}>
        <select
          aria-label="Day"
          disabled={disabled}
          value={parts.day}
          onChange={handlePart("day")}
          className={selectClass("")}
        >
          {allowEmpty ? <option value="">Day</option> : null}
          {(numeric.year && numeric.month ? days : Array.from({ length: 31 }, (_, i) => i + 1)).map(
            (day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ),
          )}
        </select>
        <select
          aria-label="Month"
          disabled={disabled}
          value={parts.month}
          onChange={handlePart("month")}
          className={selectClass("")}
        >
          {allowEmpty ? <option value="">Month</option> : null}
          {months.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          disabled={disabled}
          value={parts.year}
          onChange={handlePart("year")}
          className={selectClass("")}
        >
          {allowEmpty ? <option value="">Year</option> : null}
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
