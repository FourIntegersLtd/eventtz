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
import { checkBusinessNameAvailable } from "@/lib/vendorProfileApi";
import { Modal } from "@/components/ui/Modal";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { EzChip, EzTextField } from "./ez-form";

export type StepBusinessProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  businessNameError: string | null;
  setBusinessNameError: (v: string | null) => void;
  /** Opens the "What we need here" guide; omitted where the page title already offers it. */
  onOpenStepInfo?: () => void;
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
  onOpenStepInfo,
  onGenerateBioWithAI,
  generatingBio,
}: StepBusinessProps) {
  const copy = STEP_COPY[2];
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const selectedServiceOption = SERVICE_OPTIONS.find(
    (option) => option.value === data.servicesOffered[0],
  );

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
      <EzTextField
        label="Business name"
        value={data.businessName}
        onChange={(value) => {
          update({ businessName: value });
          setBusinessNameError(null);
          setNameAvailable(null);
        }}
        onBlur={() => void verifyBusinessName(data.businessName)}
        error={checkingName ? null : businessNameError}
        help={
          checkingName
            ? "Checking availability…"
            : nameAvailable
              ? "This business name is available."
              : copy.businessNameSupporting
        }
      />
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.servicesHeadline}</span>
        <span className="ez-help">{copy.servicesSubtext}</span>
        <div className="ez-chip-row">
          {SERVICE_OPTIONS.map((option) => (
            <EzChip
              key={option.value}
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
            </EzChip>
          ))}
        </div>
        {/* Examples for the picked category only, so a vendor whose product has no obvious home (gele, hijab, barbering…) can check it fits. */}
        {selectedServiceOption?.examples ? (
          <span className="ez-help">
            {selectedServiceOption.label}: e.g. {selectedServiceOption.examples}
          </span>
        ) : null}
        {onOpenStepInfo ? (
          <a
            className="ez-link"
            href="#"
            style={{ fontSize: 14 }}
            onClick={(event) => {
              event.preventDefault();
              onOpenStepInfo();
            }}
          >
            What we need here
          </a>
        ) : null}
      </div>
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.eventTypesHeadline}</span>
        <div className="ez-chip-row">
          {EVENT_TYPE_OPTIONS.map((option) => (
            <EzChip
              key={option.value}
              active={isEventTypeActive(data.eventTypes, option.value)}
              onClick={() =>
                update({
                  eventTypes: toggleEventType(data.eventTypes, option.value),
                })
              }
            >
              {option.label}
            </EzChip>
          ))}
        </div>
      </div>
      <EzTextField
        label="About your business"
        multiline
        value={data.aiBioDraft}
        maxLength={BIO_MAX_CHARACTERS}
        onChange={(value) => update({ aiBioDraft: value })}
        help={`${bioLength} of ${BIO_MAX_CHARACTERS} characters. Clients read this first.`}
      />
      {onGenerateBioWithAI ? (
        <button
          type="button"
          className="ez-link"
          style={{ fontSize: 14, alignSelf: "flex-start", background: "none", border: 0, padding: 0, cursor: "pointer" }}
          disabled={generatingBio}
          onClick={() => void onGenerateBioWithAI()}
        >
          {generatingBio ? "Generating…" : "Write it with AI"}
        </button>
      ) : null}

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
