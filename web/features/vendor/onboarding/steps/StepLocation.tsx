import { LocationAutocompleteInput } from "@/components/ui/LocationAutocompleteInput";
import { enabledMarkets, getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { STEP_COPY } from "../onboardingCopy";
import type {
  DeliveryMode,
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../../../../lib/vendorOnboarding/types";
import { EzChip, EzOption, EzTextField } from "../../../../components/ui/ez-form";

export type StepLocationProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  /** Wizard screens use the shorter delivery and fee option sets from the V03 artboard. */
  useOnboardingLayout?: boolean;
};

const DELIVERY_OPTIONS: { value: DeliveryMode; label: string }[] = [
  { value: "travel_to_client", label: "I travel to the client" },
  { value: "client_comes", label: "Clients come to me" },
  {
    value: "travel_both",
    label: "I travel to clients and clients also travel to me",
  },
  { value: "ship_to_client", label: "I deliver to clients (e.g. courier)" },
];

/** V03 artboard copy for the onboarding wizard. */
const ONBOARDING_DELIVERY_OPTIONS: {
  value: DeliveryMode;
  title: string;
  description: string;
}[] = [
  {
    value: "travel_to_client",
    title: "I travel to the event",
    description: "Cooked on site or delivered to the venue.",
  },
  {
    value: "client_comes",
    title: "Clients come to me",
    description: "Collection from my kitchen.",
  },
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
    label: "Custom - I'll describe my own rule",
  },
];

const ONBOARDING_TRAVEL_FEE_OPTIONS: {
  value: TravelDeliveryPolicy;
  title: string;
  description: string;
}[] = [
  {
    value: "fee_included",
    title: "Included in my prices",
    description: "No extra charge to the client.",
  },
  {
    value: "custom",
    title: "Charge per mile beyond 10 miles",
    description: "Shown to clients before they enquire.",
  },
];

/** A delivery option is on only when that exact mode is stored. */
export function isDeliveryModeActive(modes: DeliveryMode[], value: DeliveryMode): boolean {
  return modes.includes(value);
}

/** Adds or removes the option that was clicked, and leaves the others alone. */
export function toggleDeliveryMode(
  current: DeliveryMode[],
  value: DeliveryMode,
): DeliveryMode[] {
  return current.includes(value)
    ? current.filter((mode) => mode !== value)
    : [...current, value];
}

export function StepLocation({
  data,
  update,
  useOnboardingLayout = true,
}: StepLocationProps) {
  const copy = STEP_COPY[3];
  const market = getMarket(data.countryCode);
  const markets = enabledMarkets();
  const showCountryPicker = markets.length > 1;
  const radiusOptions = radiusOptionsForMarket(market);
  const distanceUnit = market.distanceUnit === "km" ? "km" : "miles";
  const deliveryOptions = useOnboardingLayout
    ? ONBOARDING_DELIVERY_OPTIONS
    : DELIVERY_OPTIONS.map(({ value, label }) => ({ value, title: label }));
  const feeOptions = useOnboardingLayout
    ? ONBOARDING_TRAVEL_FEE_OPTIONS
    : TRAVEL_DELIVERY_POLICY_OPTIONS.map(({ value, label }) => ({
        value,
        title: label,
      }));

  return (
    <div className="ez-stack">
      {showCountryPicker ? (
        <div className="ez-stack ez-stack--sm">
          <span className="ez-label">Which country do you operate in?</span>
          <div className="ez-chip-row">
            {markets.map((candidate) => (
              <EzChip
                key={candidate.countryCode}
                active={data.countryCode === candidate.countryCode}
                onClick={() => update({ countryCode: candidate.countryCode })}
              >
                {candidate.label}
              </EzChip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="ez-form-grid">
        <LocationAutocompleteInput
          variant="ez"
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
        />
        <EzTextField
          label="Region"
          value={data.region}
          onChange={(value) => update({ region: value })}
          placeholder="e.g. Greater London"
        />
        <EzTextField
          label="Postcode"
          value={data.postalCode}
          onChange={(value) => update({ postalCode: value })}
          placeholder={market.countryCode === "GB" ? "e.g. SW1A 1AA" : "Postal code"}
        />
      </div>
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.deliveryHeadline}</span>
        <span className="ez-help">{copy.deliverySubtext}</span>
        {deliveryOptions.map((option) => (
          <EzOption
            key={option.value}
            type="checkbox"
            name="deliv"
            checked={isDeliveryModeActive(data.deliveryModes, option.value)}
            onChange={() =>
              update({
                deliveryModes: toggleDeliveryMode(data.deliveryModes, option.value),
              })
            }
            title={option.title}
            description={
              "description" in option && typeof option.description === "string"
                ? option.description
                : undefined
            }
          />
        ))}
      </div>
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.radiusHeadline}</span>
        <div className="ez-form-grid">
          {radiusOptions.map((option) => (
            <EzOption
              key={option.value}
              type="radio"
              name="rad"
              checked={data.travelRadius === option.value}
              onChange={() =>
                update({
                  travelRadius: option.value as VendorOnboardingData["travelRadius"],
                })
              }
              title={option.label}
              description={option.context}
            />
          ))}
        </div>
      </div>
      <div className="ez-stack ez-stack--sm">
        <span className="ez-label">{copy.policyHeadline}</span>
        <span className="ez-help">{copy.policySubtext}</span>
        {feeOptions.map((option) => (
          <EzOption
            key={option.value}
            type="radio"
            name="fee"
            checked={data.travelDeliveryPolicy === option.value}
            onChange={() => update({ travelDeliveryPolicy: option.value })}
            title={option.title}
            description={
              "description" in option && typeof option.description === "string"
                ? option.description
                : undefined
            }
          />
        ))}
        {data.travelDeliveryPolicy === "custom" ? (
          <EzTextField
            label={
              <>
                Fee details <span className="ez-label__opt">(optional)</span>
              </>
            }
            value={data.travelDeliveryPolicyCustomText}
            onChange={(value) => update({ travelDeliveryPolicyCustomText: value })}
            placeholder={
              useOnboardingLayout
                ? ""
                : `e.g. £1.50 per ${distanceUnit === "km" ? "kilometre" : "mile"} beyond 10 ${distanceUnit} from base city`
            }
          />
        ) : null}
      </div>
    </div>
  );
}
