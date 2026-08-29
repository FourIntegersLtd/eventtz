"use client";

import { useState } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { formatEventDate } from "@/lib/dateFormat";
import { eventDatesSchema, parseForm } from "@/lib/validation";

export function dateChipLabel(dates: string[], dateFlexible: boolean): string {
  if (dateFlexible) return "Flexible dates";
  if (dates.length === 0) return "Date";
  if (dates.length === 1) return formatEventDate(dates[0]!);
  return `${dates.length} dates`;
}

type MarketplaceDateFilterFieldsProps = {
  dates: string[];
  dateFlexible: boolean;
  onChange: (next: { dates: string[]; dateFlexible: boolean }) => void;
  /** When true, picking a date closes the parent sheet (hero dropdown). */
  closeOnPick?: boolean;
  onClose?: () => void;
};

export function MarketplaceDateFilterFields({
  dates,
  dateFlexible,
  onChange,
  closeOnPick = false,
  onClose,
}: MarketplaceDateFilterFieldsProps) {
  const [draftEventDate, setDraftEventDate] = useState("");
  const [datePickerError, setDatePickerError] = useState<string | null>(null);

  const addDate = (iso: string) => {
    if (!iso) return;
    const parsed = parseForm(eventDatesSchema({ requireStart: true }), {
      eventDate: iso,
      eventEndDate: null,
    });
    if (!parsed.ok) {
      setDatePickerError(parsed.fieldErrors.eventDate ?? parsed.formError);
      return;
    }
    setDatePickerError(null);
    if (dateFlexible) {
      onChange({ dates: [iso], dateFlexible: false });
    } else if (!dates.includes(iso)) {
      onChange({ dates: [...dates, iso].slice(0, 3), dateFlexible: false });
    }
    setDraftEventDate("");
    if (closeOnPick) onClose?.();
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
    if (closeOnPick) onClose?.();
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
              {formatEventDate(d)} ×
            </button>
          ))}
        </div>
      ) : null}

      {dates.length < 3 && !dateFlexible ? (
        <div className={dates.length > 0 ? "mt-3 min-w-0" : "min-w-0"}>
          <DateInput
            value={draftEventDate}
            min={todayIsoDate()}
            allowEmpty
            onChange={(e) => {
              const iso = e.target.value;
              setDraftEventDate(iso);
              if (iso) addDate(iso);
            }}
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
