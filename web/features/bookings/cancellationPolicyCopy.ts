/**
 * Client-cancellation policy presets and the lines describing them.
 * Keep this copy identical to the backend (api cancellation domain) so screens,
 * receipts and emails agree.
 */

export const CANCELLATION_POLICY_KEYS = ["flexible", "moderate", "strict"] as const;

export type CancellationPolicyKey = (typeof CANCELLATION_POLICY_KEYS)[number];

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyKey = "flexible";

export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicyKey, string> = {
  flexible: "Flexible",
  moderate: "Moderate",
  strict: "Strict",
};

/** One-line summaries shown beside each preset in the vendor form radios. */
export const CANCELLATION_POLICY_SUMMARIES: Record<CancellationPolicyKey, string> = {
  flexible: "Full refund up to 7 days before",
  moderate: "Full refund up to 30 days before",
  strict: "Full refund up to 90 days before, then 75% / 50% / none",
};

/** One refund tier: how long before the event the client cancels, and what comes back. */
export type CancellationPolicyTier = {
  /** "7 or more days before the event" */
  window: string;
  /** "Full refund", "50% refund" or "No refund" (of the vendor's price) */
  refund: string;
};

export const CANCELLATION_POLICY_TIERS: Record<CancellationPolicyKey, CancellationPolicyTier[]> = {
  flexible: [
    { window: "7 or more days before the event", refund: "Full refund" },
    { window: "2 to 6 days before the event", refund: "50% refund" },
    { window: "Less than 2 days before the event", refund: "No refund" },
  ],
  moderate: [
    { window: "30 or more days before the event", refund: "Full refund" },
    { window: "7 to 29 days before the event", refund: "50% refund" },
    { window: "Less than 7 days before the event", refund: "No refund" },
  ],
  strict: [
    { window: "90 or more days before the event", refund: "Full refund" },
    { window: "60 to 89 days before the event", refund: "75% refund" },
    { window: "30 to 59 days before the event", refund: "50% refund" },
    { window: "Less than 30 days before the event", refund: "No refund" },
  ],
};

/** Protections every preset gives the client, as short headline + detail pairs. */
export const CANCELLATION_POLICY_GUARANTEES = [
  {
    title: "24-hour change of mind",
    detail: "Full refund if you cancel within 24 hours of paying and the event is at least 7 days away.",
  },
  { title: "Service fee always refunded", detail: "The Eventtz service fee comes back whatever the timing." },
] as const;

function tierLine(tier: CancellationPolicyTier): string {
  const refund = tier.refund === "Full refund" ? "full refund" : tier.refund === "No refund" ? "no refund" : tier.refund;
  return `${tier.window}: ${refund} of the vendor's price`;
}

const SHARED_LINES = [
  "Within 24 hours of paying, if the event is at least 7 days away: full refund",
  "The Eventtz service fee is always refunded",
];

/** Narrow any stored value to a known preset; unknown or empty means flexible. */
export function normaliseCancellationPolicy(preset: string | null | undefined): CancellationPolicyKey {
  return (CANCELLATION_POLICY_KEYS as readonly string[]).includes(preset ?? "")
    ? (preset as CancellationPolicyKey)
    : DEFAULT_CANCELLATION_POLICY;
}

/** Every line describing a preset: its tiers, then the lines shared by all presets. */
export function describeCancellationPolicy(preset: string): string[] {
  return [...cancellationPolicyTiers(preset).map(tierLine), ...SHARED_LINES];
}

/** The refund tiers of a preset, for tables; unknown or empty means flexible. */
export function cancellationPolicyTiers(preset: string): CancellationPolicyTier[] {
  return CANCELLATION_POLICY_TIERS[normaliseCancellationPolicy(preset)];
}

/** Human label for a preset ("Flexible", ...). */
export function cancellationPolicyLabel(preset: string): string {
  return CANCELLATION_POLICY_LABELS[normaliseCancellationPolicy(preset)];
}

/** What a vendor's own form shows for the preset: the label, or that clients see Flexible until they pick. */
export const CANCELLATION_POLICY_NOT_CHOSEN = "Not chosen yet (clients see Flexible)";

export function vendorCancellationPolicyLabel(preset: string): string {
  return (CANCELLATION_POLICY_KEYS as readonly string[]).includes(preset)
    ? cancellationPolicyLabel(preset)
    : CANCELLATION_POLICY_NOT_CHOSEN;
}
