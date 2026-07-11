import { LocationAutocompleteInput } from "@/components/ui/LocationAutocompleteInput";
import { RADIUS_OPTIONS } from "../constants";
import type {
  DeliveryMode,
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../types";
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
    label:
      "Travel/delivery fee will be provided after booking request",
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
  const radiusContext = RADIUS_OPTIONS.find((o) => o.value === data.travelRadius)?.context;

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">
          Location & travel
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          How you reach clients shapes matching and fees. Select all that apply.
        </p>
      </div>
      <div>
        <LocationAutocompleteInput
          label="Base city"
          inputId="onboarding-base-city"
          value={data.baseCity}
          onChange={(next) => update({ baseCity: next })}
          placeholder="e.g. London, Manchester, Birmingham"
          helpText="Suggestions are UK places — pick one or keep typing your own area."
        />
      </div>
      <div>
        <span className={labelClass()}>How is your service provided?</span>
        <div className="mt-2 flex flex-wrap gap-2">
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
      </div>
      <div>
        <label className={labelClass()}>
          How far can you travel or deliver? (miles)
        </label>
        <select
          className={inputClass()}
          value={data.travelRadius}
          onChange={(e) =>
            update({
              travelRadius: e.target.value as VendorOnboardingData["travelRadius"],
            })
          }
        >
          <option value="">Select…</option>
          {RADIUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {radiusContext ? (
          <p className="mt-1.5 text-xs text-neutral-500">{radiusContext}</p>
        ) : null}
      </div>
      <div>
        <span className={labelClass()}>Default travel / delivery</span>
        <p className="mb-2 text-xs text-neutral-500">
          We&apos;ve pre-selected the most common option — change it if it doesn&apos;t
          match how you handle fees.
        </p>
        <div className="space-y-2">
          {TRAVEL_DELIVERY_POLICY_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-200/50 transition has-[:checked]:bg-primary/5 has-[:checked]:ring-primary/40 hover:bg-neutral-50"
            >
              <input
                type="radio"
                name="travelDeliveryPolicy"
                checked={data.travelDeliveryPolicy === value}
                onChange={() => update({ travelDeliveryPolicy: value })}
                className="mt-1 text-primary"
              />
              <span className="text-sm leading-snug text-neutral-800">
                {label}
              </span>
            </label>
          ))}
        </div>
        {data.travelDeliveryPolicy === "custom" ? (
          <div className="mt-3">
            <label className={labelClass()}>Describe your travel / delivery rule</label>
            <textarea
              className={`${inputClass()} min-h-[80px]`}
              value={data.travelDeliveryPolicyCustomText}
              onChange={(e) =>
                update({ travelDeliveryPolicyCustomText: e.target.value })
              }
              placeholder="e.g. £1.50 per mile beyond 10 miles from base city"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
