import { LocationAutocompleteInput } from "@/features/vendor/onboarding/ui/LocationAutocompleteInput";
import { enabledMarkets, getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { STEP_COPY } from "../onboardingCopy";
import type {
  DeliveryMode,
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../types";
import { EzChip, EzOption, EzTextField } from "./ez-form";

export type StepLocationProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
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

function hasBothDirections(modes: DeliveryMode[]): boolean {
  return (
    modes.includes("travel_both") ||
    (modes.includes("travel_to_client") && modes.includes("client_comes"))
  );
}

function isDeliveryModeActive(modes: DeliveryMode[], value: DeliveryMode): boolean {
  if (value === "travel_both") return hasBothDirections(modes);
  if (value === "travel_to_client" || value === "client_comes") {
    // Combined option owns the highlight when both directions apply.
    if (hasBothDirections(modes)) return false;
    return modes.includes(value);
  }
  return modes.includes(value);
}

function toggleDeliveryMode(
  current: DeliveryMode[],
  value: DeliveryMode,
): DeliveryMode[] {
  if (value === "travel_both") {
    if (hasBothDirections(current)) {
      return current.filter(
        (x) => x !== "travel_both" && x !== "travel_to_client" && x !== "client_comes",
      );
    }
    return [
      ...current.filter((x) => x !== "travel_to_client" && x !== "client_comes"),
      "travel_both",
    ];
  }
  if (value === "travel_to_client" || value === "client_comes") {
    const withoutBoth = current.filter((x) => x !== "travel_both");
    return withoutBoth.includes(value)
      ? withoutBoth.filter((x) => x !== value)
      : [...withoutBoth, value];
  }
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
        {DELIVERY_OPTIONS.map(({ value, label }) => (
          <EzOption
            key={value}
            type="checkbox"
            name="deliv"
            checked={isDeliveryModeActive(data.deliveryModes, value)}
            onChange={() =>
              update({
                deliveryModes: toggleDeliveryMode(data.deliveryModes, value),
              })
            }
            title={label}
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
        {TRAVEL_DELIVERY_POLICY_OPTIONS.map(({ value, label }) => (
          <EzOption
            key={value}
            type="radio"
            name="fee"
            checked={data.travelDeliveryPolicy === value}
            onChange={() => update({ travelDeliveryPolicy: value })}
            title={label}
          />
        ))}
        {data.travelDeliveryPolicy === "custom" ? (
          <EzTextField
            label="Describe your travel / delivery rule"
            value={data.travelDeliveryPolicyCustomText}
            onChange={(value) => update({ travelDeliveryPolicyCustomText: value })}
            placeholder={`e.g. £1.50 per ${distanceUnit === "km" ? "kilometre" : "mile"} beyond 10 ${distanceUnit} from base city`}
          />
        ) : null}
      </div>
    </div>
  );
}
