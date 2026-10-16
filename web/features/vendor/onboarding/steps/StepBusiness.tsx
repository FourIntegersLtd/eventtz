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
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { checkBusinessNameAvailable } from "@/lib/vendorProfileApi";
import { Modal } from "@/components/ui/Modal";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { ClearableTextField, labelClass, ToggleChip } from "./form-primitives";

export type StepBusinessProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  businessNameError: string | null;
  setBusinessNameError: (v: string | null) => void;
};

/** Single service selection - tap again to clear. Other opens the waitlist modal instead. */
function selectService(current: string[], value: string): string[] {
  if (value === "other") return current;
  return current[0] === value ? [] : [value];
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
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);

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
      <OnboardingSubQuestion headline="Your business name" indexOffset={0}>
        <div>
          <label className={labelClass()}>Business name</label>
          <ClearableTextField
            value={data.businessName}
            onChange={(v) => {
              update({ businessName: v });
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
        indexOffset={3}
      >
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((o) => (
            <ToggleChip
              key={o.value}
              active={data.servicesOffered.includes(o.value)}
              onClick={() => {
                if (o.value === "other") {
                  setWaitlistModalOpen(true);
                  return;
                }
                update({
                  servicesOffered: selectService(data.servicesOffered, o.value),
                });
              }}
            >
              {o.label}
            </ToggleChip>
          ))}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline={copy.eventTypesHeadline} indexOffset={6}>
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

      <Modal
        isOpen={waitlistModalOpen}
        onClose={() => setWaitlistModalOpen(false)}
        title="Category not available yet"
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setWaitlistModalOpen(false)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(VENDOR_WAITLIST_URL, "_blank", "noopener,noreferrer");
                setWaitlistModalOpen(false);
              }}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Join the waitlist
            </button>
          </div>
        }
      >
        <LottieIllustration asset="launchingSoon" className="mb-4 h-28 w-28" />
        <p className="text-sm leading-relaxed text-neutral-700">
          We&apos;re not onboarding vendors in unlisted categories yet. Join the waitlist and
          we&apos;ll be in touch.
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          To continue now, pick the closest listed category.
        </p>
      </Modal>
    </div>
  );
}
