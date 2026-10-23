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
