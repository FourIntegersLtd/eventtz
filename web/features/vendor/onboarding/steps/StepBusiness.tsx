"use client";

import { useState } from "react";
import {
  EVENT_TYPE_IDS_ALL,
  EVENT_TYPE_OPTIONS,
  BUSINESS_STEP_SERVICE_CHIPS,
  VENDOR_WAITLIST_URL,
} from "../../../../lib/vendorOnboarding/constants";
import { STEP_COPY } from "../onboardingCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { checkBusinessNameAvailable } from "@/lib/vendorProfileApi";
import { Modal } from "@/components/ui/Modal";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Chip } from "../../../../components/ui/Chip";
import { TextField } from "../../../../components/ui/TextField";
import { TextArea } from "../../../../components/ui/TextArea";

export type StepBusinessProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  businessNameError: string | null;
  setBusinessNameError: (v: string | null) => void;
  /** Drafts the public bio with the AI helper (needs the earlier steps filled in). */
  onGenerateBioWithAI?: () => void | Promise<void>;
  generatingBio?: boolean;
};

/** Soft cap shown beside the public bio; the 100-word rule in validation still applies. */
const BIO_MAX_CHARACTERS = 600;

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
  onGenerateBioWithAI,
  generatingBio,
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

  const bioLength = data.aiBioDraft.length;

  return (
    <div className="ez-stack">
      <TextField
        label="Business name"
        value={data.businessName}
        onChange={({ target: { value } }) => {
          update({ businessName: value });
          setBusinessNameError(null);
          setNameAvailable(null);
        }}
        onBlur={() => void verifyBusinessName(data.businessName)}
        error={checkingName ? null : businessNameError}
        hint={
          checkingName ? "Checking availability…" : copy.businessNameSupporting
        }
      />
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.servicesHeadline}</span>
        <span className="ez-help">{copy.servicesSubtext}</span>
        <div className="ez-chip-row">
          {BUSINESS_STEP_SERVICE_CHIPS.map((option) => (
            <Chip
              key={`${option.value}-${option.label}`}
              active={data.servicesOffered.includes(option.value)}
              onClick={() => {
                if (option.value === "other") {
                  setWaitlistModalOpen(true);
                  return;
                }
                update({
                  servicesOffered: selectService(data.servicesOffered, option.value),
                });
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.eventTypesHeadline}</span>
        <div className="ez-chip-row">
          {EVENT_TYPE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={isEventTypeActive(data.eventTypes, option.value)}
              onClick={() =>
                update({
                  eventTypes: toggleEventType(data.eventTypes, option.value),
                })
              }
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>
      <TextArea
        label="About your business"
        value={data.aiBioDraft}
        maxLength={BIO_MAX_CHARACTERS}
        onChange={({ target: { value } }) => update({ aiBioDraft: value })}
        hint={`${bioLength} of ${BIO_MAX_CHARACTERS} characters. Clients read this first.`}
      />
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
