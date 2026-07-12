"use client";

import { useState } from "react";
import {
  EVENT_TYPE_IDS_ALL,
  EVENT_TYPE_OPTIONS,
  SERVICE_OPTIONS,
  VENDOR_WAITLIST_URL,
} from "../constants";
import { STEP_COPY } from "../onboardingCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { checkBusinessNameAvailable } from "@/lib/vendorProfileApi";
import { inputClass, labelClass, ToggleChip } from "./form-primitives";

export type StepBusinessProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  businessNameError: string | null;
  setBusinessNameError: (v: string | null) => void;
};

/** Other is exclusive: choosing a category clears Other; choosing Other clears categories. */
function toggleService(current: string[], value: string): string[] {
  if (value === "other") {
    return current.includes("other") ? [] : ["other"];
  }
  const withoutOther = current.filter((x) => x !== "other");
  return withoutOther.includes(value)
    ? withoutOther.filter((x) => x !== value)
    : [...withoutOther, value];
}

function isEventTypeActive(eventTypes: string[], value: string): boolean {
  if (value === "all") return eventTypes.includes("all");
  return eventTypes.includes("all") || eventTypes.includes(value);
}

function toggleEventType(current: string[], value: string): string[] {
  if (value === "all") {
    if (current.includes("all")) {
      return [];
    }
    return [...EVENT_TYPE_IDS_ALL, "all"];
  }
  const base = current.filter((x) => x !== "all");
  if (base.includes(value)) {
    return base.filter((x) => x !== value);
  }
  const next = [...base, value];
  if (EVENT_TYPE_IDS_ALL.every((id) => next.includes(id))) {
    return [...next, "all"];
  }
  return next;
}

export function StepBusiness({
  data,
  update,
  businessNameError,
  setBusinessNameError,
}: StepBusinessProps) {
  const copy = STEP_COPY[2];
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  const verifyBusinessName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setBusinessNameError(null);
      setNameAvailable(null);
      return;
    }
    setCheckingName(true);
    setNameAvailable(null);
    try {
      const { available } = await checkBusinessNameAvailable(trimmed);
      if (available) {
        setBusinessNameError(null);
        setNameAvailable(true);
      } else {
        setBusinessNameError("This business name is already registered.");
        setNameAvailable(false);
      }
    } catch {
      setNameAvailable(null);
      // Save will enforce on the server if the check fails.
    } finally {
      setCheckingName(false);
    }
  };

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />
      <OnboardingSubQuestion headline="Your business name" indexOffset={3}>
        <div>
          <label className={labelClass()}>Business name</label>
          <input
            className={inputClass()}
            value={data.businessName}
            onChange={(e) => {
              update({ businessName: e.target.value });
              setBusinessNameError(null);
              setNameAvailable(null);
            }}
            onBlur={() => void verifyBusinessName(data.businessName)}
          />
          {checkingName && (
            <p className="mt-1 text-xs text-neutral-500">Checking availability…</p>
          )}
          {!checkingName && businessNameError && (
            <p className="mt-1 text-sm text-red-600">{businessNameError}</p>
          )}
          {!checkingName && !businessNameError && nameAvailable && (
            <p className="mt-1 text-sm text-green-600">This business name is available.</p>
          )}
          {!checkingName && !businessNameError && !nameAvailable && (
            <p className="mt-1 text-xs text-neutral-400">{copy.businessNameSupporting}</p>
          )}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion
        headline={copy.servicesHeadline}
        subtext={copy.servicesSubtext}
        indexOffset={6}
      >
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((o) => (
            <ToggleChip
              key={o.value}
              active={data.servicesOffered.includes(o.value)}
              onClick={() => {
                const selectingOther = o.value === "other";
                const currentlyHasOther = data.servicesOffered.includes("other");
                if (selectingOther && !currentlyHasOther) {
                  window.open(VENDOR_WAITLIST_URL, "_blank", "noopener,noreferrer");
                }
                update({
                  servicesOffered: toggleService(data.servicesOffered, o.value),
                });
              }}
            >
              {o.label}
            </ToggleChip>
          ))}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline={copy.eventTypesHeadline} indexOffset={9}>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map((o) => (
            <ToggleChip
              key={o.value}
              active={isEventTypeActive(data.eventTypes, o.value)}
              onClick={() =>
                update({
                  eventTypes: toggleEventType(data.eventTypes, o.value),
                })
              }
            >
              {o.label}
            </ToggleChip>
          ))}
        </div>
      </OnboardingSubQuestion>
    </div>
  );
}
