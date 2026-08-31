# Slice 4 — Payment flow walkthrough (thorough)

Trace **one Pay now click** from booking detail → Stripe → paid row + receipt. Read this when `slice-4-client-payment.md` feels too high-level.

**Endpoint (checkout):** `POST /api/v1/client/booking-requests/{id}/checkout`  
**Endpoint (sync):** `POST /api/v1/client/booking-requests/{id}/checkout/sync`  
**Webhook:** `POST /api/v1/webhooks/stripe` (`checkout.session.completed`)  
**Orchestrators:** `create_checkout_session_for_booking`, `_finalize_booking_payment_from_checkout_session`

---

## What changed (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Checkout row update | `total_label` only | `pricing_snapshot_fields(pb)` — referral discount persisted |
| Stripe session | Fee + total | Also passes `referral_fee_discount_gbp` from refreshed breakdown |
| Detail fee UI | Not in walkthrough | `BookingPricingBreakdown` → `ClientFeeBreakdownSummary` on detail |
| Checkout POST failure | Inline error | `phase: "error"` + `LottieFailurePanel` full-page state |
| Receipt lines | Single fee row | Referral discount + "Eventtz fee due" when tier applied |

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  UI — booking detail paymentDue banner → /pay page           │
│  venue (if needed) → PaymentSafetyModal → Stripe redirect  │
└────────────────────────────┬─────────────────────────────────┘
                             │ POST /checkout
┌────────────────────────────▼─────────────────────────────────┐
│  Server — refresh pricing, create Stripe session, pending      │
│  payment_checkout.py → stripe.create_checkout_session          │
└────────────────────────────┬─────────────────────────────────┘
                             │ client pays on Stripe
┌────────────────────────────▼─────────────────────────────────┐
│  Parallel finalize paths                                       │
│  A) Webhook checkout.session.completed (primary)               │
│  B) Return URL ?payment=success → POST /checkout/sync        │
│  → payment_status=paid, receipt snapshots, notifications       │
└────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Browser never sends a price to Checkout — server recomputes.
- Money hits **Eventtz platform balance** first (held funds).
- Webhook and sync both call the same finalize function — idempotent updates.

---

## Scenario

**Setup:** Booking `br-pay-001` is `accepted` / `unpaid`. Vendor accepted in Slice 5. Client `client@example.com` is signed in. Event address was left empty at enquire.

**Goal:** Client pays £495 (example, possibly less referral discount on fee) via Stripe; lands back on detail with `paid` + receipt.

---

## Step 1 — Booking detail shows payment due

**File:** `useClientBookingsController.ts`

```224:227:frontend/features/client/bookings/useClientBookingsController.ts
  const payNow = useCallback(() => {
    if (!detail?.booking_request_id) return;
    router.push(`/client/bookings/${detail.booking_request_id}/pay`);
  }, [detail?.booking_request_id, router]);
```

`paymentDue` comes from `bookingCanBePaid(detail)`:

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

Banner rendered in `ClientBookingDetailExtras` — **Pay now** calls `onPayNow` → `payNow()`. Pricing breakdown (incl. referral discount) is in `BookingPricingBreakdown` on the detail panel — not repeated on the pay route.

---

## Step 2 — Pay route mounts

**File:** `frontend/app/client/(portal)/bookings/[bookingId]/pay/page.tsx`

```tsx
export default function ClientBookingPayPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  if (!bookingId) return null;
  return <ClientBookingPayView bookingId={bookingId} />;
}
```

No logic in route — all in `ClientBookingPayView` + `useClientBookingPay`.

---

## Step 3 — Load booking + venue gate

**File:** `useClientBookingPay.ts`

On mount:
1. `GET /api/v1/client/booking-requests/br-pay-001`
2. If not `bookingCanBePaid` → error phase ("not ready to pay")
3. If `!event_address?.trim()` → **venue** phase

```39:44:frontend/features/client/payments/useClientBookingPay.ts
        if (bookingNeedsVenue(booking.event_address)) {
          setVenueAddress(booking.event_address ?? "");
          setPhase("venue");
          return;
        }
        setPhase("safety");
```

Client enters: `The Grand Hall, 12 Park Lane, London` → **Continue**.

```84:85:frontend/features/client/payments/useClientBookingPay.ts
      await patchClientBookingVenue(bookingId, { event_address: parsed.data.eventAddress });
      setPhase("safety");
```

### HTTP (venue patch)

```http
PATCH /api/v1/client/booking-requests/br-pay-001/venue
Cookie: eventtz_access_token=...

{ "event_address": "The Grand Hall, 12 Park Lane, London" }
```

---

## Step 4 — Payment safety modal

**File:** `PaymentSafetyModal.tsx`

Modal explains:
- Funds held until event completion / dispute window
- 48-hour post-event dispute period

Client clicks **Continue to payment** → `confirmSafetyAndPay()` → `proceedToCheckout()`.

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

If `postBookingCheckout` fails, `phase` becomes `"error"` and `ClientBookingPayView` renders `LottieFailurePanel` ("Payment couldn't be started") instead of staying on the safety modal.

---

## Step 5 — `postBookingCheckout`

```15:19:frontend/lib/bookingCheckoutApi.ts
export async function postBookingCheckout(bookingId: string): Promise<string> {
  const { data } = await api.post<BookingCheckoutResponse>(
    `/api/v1/client/booking-requests/${bookingId}/checkout`,
  );
  return data.checkout_url;
}
```

### HTTP

```http
POST /api/v1/client/booking-requests/br-pay-001/checkout
Cookie: eventtz_access_token=...
(no body)
```

### Response

```json
{
  "success": true,
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

Browser navigates away to Stripe.

---

## Step 6 — Backend `create_checkout_session_for_booking`

**File:** `payment_checkout.py` (line-by-line highlights)

1. **Load row** — must be client's booking
2. **Guards:**
   - `status === "accepted"`
   - `payment_status in ("unpaid", "pending")`
   - Vendor payout ready OR admin waiver
   - `event_address` non-empty
3. **`refresh_booking_pricing`** — recompute `line_items` + breakdown (honors stored `vendor_referral_code` via `booking_discount.py`)
4. **Persist refreshed prices** — `pricing_snapshot_fields(pb)` (`total_label`, `referral_fee_discount_gbp`)
5. **`stripe_service.create_checkout_session`** — metadata includes `booking_id`, amounts, `referral_fee_discount_gbp`
6. **Update row:** `stripe_checkout_session_id`, `payment_status = "pending"`
7. **`mark_payment_requested`** + analytics `customer_started_payment`
8. Return `session["url"]`

```64:69:backend/app/features/bookings/payment_checkout.py
    db.table("booking_requests").update(
        {
            "line_items": line_items,
            **pricing_snapshot_fields(pb),
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()
```

```84:89:backend/app/features/bookings/payment_checkout.py
    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        client_total_gbp=client_total,
        vendor_amount_gbp=vendor_amount,
        service_fee_gbp=service_fee,
        referral_fee_discount_gbp=referral_discount,
```

### DB state after checkout start

| Column | Value |
|--------|-------|
| `status` | `accepted` |
| `payment_status` | `pending` |
| `stripe_checkout_session_id` | `cs_test_...` |
| `line_items` | refreshed JSON |
| `referral_fee_discount_gbp` | e.g. `10` when tier applies |
| `event_address` | venue string |

---

## Step 7 — Client pays on Stripe

Hosted Checkout page. Client enters test card `4242...`.

Stripe creates PaymentIntent; on success fires `checkout.session.completed` webhook **and** redirects browser.

**Success redirect URL** (from `stripe.py`):

```
https://app.eventtz.com/client/bookings/br-pay-001?payment=success&session_id=cs_test_...
```

**Cancel redirect:**

```
.../client/bookings/br-pay-001?payment=cancelled
```

---

## Step 8A — Webhook path (primary)

**File:** `webhooks.py`

```
POST /api/v1/webhooks/stripe
Stripe-Signature: t=...,v1=...
(raw Stripe event JSON)
```

1. `construct_webhook_event` — verify signature
2. `event_type === "checkout.session.completed"`
3. `handle_checkout_session_completed(event_id, session)`

**Idempotency:**

```23:32:backend/app/features/bookings/payment_finalize.py
def _mark_webhook_event_processed(event_id: str, event_type: str) -> bool:
    try:
        get_db().table("stripe_webhook_events").insert(
            {"id": event_id, "type": event_type},
        ).execute()
        return True
    except Exception:
        return False
```

Second delivery of same `event_id` → insert fails → handler returns early.

**Finalize** (`_finalize_booking_payment_from_checkout_session`):

1. Read `metadata.booking_id` from session
2. Verify booking still `accepted`
3. Verify `stripe_checkout_session_id` matches (stale session → refund)
4. Verify `amount_total` pence matches metadata pricing
5. Extract `payment_intent_id`, `charge_id`, receipt URL
6. Conditional update: `payment_status` → `paid` only if currently `pending` or `unpaid`
7. Notifications client + vendor
8. `persist_payment_receipt_snapshots(booking_id)` — receipt lines include referral discount when `referral_fee_discount_gbp > 0`
9. `dispatch_payment_receipts_after_checkout`
10. Analytics `customer_payment_completed`

### DB state after finalize

| Column | Value |
|--------|-------|
| `payment_status` | `paid` |
| `paid_at` | ISO timestamp |
| `stripe_payment_intent_id` | `pi_...` |
| `stripe_charge_id` | `ch_...` |
| `payment_amount_gbp` | e.g. `495.00` |
| `payment_receipt_snapshot` | frozen JSON (incl. referral fee lines when applicable) |
| `vendor_payment_record_snapshot` | frozen JSON |

---

## Step 8B — Return URL + sync path (fallback)

Client lands on detail with query params. **File:** `useClientBookingPaymentReturn.ts`

```35:36:frontend/features/client/bookings/useClientBookingPaymentReturn.ts
  const paymentBanner = searchParams.get("payment");
  const checkoutSessionId = searchParams.get("session_id");
```

If `payment=success` and detail not yet `paid`:

```103:111:frontend/features/client/bookings/useClientBookingPaymentReturn.ts
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
```

### HTTP sync

```http
POST /api/v1/client/booking-requests/br-pay-001/checkout/sync
Cookie: eventtz_access_token=...

{ "session_id": "cs_test_..." }
```

**File:** `sync_checkout_payment_for_client`

1. Load booking — already `paid`? return early
2. Resolve `session_id` from body or stored `stripe_checkout_session_id`
3. `stripe.retrieve_checkout_session` — must be `payment_status: paid`
4. Verify metadata `booking_id` + `client_user_id`
5. Call `_finalize_booking_payment_from_checkout_session` (same as webhook)
6. If still not paid → `PAYMENT_NOT_FINISHED`

**If webhook already ran:** finalize's conditional update matches 0 rows; reload shows `paid` — no double charge.

---

## Step 9 — Success UI on booking detail

**File:** `ClientBookingDetailExtras.tsx`

Green banner with `PAYMENT_FLOW_COPY.paymentSuccess` + Lottie check.

```88:94:frontend/features/client/bookings/ClientBookingDetailExtras.tsx
          {paymentBanner === "success" && paymentConfirmed && !paymentSyncError ? (
            <div className="mt-3">
              <ReceiptActions
                bookingId={detail.booking_request_id}
                documentType="client_payment_receipt"
              />
            </div>
          ) : null}
```

`router.replace` strips `?payment=success` from URL once confirmed.

Mixpanel `booking_payment_succeeded` fires when `paymentConfirmed` true.

---

## Step 10 — Payment history row

**File:** `ClientPaymentsView.tsx`

Next time client opens `/client/payments`, list query:

```http
GET /api/v1/client/booking-requests?group=all&exclude_payment_status=unpaid
```

Row shows event name, vendor, total, `PaymentStatusBadge`, receipt download.

---

## Cancelled checkout branch

If client clicks Back on Stripe:

- Redirect `?payment=cancelled`
- Amber banner: `PAYMENT_FLOW_COPY.paymentCancelledReturn`
- `payment_status` stays `pending` until session expires or new checkout started
- No sync call on cancel
- Mixpanel `booking_payment_cancelled`

Client can open pay page again — server allows `pending` in `bookingCanBePaid`.

---

## Stale / edge cases

| Case | Behavior |
|------|----------|
| Webhook arrives before redirect | Detail may already be `paid` when sync runs — harmless |
| Duplicate webhook | `stripe_webhook_events` dedupe |
| Booking declined after pay started | Finalize refunds via `refund_checkout_payment` |
| Wrong session id on return | `CHECKOUT_SESSION_MISMATCH` |
| Stripe session expired | `_clear_stale_checkout_session` → `unpaid`, `PAYMENT_LINK_EXPIRED` |
| Tab left open at `pending` | Detail load triggers background `postBookingCheckoutSync` without session_id |

---

## Function call order (cheat sheet)

```
Pay now click
  useClientBookingsController.payNow()
    router.push(/client/bookings/{id}/pay)
  ClientBookingPayView
    useClientBookingPay mount
      fetchClientBookingDetail
      [venue] patchClientBookingVenue
      PaymentSafetyModal confirm
      postBookingCheckout()
        POST /checkout
          create_checkout_session_for_booking()
            refresh_booking_pricing
            pricing_snapshot_fields(pb)
            stripe.create_checkout_session (referral_fee_discount_gbp)
            update pending + session id
      [on failure] phase=error → LottieFailurePanel
      window.location = checkout_url

[Stripe payment]

Path A — webhook
  POST /webhooks/stripe
    handle_checkout_session_completed
      _mark_webhook_event_processed
      _finalize_booking_payment_from_checkout_session
        update paid
        persist_payment_receipt_snapshots
        notifications

Path B — return URL
  useClientBookingPaymentReturn
    postBookingCheckoutSync(session_id)
      sync_checkout_payment_for_client
        _finalize_booking_payment_from_checkout_session (same)
    fetchClientBookingDetail
    router.replace (strip query)
  ClientBookingDetailExtras success banner + ReceiptActions
```

---

## Debugging

| Symptom | Check |
|---------|--------|
| Checkout 400 "venue" | `event_address` empty on row |
| Checkout 400 "payout" | Vendor Connect — Slice 5 payout gate |
| Checkout POST error page | `useClientBookingPay` → `LottieFailurePanel` on `phase === "error"` |
| Referral not on receipt | `receipts._build_receipt_lines` — check `referral_fee_discount_gbp` in breakdown |
| Webhook 400 signature | `STRIPE_WEBHOOK_SECRET` vs Dashboard signing secret |
| Webhook 200 but not paid | Handler exception logged; amount mismatch |
| Sync "not finished" | Stripe session `payment_status` not `paid` yet — wait/retry |
| Stuck pending forever | Abandoned checkout — start new session from pay page |
| Receipt 404 | `persist_payment_receipt_snapshots` did not run |

---

## Related

- `slice-4-client-payment.md` — full route list + concepts
- Slice 5 — vendor accept unlocks pay
- Slice 6 — `payout_released` after Transfer
