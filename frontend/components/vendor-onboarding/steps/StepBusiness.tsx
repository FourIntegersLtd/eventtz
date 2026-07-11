import {
  EVENT_TYPE_IDS_ALL,
  EVENT_TYPE_OPTIONS,
  SERVICE_OPTIONS,
  VENDOR_WAITLIST_URL,
} from "../constants";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import { labelClass, inputClass, ToggleChip } from "./form-primitives";

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
  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">
          Business details
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Tell us who you are and what you offer.
        </p>
      </div>
      <div>
        <label className={labelClass()}>Business name</label>
        <input
          className={inputClass()}
          value={data.businessName}
          onChange={(e) => {
            update({ businessName: e.target.value });
            setBusinessNameError(null);
          }}
          onBlur={() => {
            const name = data.businessName.trim().toLowerCase();
            if (name === "taken vendor" || name === "duplicate") {
              setBusinessNameError("This business name is already registered.");
            }
          }}
        />
        {businessNameError && (
          <p className="mt-1 text-sm text-red-600">{businessNameError}</p>
        )}
        <p className="mt-1 text-xs text-neutral-400">
          Must be unique — we check when you leave this field (demo: try
          &quot;taken vendor&quot;).
        </p>
      </div>
      <div>
        <span className={labelClass()}>Services offered</span>
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
        <p className="mt-2 text-xs text-neutral-500">
          Choose Other if you don&apos;t fit these categories — we&apos;ll open our
          waitlist form in a new page so we can follow up.
        </p>
      </div>
      <div>
        <span className={labelClass()}>Event types</span>
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
      </div>
    </div>
  );
}
