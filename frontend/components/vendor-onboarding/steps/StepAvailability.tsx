import { useState } from "react";
import { STEP_COPY } from "../onboardingCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { inputClass, ToggleChip } from "./form-primitives";
import { EVENT_DATE_PAST_ERROR, isPastIsoDate, todayIsoDate } from "@/lib/eventDateValidation";

export type StepAvailabilityProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

const WEEKDAY_FULL_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function toUkDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function StepAvailability({ data, update }: StepAvailabilityProps) {
  const copy = STEP_COPY[5];
  const [blockedDateError, setBlockedDateError] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    const s = new Set(data.availableWeekdays);
    if (s.has(d)) s.delete(d);
    else s.add(d);
    update({ availableWeekdays: [...s].sort() });
  };

  const allDays = [0, 1, 2, 3, 4, 5, 6] as const;
  const everyDaySelected =
    data.availableWeekdays.length === allDays.length &&
    allDays.every((d) => data.availableWeekdays.includes(d));

  const toggleEveryDay = () => {
    update({
      availableWeekdays: everyDaySelected ? [] : [...allDays],
    });
  };

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />
      <OnboardingSubQuestion headline={copy.daysHeadline} indexOffset={3}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleEveryDay}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              everyDaySelected
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            Every day
          </button>
          {WEEKDAY_FULL_LABELS.map((label, i) => (
            <ToggleChip
              key={i}
              active={data.availableWeekdays.includes(i)}
              onClick={() => toggleDay(i)}
            >
              {label}
            </ToggleChip>
          ))}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion
        headline={copy.blockedHeadline}
        subtext={copy.blockedSubtext}
        indexOffset={6}
      >
        <input
          type="date"
          min={todayIsoDate()}
          className={inputClass()}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            if (isPastIsoDate(v)) {
              setBlockedDateError(EVENT_DATE_PAST_ERROR);
              e.target.value = "";
              return;
            }
            setBlockedDateError(null);
            if (!data.blockedDates.includes(v)) {
              update({ blockedDates: [...data.blockedDates, v] });
            }
            e.target.value = "";
          }}
        />
        {blockedDateError ? (
          <p className="mt-2 text-xs font-medium text-red-600">{blockedDateError}</p>
        ) : null}
        {data.blockedDates.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.blockedDates.map((d) => (
              <li
                key={d}
                className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs"
              >
                {toUkDate(d)}
                <button
                  type="button"
                  className="text-neutral-500 hover:text-red-600"
                  onClick={() =>
                    update({
                      blockedDates: data.blockedDates.filter((x) => x !== d),
                    })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline={copy.maxBookingsHeadline} indexOffset={9}>
        <input
          type="number"
          min={1}
          className={inputClass()}
          value={data.maxBookingsPerDay}
          onChange={(e) => update({ maxBookingsPerDay: e.target.value })}
        />
      </OnboardingSubQuestion>
    </div>
  );
}
