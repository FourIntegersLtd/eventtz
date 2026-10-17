/**
 * Pure helpers for the booking-rules screens: payment deadline, split
 * (upfront / on-delivery) payout, refundable damage deposit and the vendor's
 * optional pricing-step fields. Numbers come from `policyConstants.json`.
 */
import policy from "@/lib/policyConstants.json";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";
import { formatDateTime } from "@/lib/dateFormat";
import { formatGbp } from "@/lib/vendorDiscountDisplay";

/** Fields the booking detail endpoints (client and vendor) return for the booking rules. */
export type BookingTermsFields = {
  payment_due_at?: string | null;
  report_window_hours?: number | null;
  payout_upfront_percent?: number | null;
  delivery_deadline_days?: number | null;
  upfront_amount_gbp?: number | null;
  upfront_payout_at?: string | null;
  delivery_confirmed_at?: string | null;
  delivery_due_at?: string | null;
  payout_stage?: "full" | "upfront" | "waiting_delivery" | "final" | null;
  damage_deposit_gbp?: number | null;
  deposit_refund_due_at?: string | null;
  deposit_refunded_at?: string | null;
  deposit_claim_gbp?: number | null;
  deposit_claim_note?: string | null;
  deposit_claimed_at?: string | null;
  deposit_claim_awarded_gbp?: number | null;
  deposit_claim_resolved_at?: string | null;
};

export const DEPOSIT_NOTE_MIN_CHARS = 10;
export const DEPOSIT_NOTE_MAX_CHARS = 2000;

/** "+5% service fee" shown on browse cards and vendor profiles before enquiry. */
export function serviceFeeBadgeLabel(): string {
  return `+${getBookingServiceFeePercent()}% service fee`;
}

/** Unpaid bookings with a deadline show it; `null` when there is nothing to say. */
export function paymentDeadlineLine(
  viewer: "client" | "vendor",
  paymentDueAt: string | null | undefined,
  paymentStatus: string,
): string | null {
  if (!paymentDueAt || paymentStatus !== "unpaid") return null;
  const when = formatDateTime(paymentDueAt);
  return viewer === "client"
    ? `Pay by ${when}, or this booking is cancelled and the date released.`
    : `Client must pay by ${when}.`;
}

/** Client-side hint under the "Confirm delivery" button. */
export function deliveryDueLine(deliveryDueAt: string | null | undefined): string | null {
  if (!deliveryDueAt) return null;
  return `If they haven't arrived by ${formatDateTime(deliveryDueAt)}, report a problem.`;
}

/** Vendor-side split status for a photography-style booking. */
export function vendorSplitStatusLine(terms: BookingTermsFields): string | null {
  if (terms.payout_stage !== "waiting_delivery" && terms.payout_stage !== "upfront") return null;
  const upfront = terms.upfront_amount_gbp;
  const first = upfront != null ? `£${formatGbp(upfront)}` : "The first part";
  const rest = terms.delivery_confirmed_at
    ? "the rest is being released"
    : terms.delivery_due_at
      ? `the rest is due when the client confirms delivery, or on ${formatDateTime(terms.delivery_due_at)}`
      : "the rest is due when the client confirms delivery";
  return `${first} has been paid to you; ${rest}.`;
}

/** Whether the client should see the "I've received my photos/video" button. */
export function canConfirmDelivery(terms: BookingTermsFields): boolean {
  return terms.payout_stage === "waiting_delivery" && !terms.delivery_confirmed_at;
}

/** The deposit line in a price summary; `null` when the vendor has no deposit. */
export function depositSummaryLine(depositGbp: number | null | undefined): string | null {
  if (!depositGbp || depositGbp <= 0) return null;
  return `Refundable deposit £${formatGbp(depositGbp)} – returned within ${policy.depositClaimDays} days after the event unless the vendor reports damage.`;
}

export type DepositState = "none" | "held" | "claim_pending" | "decided" | "refunded";

/** Where the damage deposit currently is. */
export function depositState(terms: BookingTermsFields): DepositState {
  if (!terms.damage_deposit_gbp) return "none";
  if (terms.deposit_claim_resolved_at) return "decided";
  if (terms.deposit_claimed_at) return "claim_pending";
  if (terms.deposit_refunded_at) return "refunded";
  return "held";
}

/** Client-facing description of the deposit state. */
export function depositStateLine(terms: BookingTermsFields): string | null {
  const amount = terms.damage_deposit_gbp ? `£${formatGbp(terms.damage_deposit_gbp)}` : "";
  switch (depositState(terms)) {
    case "none":
      return null;
    case "held":
      return terms.deposit_refund_due_at
        ? `Your ${amount} deposit is held and returns on ${formatDateTime(terms.deposit_refund_due_at)} unless the vendor reports damage.`
        : `Your ${amount} deposit is held until after the event.`;
    case "refunded":
      return `Your ${amount} deposit was refunded${terms.deposit_refunded_at ? ` on ${formatDateTime(terms.deposit_refunded_at)}` : ""}.`;
    case "claim_pending":
      return `The vendor has reported damage or missing items (£${formatGbp(terms.deposit_claim_gbp ?? 0)}). Our team is reviewing it; the rest of your deposit is refunded once decided.`;
    case "decided": {
      const kept = terms.deposit_claim_awarded_gbp ?? 0;
      return `Deposit claim decided: the vendor keeps £${formatGbp(kept)} and the remaining £${formatGbp(Math.max(0, (terms.damage_deposit_gbp ?? 0) - kept))} goes back to you.`;
    }
  }
}

/** The vendor may report damage while the deposit is held, unclaimed, and before the refund date. */
export function canReportDeposit(terms: BookingTermsFields, now: Date = new Date()): boolean {
  if (depositState(terms) !== "held") return false;
  if (!terms.deposit_refund_due_at) return true;
  return now.getTime() < new Date(terms.deposit_refund_due_at).getTime();
}

/** Validation message for the damage report form, or `null` when valid. */
export function depositClaimError(
  amountText: string,
  note: string,
  depositGbp: number,
): string | null {
  const amount = Number(amountText);
  if (!amountText.trim() || !Number.isFinite(amount) || amount <= 0) {
    return "Enter the amount you are claiming.";
  }
  if (amount > depositGbp) return `You can claim at most the £${formatGbp(depositGbp)} deposit.`;
  const length = note.trim().length;
  if (length < DEPOSIT_NOTE_MIN_CHARS) {
    return `Describe what was damaged or missing (at least ${DEPOSIT_NOTE_MIN_CHARS} characters).`;
  }
  if (length > DEPOSIT_NOTE_MAX_CHARS) {
    return `Keep the description under ${DEPOSIT_NOTE_MAX_CHARS} characters.`;
  }
  return null;
}

/** Validation for the admin award amount (0 to the claim). */
export function depositAwardError(awardText: string, claimGbp: number): string | null {
  const award = Number(awardText);
  if (!awardText.trim() || !Number.isFinite(award) || award < 0 || award > claimGbp) {
    return `Enter an amount from £0 to £${formatGbp(claimGbp)}.`;
  }
  return null;
}

export function offersDeliverySplit(servicesOffered: readonly string[]): boolean {
  return servicesOffered.some((service) => policy.deliverySplitCategories.includes(service));
}

export function offersDamageDeposit(servicesOffered: readonly string[]): boolean {
  return servicesOffered.some((service) => policy.depositCategories.includes(service));
}

function wholeNumberError(text: string, label: string, lowest: number, highest: number): string | null {
  if (!text.trim()) return null;
  const value = Number(text);
  if (!Number.isInteger(value) || value < lowest || value > highest) {
    return `${label} must be a whole number from ${lowest} to ${highest}.`;
  }
  return null;
}

/**
 * Errors for the split-payout fields, each within policy. A blank field is fine: photography is
 * always split, and the api uses the default for anything left blank.
 */
export function deliverySplitErrors(
  upfrontPercent: string,
  deadlineDays: string,
): { upfront: string | null; deadline: string | null } {
  const upfront = wholeNumberError(
    upfrontPercent,
    "Paid after the event (%)",
    policy.deliveryUpfrontPercentMin,
    policy.deliveryUpfrontPercentMax,
  );
  const deadline = wholeNumberError(deadlineDays, "Days to deliver", 1, policy.deliveryDeadlineDaysMax);
  return { upfront, deadline };
}

/**
 * A saved first-part percent as the form should show it. Profiles saved when the limit was 80%
 * show the new maximum instead, so the vendor is not blocked from saving; the api caps it the same way.
 */
export function savedUpfrontPercentForForm(savedText: string): string {
  const value = Number(savedText);
  if (savedText.trim() && Number.isInteger(value) && value > policy.deliveryUpfrontPercentMax) {
    return String(policy.deliveryUpfrontPercentMax);
  }
  return savedText;
}

export function damageDepositError(text: string): string | null {
  if (!text.trim()) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > policy.depositMaxGbp) {
    return `Damage deposit must be an amount from £0 to £${formatGbp(policy.depositMaxGbp)}.`;
  }
  return null;
}

/** Vendor's deposit from the public profile payload (stored as text); `null` when none. */
export function depositFromPayload(payload: Record<string, unknown> | undefined): number | null {
  const raw = payload?.damageDepositGbp;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}
