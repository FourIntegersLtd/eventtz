import { LocationAutocompleteInput } from "@/components/ui/LocationAutocompleteInput";
import { RADIUS_OPTIONS } from "../constants";
import { STEP_COPY } from "../onboardingCopy";
import type {
  DeliveryMode,
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../types";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { OnboardingOptionPill } from "../ui/OnboardingOptionPill";
import { inputClass, labelClass, ToggleChip } from "./form-primitives";

export type StepLocationProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

const DELIVERY_OPTIONS: { value: DeliveryMode; label: string }[] = [
  { value: "travel_to_client", label: "I travel to the client" },
  { value: "client_comes", label: "Clients come to me" },
  { value: "ship_to_client", label: "I deliver to clients (e.g. courier)" },
];

const TRAVEL_DELIVERY_POLICY_OPTIONS: {
  value: TravelDeliveryPolicy;
  label: string;
}[] = [
  {
    value: "fee_included",
    label: "Travel/delivery fee included (default)",
  },
  {
    value: "free_within_base_city",
    label:
      "Free delivery within base city (extra charges may apply outside this area)",
  },
  {
    value: "fee_after_booking_request",
    label: "Travel/delivery fee will be provided after booking request",
  },
  {
    value: "not_applicable",
    label: "Not applicable",
  },
  {
    value: "custom",
    label: "Custom — I'll describe my own rule",
  },
];

function toggleDeliveryMode(
  current: DeliveryMode[],
  value: DeliveryMode,
): DeliveryMode[] {
  return current.includes(value)
    ? current.filter((x) => x !== value)
    : [...current, value];
}

export function StepLocation({ data, update }: StepLocationProps) {
  const copy = STEP_COPY[3];

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />
      <OnboardingSubQuestion headline="Where is your base city?" indexOffset={3}>
        <LocationAutocompleteInput
          label="Base city"
          inputId="onboarding-base-city"
          value={data.baseCity}
          onChange={(next) => update({ baseCity: next })}
          placeholder="e.g. London, Manchester, Birmingham"
          helpText="Suggestions are UK places — pick one or keep typing your own area."
        />
      </OnboardingSubQuestion>
      <OnboardingSubQuestion
        headline={copy.deliveryHeadline}
        subtext={copy.deliverySubtext}
        indexOffset={6}
      >
        <div className="flex flex-wrap gap-2">
          {DELIVERY_OPTIONS.map(({ value, label }) => (
            <ToggleChip
              key={value}
              active={data.deliveryModes.includes(value)}
              onClick={() =>
                update({
                  deliveryModes: toggleDeliveryMode(data.deliveryModes, value),
                })
              }
            >
              {label}
            </ToggleChip>
          ))}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline={copy.radiusHeadline} indexOffset={9}>
        <div className="space-y-2">
          {RADIUS_OPTIONS.map((o) => (
            <OnboardingOptionPill
              key={o.value}
              active={data.travelRadius === o.value}
              onClick={() =>
                update({
                  travelRadius: o.value as VendorOnboardingData["travelRadius"],
                })
              }
              description={o.context}
            >
              {o.label}
            </OnboardingOptionPill>
          ))}
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion
        headline={copy.policyHeadline}
        subtext={copy.policySubtext}
        indexOffset={12}
      >
        <div className="space-y-2">
          {TRAVEL_DELIVERY_POLICY_OPTIONS.map(({ value, label }) => (
            <OnboardingOptionPill
              key={value}
              active={data.travelDeliveryPolicy === value}
              onClick={() => update({ travelDeliveryPolicy: value })}
            >
              {label}
            </OnboardingOptionPill>
          ))}
        </div>
        {data.travelDeliveryPolicy === "custom" ? (
          <div className="mt-4">
            <label className={labelClass()}>Describe your travel / delivery rule</label>
            <textarea
              className={`${inputClass()} mt-1.5 min-h-[80px]`}
              value={data.travelDeliveryPolicyCustomText}
              onChange={(e) =>
                update({ travelDeliveryPolicyCustomText: e.target.value })
              }
              placeholder="e.g. £1.50 per mile beyond 10 miles from base city"
            />
          </div>
        ) : null}
      </OnboardingSubQuestion>
    </div>
  );
}
