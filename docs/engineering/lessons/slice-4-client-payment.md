# Slice 4 — Client payment

**Walkthrough:** `slice-4-payment-flow-walkthrough.md` — traces one Pay now click → Stripe Checkout → webhook/sync → paid row.

### User story

A **signed-in client** with an **accepted + unpaid** booking pays via Stripe Checkout. Money lands in Eventtz's platform balance first (held funds). The vendor is paid later via Transfer (Slice 6). After payment, `payment_status` becomes **`paid`**, receipt snapshots are frozen, and the client can download a receipt from booking detail or `/client/payments`.

**Prerequisites:** Slice 3b (booking detail) — vendor has accepted; client may need to add venue address before pay.

---

## What changed (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Checkout pricing persist | `total_label` only on row update | `pricing_snapshot_fields(pb)` from `booking_discount.py` — `total_label` + `referral_fee_discount_gbp` |
| Referral through checkout | Not in Slice 4 lesson | Server `refresh_booking_pricing` → stored code/tier; Stripe session gets `referral_fee_discount_gbp` |
| Detail / pay fee UI | Total label in banner | `BookingPricingBreakdown` → `ClientFeeBreakdownSummary` (vendor portion, fee, referral discount) |
| Live fee math (previews) | — | `bookingServiceFee.ts`: `computeClientFeeBreakdown`, `referralDiscountForBookingPreview` |
| Checkout POST failure | Error string in safety modal | `useClientBookingPay` sets `phase: "error"`; `ClientBookingPayView` shows `LottieFailurePanel` |
| Receipt snapshots | Single service-fee line | `_build_receipt_lines` adds referral discount + "Eventtz fee due" rows when discount applied |

---

## What client payment does

```typescript
const checkoutUrl = await postBookingCheckout(bookingId);
window.location.href = checkoutUrl;
```

| Piece | Role |
|--------|------|
| `bookingCanBePaid()` | Frontend gate — `accepted` + (`unpaid` \| `pending`) |
| `ClientBookingDetailExtras` | "Payment due" banner + checkout return messages |
| `useClientBookingPay` | Venue step → safety modal → redirect to Stripe |
| `postBookingCheckout` | `POST .../checkout` → Stripe Checkout URL |
| `create_checkout_session_for_booking` | Server recomputes pricing (incl. referral), creates session, sets `pending` |
| `pricing_snapshot_fields` | Persists `total_label` + `referral_fee_discount_gbp` on pricing refresh |
| `BookingPricingBreakdown` | Detail pricing section — embeds `ClientFeeBreakdownSummary` |
| `bookingServiceFee.ts` | `computeClientFeeBreakdown`, `referralDiscountForBookingPreview` (preview parity) |
| `handle_checkout_session_completed` | Webhook — marks `paid`, receipt snapshots |
| `postBookingCheckoutSync` | Return-url fallback when webhook is slow or missing (local dev) |
| `ClientPaymentsView` | Payment history list at `/client/payments` |

Plain English: the client clicks **Pay now**, confirms fund protection, and is sent to Stripe. Stripe charges the card; Eventtz marks the booking paid via webhook (or sync on redirect). Receipt numbers are snapshotted at payment time so later price edits do not change what the client saw.

---

## What happens at a glance

```
Client on /client/bookings/{id} (accepted, unpaid)
    → paymentDue banner → Pay now
    → /client/bookings/{id}/pay
        → useClientBookingPay: load detail
        → venue step if event_address empty (patchClientBookingVenue)
        → PaymentSafetyModal (held funds + 48h dispute window)
        → POST /client/booking-requests/{id}/checkout
            → create_checkout_session_for_booking()
                → refresh_booking_pricing (server-side recompute)
                → stripe create_checkout_session (platform balance)
                → payment_status = pending, stripe_checkout_session_id set
        → window.location = checkout_url (Stripe hosted page)
    → Client pays on Stripe
    → Redirect: /client/bookings/{id}?payment=success&session_id=...
        → useClientBookingPaymentReturn
            → POST .../checkout/sync (if not paid yet)
            → fetchClientBookingDetail → payment_status = paid
            → success banner + ReceiptActions
    → (parallel) Stripe webhook checkout.session.completed
        → _mark_webhook_event_processed (idempotency)
        → _finalize_booking_payment_from_checkout_session
            → payment_status = paid, paid_at, stripe ids
            → persist_payment_receipt_snapshots
            → notifications + analytics
```

---

## Example: client pays after vendor accepts

1. Booking `br-abc` is `accepted` / `unpaid` after Slice 5 vendor accept.
2. Client opens `/client/bookings/br-abc` — sees payment due banner.
3. Clicks **Pay now** → `/client/bookings/br-abc/pay`.
4. Venue address was empty at enquire — client fills venue, **Continue** → `PATCH` venue.
5. **PaymentSafetyModal** explains held funds → **Continue to payment**.
6. `POST /api/v1/client/booking-requests/br-abc/checkout` → redirect to Stripe.
7. Client completes card payment on Stripe.
8. Stripe redirects to `?payment=success&session_id=cs_...`.
9. `useClientBookingPaymentReturn` calls sync → detail reloads as `paid`.
10. Success banner + download receipt. Row also appears on `/client/payments`.

---

## Complete route — pay from booking detail

### Frontend

1. `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx` — detail shell (Slice 3b)
2. `frontend/features/client/bookings/ClientBookingsView.tsx` — composes detail + extras
3. `frontend/features/client/bookings/useClientBookingsController.ts` — `payNow`, wires payment hook
4. `frontend/features/client/bookings/useClientBookingPaymentReturn.ts` — return URL + sync effects
5. `frontend/features/client/bookings/ClientBookingDetailExtras.tsx` — payment due + return banners
6. `frontend/features/client/payments/bookingPayHelpers.ts` — `bookingCanBePaid`, `bookingNeedsVenue`
7. `frontend/app/client/(portal)/bookings/[bookingId]/pay/page.tsx` — thin route
8. `frontend/features/client/payments/ClientBookingPayView.tsx` — venue / safety / redirect UI
9. `frontend/features/client/payments/useClientBookingPay.ts` — pay flow state machine
10. `frontend/features/client/payments/PaymentSafetyModal.tsx` — pre-checkout confirmation
11. `frontend/lib/bookingCheckoutApi.ts` — `postBookingCheckout`, `postBookingCheckoutSync`
12. `frontend/lib/clientBookingsApi.ts` — `patchClientBookingVenue`, `fetchClientBookingDetail`
13. `frontend/lib/validation/` — `payVenueSchema`
14. `frontend/features/bookings/bookingConfirmCopy.ts` — `PAYMENT_FLOW_COPY`, `PAYMENT_SAFETY_COPY`
15. `frontend/lib/bookingServiceFee.ts` — `computeClientFeeBreakdown`, `referralDiscountForBookingPreview`
16. `frontend/features/bookings/BookingPricingBreakdown.tsx` — detail pricing + `ClientFeeBreakdownSummary`
17. `frontend/features/bookings/ClientFeeBreakdownSummary.tsx` — vendor portion, fee, referral rows
18. `frontend/components/ui/LottieFailurePanel.tsx` — pay-page error states

### Payment history

19. `frontend/app/client/(portal)/payments/page.tsx` — `/client/payments`
20. `frontend/features/client/payments/ClientPaymentsView.tsx` — paid bookings list + receipts

### Backend

21. `backend/app/features/bookings/http/client.py` — checkout + sync routes
22. `backend/app/contracts/payments.py` — `BookingCheckoutResponse`, sync body/response
23. `backend/app/features/bookings/payment_checkout.py` — `create_checkout_session_for_booking`
24. `backend/app/features/vendor_referrals/booking_discount.py` — `pricing_snapshot_fields`, referral breakdown
25. `backend/app/features/bookings/payment_finalize.py` — finalize, sync, webhook handler
26. `backend/app/features/payments/http/webhooks.py` — `POST /webhooks/stripe`
27. `backend/app/features/payments/stripe.py` — `create_checkout_session`, retrieve session
28. `backend/app/features/bookings/receipts.py` — `persist_payment_receipt_snapshots`, referral receipt lines
29. `backend/app/core/db.py` — `booking_requests`, `stripe_webhook_events`

---

## `payment_status` lifecycle

| Status | Meaning | Typical trigger |
|--------|---------|-----------------|
| `unpaid` | No checkout started (DB default) | Enquire, vendor accept |
| `pending` | Checkout session created; client on Stripe or abandoned | `create_checkout_session_for_booking` |
| `paid` | Card captured; funds on platform balance | Webhook or sync finalize |
| `payout_released` | Vendor Transfer completed (Slice 6) | Payout job |
| `refunded` / `partially_refunded` | Cancel/refund paths | Vendor/client cancel after pay |

**Separate from booking `status`:** a booking can be `accepted` while `payment_status` moves `unpaid` → `pending` → `paid`. Never conflate the two columns.

Frontend pay gate:

```7:14:frontend/features/client/payments/bookingPayHelpers.ts
export function bookingCanBePaid(booking: {
  booking_status: string;
  payment_status: string;
}): boolean {
  return (
    booking.booking_status === "accepted" &&
    (booking.payment_status === "unpaid" || booking.payment_status === "pending")
  );
}
```

---

## Step 1 — Payment due banner on booking detail

**File:** `useClientBookingsController.ts` — composes payment hook and exposes `payNow`:

```120:133:frontend/features/client/bookings/useClientBookingsController.ts
  const {
    paymentBanner,
    paymentSyncError,
    paymentConfirmed,
    paymentDue,
    paymentBannerRef,
    showCheckoutReturnBanner,
    checkoutReturnMessage,
  } = useClientBookingPaymentReturn({
    selectedBookingId,
    detail,
    setDetail,
    bumpDetail,
  });
```

```224:227:frontend/features/client/bookings/useClientBookingsController.ts
  const payNow = useCallback(() => {
    if (!detail?.booking_request_id) return;
    router.push(`/client/bookings/${detail.booking_request_id}/pay`);
  }, [detail?.booking_request_id, router]);
```

**File:** `ClientBookingDetailExtras.tsx` — banner when `paymentDue`:

```132:151:frontend/features/client/bookings/ClientBookingDetailExtras.tsx
      {paymentDue ? (
        <div
          ref={paymentBannerRef}
          className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white"
        >
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {PAYMENT_FLOW_COPY.paymentDueTitle}
              </p>
              <p className="mt-1 text-[13px] text-neutral-600">
                {PAYMENT_FLOW_COPY.paymentDueSubtitle}
              </p>
              <p className="mt-1 text-[13px] text-neutral-400">{PAYMENT_FLOW_COPY.beforePay}</p>
            </div>
            <Button variant="primary" size="md" className="shrink-0" onClick={onPayNow}>
              {PAYMENT_FLOW_COPY.payNowLabel}
            </Button>
          </div>
        </div>
      ) : null}
```

`paymentBannerRef` scrolls the banner into view when payment becomes due (`useClientBookingPaymentReturn`).

---

## Step 2 — Pay page: venue, safety, checkout

**File:** `ClientBookingPayView.tsx` — phases from `useClientBookingPay`:

```16:27:frontend/features/client/payments/ClientBookingPayView.tsx
/** Collects venue details if needed, shows payment protection modal, then Stripe Checkout. */
export function ClientBookingPayView({ bookingId }: ClientBookingPayViewProps) {
  const router = useRouter();
  const {
    phase,
    error,
    venueAddress,
    setVenueAddress,
    busy,
    continueFromVenue,
    confirmSafetyAndPay,
  } = useClientBookingPay(bookingId);
```

| Phase | UI |
|-------|-----|
| `loading` | Fetch booking, validate `bookingCanBePaid` |
| `venue` | Textarea if `bookingNeedsVenue(event_address)` |
| `safety` | `PaymentSafetyModal` open |
| `redirecting` | Loading while posting checkout |
| `error` | Cannot pay, load failed, or checkout POST failed — `LottieFailurePanel` |

**Venue before pay** — enquire allowed empty address; checkout requires it:

```27:55:frontend/features/client/payments/useClientBookingPay.ts
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const booking = await fetchClientBookingDetail(bookingId);
        if (cancelled) return;
        if (!bookingCanBePaid(booking)) {
          setError(PAYMENT_FLOW_COPY.payNotReady);
          setPhase("error");
          return;
        }
        if (bookingNeedsVenue(booking.event_address)) {
          setVenueAddress(booking.event_address ?? "");
          setPhase("venue");
          return;
        }
        setPhase("safety");
      } catch (e: unknown) {
        ...
      }
    })();
```

```74:91:frontend/features/client/payments/useClientBookingPay.ts
  const continueFromVenue = async () => {
    ...
    await patchClientBookingVenue(bookingId, { event_address: parsed.data.eventAddress });
    setPhase("safety");
```

**Payment safety modal** — last in-app step before Stripe:

```15:21:frontend/features/client/payments/PaymentSafetyModal.tsx
/** Last step before Stripe Checkout: explain fund protection and the 48-hour dispute window. */
export function PaymentSafetyModal({
  isOpen,
  loading = false,
  onConfirm,
  onCancel,
}: PaymentSafetyModalProps) {
```

**Start checkout:**

```57:71:frontend/features/client/payments/useClientBookingPay.ts
  const proceedToCheckout = async () => {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    setPhase("redirecting");
    try {
      track(MixpanelEvents.booking_checkout_started, { booking_id: bookingId });
      const checkoutUrl = await postBookingCheckout(bookingId);
      window.location.href = checkoutUrl;
    } catch (e: unknown) {
      track(MixpanelEvents.booking_checkout_failed, { booking_id: bookingId });
      setError(getApiErrorDetail(e) ?? COULD_NOT_START_CHECKOUT);
      setPhase("error");
      setBusy(false);
    }
  };
```

**Checkout POST failure** — full-page `LottieFailurePanel` (not inline in the safety modal):

```31:44:frontend/features/client/payments/ClientBookingPayView.tsx
  if (phase === "error") {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <BackLink href={bookingHref} label="Back to booking" />
        <LottieFailurePanel
          title="Payment couldn't be started"
          description={error ?? "Could not load this booking."}
          action={
            <Button variant="secondary" onClick={() => router.push(bookingHref)}>
              Back to booking
            </Button>
          }
        />
      </div>
    );
  }
```

---

## Step 2b — Fee breakdown on booking detail (before pay)

**File:** `BookingDetailPanel.tsx` — pricing section uses `BookingPricingBreakdown`, which embeds `ClientFeeBreakdownSummary` (vendor portion, Eventtz fee, referral discount when applied):

```231:238:frontend/features/bookings/BookingDetailPanel.tsx
        <section>
          <BookingPricingBreakdown
            quoteTotalLabel={booking.totalLabel}
            pricing={booking.pricing ?? undefined}
            variant={booking.pricingVariant}
            lineItems={booking.lineItems}
            compareTotalLabel={booking.compareTotalLabel}
          />
```

```215:224:frontend/features/bookings/BookingPricingBreakdown.tsx
        <ClientFeeBreakdownSummary
          breakdown={{
            vendorPortionLabel: pricing.vendor_portion_label,
            feeLabel: pricing.service_fee_label,
            totalLabel: pricing.client_total_label,
            feePercent: pricing.service_fee_percent,
            feeBeforeDiscountLabel: pricing.service_fee_before_discount_label,
            referralDiscountLabel: pricing.referral_fee_discount_label,
            referralApplied: pricing.referral_fee_applied,
          }}
```

**File:** `bookingServiceFee.ts` — mirrors backend rounding for live previews (enquire modal, vendor adjustment drafts); committed booking UI reads API `pricing.*`:

```72:76:frontend/lib/bookingServiceFee.ts
export function computeClientFeeBreakdown(input: {
  vendorPortionGbp: number;
  feePercent?: number;
  referralFeeDiscountGbp?: number;
}): ClientFeeBreakdown | null {
```

```33:40:frontend/lib/bookingServiceFee.ts
export function referralDiscountForBookingPreview(
  pricing: BookingReferralPricingFields | null | undefined,
  vendorPortionGbp: number,
): number {
  if (!pricing) return 0;
  if (!pricing.vendor_referral_code && !pricing.referral_fee_applied) return 0;
  return referralDiscountForSpend(vendorPortionGbp);
}
```

---

## Step 3 — Frontend API layer

**File:** `bookingCheckoutApi.ts`

```14:31:frontend/lib/bookingCheckoutApi.ts
/** Starts a Stripe Checkout session for an accepted, unpaid client booking. */
export async function postBookingCheckout(bookingId: string): Promise<string> {
  const { data } = await api.post<BookingCheckoutResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout`,
  );
  return data.checkout_url;
}

/** Confirms payment after Stripe redirect (fallback when webhooks are not configured). */
export async function postBookingCheckoutSync(
  bookingId: string,
  sessionId?: string | null,
): Promise<BookingCheckoutSyncResponse> {
  const { data } = await api.post<BookingCheckoutSyncResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout/sync`,
    sessionId ? { session_id: sessionId } : {},
  );
  return data;
}
```

---

## Step 4 — Backend: create checkout session

**File:** `payment_checkout.py` — `create_checkout_session_for_booking`

Guards and pricing refresh:

```31:47:backend/app/features/bookings/payment_checkout.py
    if str(row.get("status") or "") != "accepted":
        raise ValueError(booking_messages.ONLY_ACCEPTED_CAN_BE_PAID)
    if str(row.get("payment_status") or "unpaid") not in ("unpaid", "pending"):
        raise ValueError(booking_messages.BOOKING_ALREADY_PAID)

    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    charges_ready = bool(vendor_stripe.get("stripe_account_id")) and bool(
        vendor_stripe.get("stripe_charges_enabled"),
    )
    # An admin waiver is safe here: Checkout collects into Eventtz's own balance and
    # never touches the vendor's Connect account. Only the completion Transfer does,
    # and that already holds the money until their account is ready.
    if not charges_ready and not payout_gate_waived(vendor_stripe):
        raise ValueError(
            booking_messages.VENDOR_PAYOUTS_NOT_READY,
        )
```

Server recomputes line items before charging (prevents stale UI totals):

```60:69:backend/app/features/bookings/payment_checkout.py
    refreshed = refresh_booking_pricing(row, vendor_payload)
    line_items = refreshed["line_items"]
    pb = refreshed["pricing_breakdown"]

    db.table("booking_requests").update(
        {
            "line_items": line_items,
            **pricing_snapshot_fields(pb),
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()
```

Referral discount flows into Stripe session metadata:

```71:89:backend/app/features/bookings/payment_checkout.py
    client_total = float(pb["client_total_gbp"])
    vendor_amount = float(pb["vendor_portion_gbp"])
    service_fee = float(pb["service_fee_gbp"])
    referral_discount = float(pb.get("referral_fee_discount_gbp") or 0)
    ...
    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        client_total_gbp=client_total,
        vendor_amount_gbp=vendor_amount,
        service_fee_gbp=service_fee,
        referral_fee_discount_gbp=referral_discount,
```

`pricing_snapshot_fields` (in `booking_discount.py`):

```121:126:backend/app/features/vendor_referrals/booking_discount.py
def pricing_snapshot_fields(pb: dict[str, Any]) -> dict[str, Any]:
    """Columns persisted on booking_requests when pricing changes."""
    return {
        "total_label": persisted_booking_total_label(pb),
        "referral_fee_discount_gbp": float(pb.get("referral_fee_discount_gbp") or 0) or None,
    }
```

Venue required server-side:

```77:81:backend/app/features/bookings/payment_checkout.py
    ea = row.get("event_address")
    if not (isinstance(ea, str) and ea.strip()):
        raise ValueError(
            booking_messages.ADD_EVENT_ADDRESS_BEFORE_PAY,
        )
```

Session creation + `pending`:

```93:98:backend/app/features/bookings/payment_checkout.py
    db.table("booking_requests").update(
        {
            "stripe_checkout_session_id": session["id"],
            "payment_status": "pending",
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()
```

### Held funds model

**File:** `stripe.py` — money goes to **Eventtz platform balance**, not direct to vendor Connect:

```620:632:backend/app/features/payments/stripe.py
def create_checkout_session(
    *,
    booking_id: str,
    client_total_gbp: float,
    ...
) -> dict[str, str]:
    """Create a Checkout Session for the full client total. Money goes to Eventtz's Stripe
    balance first - the vendor is paid later via an explicit Transfer."""
```

Return URLs embed booking id and session id for sync:

```664:668:backend/app/features/payments/stripe.py
        success_url=(
            f"{settings.frontend_url}/client/bookings/{booking_id}"
            "?payment=success&session_id={CHECKOUT_SESSION_ID}"
        ),
        cancel_url=f"{settings.frontend_url}/client/bookings/{booking_id}?payment=cancelled",
```

---

## Step 5 — Webhook finalize (primary path)

**File:** `webhooks.py` — public endpoint, signature-verified:

```20:27:backend/app/features/payments/http/webhooks.py
@router.post("/stripe")
async def post_stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, Any]:
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail=payment_messages.MISSING_STRIPE_SIGNATURE)
```

```57:61:backend/app/features/payments/http/webhooks.py
        if event_type == "checkout.session.completed":
            handle_checkout_session_completed(event_id, data_object)
        elif event_type == "account.updated":
            handle_account_updated(event_id, data_object)
```

**Webhook idempotency** — `stripe_webhook_events` table:

```23:32:backend/app/features/bookings/payment_finalize.py
def _mark_webhook_event_processed(event_id: str, event_type: str) -> bool:
    """True if this is the first time we've seen this event id (Stripe may redeliver)."""
    try:
        get_db().table("stripe_webhook_events").insert(
            {"id": event_id, "type": event_type},
        ).execute()
        return True
    except Exception as e:
        logger.info("stripe webhook event already processed id=%s type=%s (%s)", event_id, event_type, e)
        return False
```

```330:333:backend/app/features/bookings/payment_finalize.py
def handle_checkout_session_completed(event_id: str, session: dict[str, Any]) -> None:
    if not _mark_webhook_event_processed(event_id, "checkout.session.completed"):
        return
    _finalize_booking_payment_from_checkout_session(session)
```

**Finalize** — conditional update prevents double-pay; validates amount + session id:

```216:237:backend/app/features/bookings/payment_finalize.py
    upd = (
        db.table("booking_requests")
        .update(
            {
                "payment_status": "paid",
                "paid_at": _now_iso(),
                "stripe_payment_intent_id": payment_intent_id,
                "stripe_charge_id": charge_id,
                "stripe_receipt_url": stripe_receipt_url,
                "payment_amount_gbp": payment_amount_gbp,
                ...
            },
        )
        .eq("id", booking_id)
        .eq("status", "accepted")
        .in_("payment_status", ["pending", "unpaid"])
        .execute()
    )
```

**Receipt snapshots** — write-once JSON on the booking row; line items include referral discount when applied:

```160:178:backend/app/features/bookings/receipts.py
                if referral_discount and float(referral_discount) > 0 and fee_before is not None:
                    lines.append(
                        {
                            "label": fee_label,
                            "amount_label": format_gbp(float(fee_before)),
                        },
                    )
                    lines.append(
                        {
                            "label": "Referral discount",
                            "amount_label": format_gbp(-float(referral_discount)),
                        },
                    )
                    lines.append(
                        {
                            "label": "Eventtz fee due",
                            "amount_label": format_gbp(fee_f),
                        },
                    )
```

Receipts rebuild pricing via `build_pricing_breakdown_for_booking_row` (`booking_discount.py`) so frozen snapshots match checkout totals.

Called from finalize after `paid`:

```294:304:backend/app/features/bookings/payment_finalize.py
    persist_payment_receipt_snapshots(booking_id)
    dispatch_payment_receipts_after_checkout(
        booking_id,
        client_id=client_id,
        vendor_id=vendor_id,
    )
```

---

## Step 6 — Sync fallback (return URL + stale pending)

When webhooks are slow or missing (common in local dev), the client app calls sync.

**Pending without return** — if user lands on detail while `payment_status === "pending"`:

```53:68:frontend/features/client/bookings/useClientBookingPaymentReturn.ts
  useEffect(() => {
    if (!selectedBookingId || detail?.payment_status !== "pending") return;
    if (pendingPaymentSyncRef.current === selectedBookingId) return;
    pendingPaymentSyncRef.current = selectedBookingId;
    void postBookingCheckoutSync(selectedBookingId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (booking.payment_status === "paid" || booking.payment_status === "payout_released") {
          setDetail(booking);
          bumpDetail();
        }
      })
      .catch(() => {
        /* webhook may still be in flight, or checkout was abandoned */
      });
  }, [selectedBookingId, detail?.payment_status, bumpDetail, setDetail]);
```

**Success return** — `?payment=success&session_id=...`:

```93:119:frontend/features/client/bookings/useClientBookingPaymentReturn.ts
  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (paymentConfirmed) return;

    const syncKey = `${selectedBookingId}:${checkoutSessionId ?? ""}`;
    if (checkoutReturnSyncRef.current === syncKey) return;
    checkoutReturnSyncRef.current = syncKey;

    let cancelled = false;
    setPaymentSyncError(null);
    void postBookingCheckoutSync(selectedBookingId, checkoutSessionId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (cancelled) return;
        setDetail(booking);
        bumpDetail();
        router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
          scroll: false,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPaymentSyncError(
            getApiErrorDetail(e) ?? PAYMENT_FLOW_COPY.paymentSyncPending,
          );
        }
      });
```

**Backend sync** — reuses same finalize logic:

```349:416:backend/app/features/bookings/payment_finalize.py
def sync_checkout_payment_for_client(
    client_user_id: str,
    booking_id: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Verify a Stripe Checkout Session after redirect; marks booking paid if the webhook missed."""
    ...
    if str(session.get("payment_status") or "") != "paid":
        raise ValueError(booking_messages.PAYMENT_NOT_FINISHED)

    _finalize_booking_payment_from_checkout_session(session)
```

**Return banners** in `ClientBookingDetailExtras`:

```68:96:frontend/features/client/bookings/ClientBookingDetailExtras.tsx
      {showCheckoutReturnBanner ? (
        <div className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${...}`}>
          ...
          {checkoutReturnMessage}
          {paymentBanner === "success" && paymentConfirmed && !paymentSyncError ? (
            <div className="mt-3">
              <ReceiptActions
                bookingId={detail.booking_request_id}
                documentType="client_payment_receipt"
              />
            </div>
          ) : null}
        </div>
      ) : null}
```

---

## Step 7 — Payment history (`/client/payments`)

**File:** `ClientPaymentsView.tsx` — lists bookings where `payment_status !== unpaid`:

```15:20:frontend/features/client/payments/ClientPaymentsView.tsx
async function fetchPaidBookings(): Promise<ClientBookingListItem[]> {
  return fetchClientBookings({
    group: "all",
    exclude_payment_status: "unpaid",
  });
}
```

Each row shows total, `PaymentStatusBadge`, and compact `ReceiptActions` when a receipt exists.

Route: `frontend/app/client/(portal)/payments/page.tsx` — linked from client settings.

---

## Parameter map — pay flow

| Step | Client state | API | DB columns touched |
|------|--------------|-----|-------------------|
| Venue | `venueAddress` | `PATCH .../venue` `{ event_address }` | `event_address` |
| Checkout start | — | `POST .../checkout` | `line_items`, `total_label`, `referral_fee_discount_gbp`, `stripe_checkout_session_id`, `payment_status=pending` |
| Stripe pay | Stripe UI | — | — |
| Webhook/sync | `session_id` query | `POST .../checkout/sync` | `payment_status=paid`, `paid_at`, stripe ids, amounts |
| Receipts | — | `GET .../receipt` | reads `payment_receipt_snapshot` |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Pay page / checkout APIs | `require_client` — booking must belong to session user |
| Webhook | Stripe signature (`STRIPE_WEBHOOK_SECRET`) — no session |
| Receipt download | `require_client` + paid snapshot exists |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `booking_checkout_started` | Before redirect to Stripe |
| `booking_checkout_failed` | Checkout POST error |
| `booking_payment_succeeded` | Return URL + `paymentConfirmed` |
| `booking_payment_cancelled` | `?payment=cancelled` |
| `customer_started_payment` | Backend — session created |
| `customer_payment_completed` | Backend — finalize success |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Pay now missing | `bookingPayHelpers.bookingCanBePaid` — need `accepted` + unpaid/pending |
| "Add venue before pay" | `useClientBookingPay` venue phase / `payment_checkout.py` |
| "Payout setup" on checkout | Vendor Connect not ready — `VENDOR_PAYOUTS_NOT_READY` |
| Checkout POST → error page | `useClientBookingPay` `phase === "error"` — read `LottieFailurePanel` message |
| Referral missing at pay | `booking_discount.py` — stored `vendor_referral_code` + tier on `refresh_booking_pricing` |
| Stuck on "Confirming payment…" | Webhook not reaching app; check sync + `STRIPE_WEBHOOK_SECRET` |
| Paid in Stripe, booking still pending | `payment_finalize.py` — amount mismatch, stale session id |
| Duplicate webhook safe? | `stripe_webhook_events` + conditional `in_("payment_status", ...)` update |
| Receipt wrong after pay | Should not happen — check `persist_payment_receipt_snapshots` ran |
| Payment history empty | `exclude_payment_status: "unpaid"` — only paid+ rows |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Server `refresh_booking_pricing` before Checkout | **Leave it alone** — correct commerce modeling |
| Held funds + later Transfer | **Leave it alone** — dispute window + payout gate |
| Webhook + sync dual path | **Leave it alone** — needed for local dev and Stripe retries |
| `pending` sync on detail load | **Leave it alone** — recovers abandoned-return tabs |

---

## Key concepts from this slice

- **Held funds** — Checkout charges Eventtz balance; vendor Transfer is Slice 6.
- **`payment_status` lifecycle** — `unpaid` → `pending` → `paid` (separate from booking `status`).
- **Server recomputes pricing** — never trust browser totals at pay time.
- **Venue gate** — optional at enquire, required before Checkout.
- **Webhook idempotency** — `stripe_webhook_events` + conditional DB updates.
- **Sync fallback** — `postBookingCheckoutSync` on return URL and pending detail load.
- **Receipt snapshots** — frozen at payment; referral discount lines when tier applied; PDF/HTML reads snapshot not live row.
- **Referral through checkout** — `pricing_snapshot_fields` persists discount; Stripe session carries `referral_fee_discount_gbp`.

---

## TL;DR

- **Pay** = `/client/bookings/{id}/pay` → venue (if needed) → safety modal → Stripe Checkout.
- **Checkout API** = `POST /api/v1/client/booking-requests/{id}/checkout` → sets `pending`.
- **Paid** = webhook `checkout.session.completed` (primary) or `POST .../checkout/sync` (fallback).
- **Return URL** = `?payment=success&session_id=...` handled by `useClientBookingPaymentReturn`.
- **History** = `/client/payments` via `ClientPaymentsView`.
- **Next:** Slice 5 — vendor accept/decline; Slice 6 — vendor payout release.

---

## Related lessons

- Slice 3a: `slice-3a-client-booking-enquire.md` (enquire, optional venue)
- Slice 3b: `slice-3b-client-booking-detail.md` (detail shell)
- Slice 5: `slice-5-vendor-booking.md` (vendor accept → unlocks pay)
- Walkthrough: `slice-4-payment-flow-walkthrough.md`
