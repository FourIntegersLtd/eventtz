import { LocationAutocompleteInput } from "@/components/ui/LocationAutocompleteInput";
import { enabledMarkets, getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
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
  const market = getMarket(data.countryCode);
  const markets = enabledMarkets();
  const showCountryPicker = markets.length > 1;
  const radiusOptions = radiusOptionsForMarket(market);
  const distanceUnit = market.distanceUnit === "km" ? "km" : "miles";

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />
      {showCountryPicker ? (
        <OnboardingSubQuestion headline="Which country do you operate in?" indexOffset={3}>
          <div className="flex flex-wrap gap-2">
            {markets.map((m) => (
              <ToggleChip
                key={m.countryCode}
                active={data.countryCode === m.countryCode}
                onClick={() => update({ countryCode: m.countryCode })}
              >
                {m.label}
              </ToggleChip>
            ))}
          </div>
        </OnboardingSubQuestion>
      ) : null}
      <OnboardingSubQuestion headline="Where is your base city?" indexOffset={showCountryPicker ? 4 : 3}>
        <LocationAutocompleteInput
          label="Base city"
          inputId="onboarding-base-city"
          value={data.baseCity}
          onChange={(next) => update({ baseCity: next })}
          countryCode={data.countryCode}
          placeholder={
            market.countryCode === "GB"
              ? "e.g. London, Manchester, Birmingham"
              : `e.g. a city in ${market.label}`
          }
          helpText={`Suggestions are places in ${market.label} — pick one or keep typing your own area.`}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass()} htmlFor="onboarding-region">
              Region / county <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="onboarding-region"
              type="text"
              className={`${inputClass()} mt-1.5`}
              value={data.region}
              onChange={(e) => update({ region: e.target.value })}
              placeholder="e.g. Greater London"
            />
          </div>
          <div>
            <label className={labelClass()} htmlFor="onboarding-postal">
              Postcode / ZIP <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="onboarding-postal"
              type="text"
              className={`${inputClass()} mt-1.5`}
              value={data.postalCode}
              onChange={(e) => update({ postalCode: e.target.value })}
              placeholder={market.countryCode === "GB" ? "e.g. SW1A 1AA" : "Postal code"}
            />
          </div>
        </div>
      </OnboardingSubQuestion>
      <OnboardingSubQuestion
        headline={copy.deliveryHeadline}
        subtext={copy.deliverySubtext}
        indexOffset={showCountryPicker ? 7 : 6}
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
      <OnboardingSubQuestion headline={copy.radiusHeadline} indexOffset={showCountryPicker ? 10 : 9}>
        <div className="space-y-2">
          {radiusOptions.map((o) => (
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
        indexOffset={showCountryPicker ? 13 : 12}
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
              placeholder={`e.g. £1.50 per ${distanceUnit === "km" ? "kilometre" : "mile"} beyond 10 ${distanceUnit} from base city`}
            />
          </div>
        ) : null}
      </OnboardingSubQuestion>
    </div>
  );
}
