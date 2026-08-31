# Slice 3b — Booking detail walkthrough (thorough)

Trace **one booking** from post-enquire redirect → detail load → vendor price update → client accept. Read this when `slice-3b-client-booking-detail.md` feels too high-level.

**Detail endpoint:** `GET /api/v1/client/booking-requests/{id}`  
**Status endpoint:** `PATCH /api/v1/client/booking-requests/{id}/status`  
**Cancel endpoint:** `POST /api/v1/client/booking-requests/{id}/cancel`  
**Detail query:** `get_booking_request_for_client` in `queries.py`  
**Status logic:** `update_booking_request_status_for_client` in `status_client.py` (shared helpers in `status_shared.py`)

### What changed (2026-08-31)

- Read-path pricing: `booking_discount.py` → `build_pricing_breakdown_for_booking_row` (not raw `build_pricing_breakdown` in queries).
- `_attach_pricing_fields(target, source=row)` — prices from full DB row for referral discount.
- List: `list_order.py` sorts by `updated_at`; frontend mirrors in `bookingListOrder.ts`.
- List UI: `eventGroups` on `BookingListPanel`; `CopyToClipboardButton` + `shortId` per row.
- Detail pricing footer: `BookingPricingBreakdown` uses `ClientFeeBreakdownSummary`.
- Price banner “was” label: `resolveWasClientTotalLabel` in `bookingPriceLabels.ts`.

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  Slice 3a — enquire creates pending/unpaid row             │
│  redirect → /client/bookings/{id}                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ useClientBookingsController
                             │   → scaffold fetchDetail
┌────────────────────────────▼─────────────────────────────────┐
│  Detail — status badge + snapshot line_items + pricing       │
│  BookingDetailPanel + ClientBookingDetailExtras              │
└────────────────────────────┬─────────────────────────────────┘
                             │ vendor PUT adjustments (optional)
┌────────────────────────────▼─────────────────────────────────┐
│  Price update — BookingPriceUpdateBanner                     │
│  useClientBookingActions.applyClientUpdatedPriceResponse     │
│  → PATCH status accepted → accepted/unpaid                   │
│  → useClientBookingPaymentReturn.paymentDue                  │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** `line_items` are frozen at enquire. Adjustments are **extra lines** the vendor adds before accept. Client must confirm.

**Hook split:**

| Hook | Responsibility |
|------|----------------|
| `useClientBookingsController` | Orchestrator — scaffold, view model, banner flags, header/footer actions |
| `useClientBookingActions` | Mutations — cancel, quote accept/decline, price accept/decline, completion |
| `useClientBookingPaymentReturn` | Payment due, checkout return sync, return banners |

---

## Scenario A — Fresh enquiry lands on detail

**Setup:** Client completed Slice 3a enquire. Browser at `/client/bookings/abc-booking-uuid`. Row: `status=pending`, `payment_status=unpaid`, `initiator=client`, `vendor_adjustments=[]`.

---

### Step 1 — Route passes booking id

**File:** `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx`

```8:15:frontend/app/client/(portal)/bookings/[bookingId]/page.tsx
export default function ClientBookingDetailPage() {
  const params = useParams();
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : "";
  return (
    <Suspense fallback={<LoadingState label="Loading booking…" variant="centered" />}>
      <ClientBookingsView selectedBookingId={bookingId} />
    </Suspense>
  );
}
```

No fetch here — `ClientBookingsView` calls `useClientBookingsController({ selectedBookingId })`.

---

### Step 2 — Orchestrator starts scaffold fetch

**File:** `useClientBookingsController.ts`

```38:69:frontend/features/client/bookings/useClientBookingsController.ts
  const fetchList = useCallback(
    (t: "active" | "closed") =>
      fetchClientBookings({
        group: t,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
      }),
    [listStatusFilter],
  );
  const fetchDetail = useCallback((id: string) => fetchClientBookingDetail(id), []);
  const getDetailStatus = useCallback((b: ClientBookingDetail) => b.booking_status, []);

  const {
    ...
    detail,
    detailLoading,
    bumpDetail,
    ...
  } = useParticipantBookingsScaffold({
    selectedBookingId,
    fetchList,
    fetchDetail,
    getDetailStatus,
  });
```

**File:** `useParticipantBookingsScaffold.ts`

When `selectedBookingId` is set, the scaffold calls `fetchDetail(selectedBookingId)` and stores the result in `detail`. Parallel: fetches the **list** for the left panel.

---

### Step 3 — HTTP GET detail

**File:** `clientBookingsApi.ts`

```
GET /api/v1/client/booking-requests/abc-booking-uuid
Cookie: eventtz_access_token=...
```

```178:185:frontend/lib/clientBookingsApi.ts
export async function fetchClientBookingDetail(
  bookingId: string,
): Promise<ClientBookingDetail> {
  const { data } = await api.get<ClientBookingDetailResponse>(
    `/api/v1/client/booking-requests/${bookingId}`,
  );
  return data.booking;
}
```

**File:** `client.py` → `require_client` → `get_booking_request_for_client(client_id, booking_id)`

**File:** `queries.py`

1. `SELECT * FROM booking_requests WHERE id = ? AND client_user_id = ?`
2. `_attach_pricing_fields(out, source=row)` — `build_pricing_breakdown_for_booking_row` from `booking_discount.py`
3. `initial_client_total_label` — “was” price for future adjustments
4. `apply_counterparty_contact_visibility` — phone hidden until paid + accepted

List queries also call `sort_booking_rows_recent_first` (`updated_at` then `created_at`):

```8:15:backend/app/features/bookings/list_order.py
def sort_booking_rows_recent_first(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort booking rows by latest activity, then creation time, then id."""

    def key(row: dict[str, Any]) -> tuple[str, str, str]:
        activity = str(row.get("updated_at") or row.get("created_at") or "")
        return (activity, str(row.get("created_at") or ""), str(row.get("id") or ""))

    return sorted(rows, key=key, reverse=True)
```

**Example response shape (abbreviated):**

```json
{
  "success": true,
  "booking": {
    "booking_request_id": "abc-booking-uuid",
    "booking_status": "pending",
    "payment_status": "unpaid",
    "initiator": "client",
    "event_name": "Ada's 30th",
    "event_date": "2026-09-20",
    "line_items": [{ "label": "Gold package", "unit_price_gbp": 200 }],
    "vendor_adjustments": [],
    "pricing": {
      "subtotal_gbp": 200,
      "service_fee_percent": 5,
      "service_fee_gbp": 10,
      "service_fee_label": "£10 Eventtz fee",
      "client_total_gbp": 210,
      "client_total_label": "£210",
      "referral_fee_applied": false
    },
    "vendor_display_name": "Sparkle Events"
  }
}
```

If the client used a vendor referral code at enquire time, `pricing.referral_fee_applied` is `true` and `referral_fee_discount_label` shows the fee reduction.

---

### Step 4 — View model + panel render

**File:** `clientBookingViewModel.ts` → `toClientBookingDetailViewModel(detail)`

Maps API fields to `BookingDetailViewModel` (shared with vendor portal).

**File:** `BookingDetailPanel.tsx`

- `StatusBadge` → “Pending”
- No `PaymentStatusBadge` when `unpaid` (hidden by convention)
- `BookingPricingBreakdown` → Gold package £200 + `ClientFeeBreakdownSummary` (service fee) → £210 total
- “Message vendor” opens chat drawer
- List rows show `shortId` + copy button via `BookingListPanel`

**File:** `ClientBookingDetailExtras.tsx`

- No price update banner (`showUpdatedPriceBanner` is false — `vendor_adjustments` empty)
- No payment due banner (`paymentDue` is false — `booking_status !== "accepted"`)
- Footer: **Cancel booking** available (from orchestrator `footerActions`)

**Orchestrator banner flags on fresh load:**

```149:152:frontend/features/client/bookings/useClientBookingsController.ts
  const showUpdatedPriceBanner =
    detail?.booking_status === "pending" &&
    detail.initiator === "client" &&
    detail.vendor_adjustments.length > 0;
```

All false for a fresh enquiry → no price banner.

**List grouping** — when the active tab has multiple bookings for the same celebration, the controller passes `eventGroups` to `BookingListPanel`:

```140:143:frontend/features/client/bookings/useClientBookingsController.ts
  const eventGroups = useMemo(
    () => bookingEventGroupsForList(rows, listItemsById, "vendor", tab === "active"),
    [tab, rows, listItemsById],
  );
```

```147:165:frontend/features/bookings/BookingListPanel.tsx
        ) : eventGroups && eventGroups.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {eventGroups.map((group) =>
              group.bookingCount > 1 ? (
                <section key={group.key}>
                  <div className="border-b border-neutral-100 bg-neutral-50/90 px-5 py-3 sm:px-6">
                    <p className="text-sm font-semibold text-neutral-900">{group.title}</p>
                    ...
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {group.rows.map((row) => renderRow(row, { compact: true }))}
                  </ul>
                </section>
```

---

## Scenario B — Vendor sends updated price

**Setup:** Same booking. Vendor opens vendor portal, adds adjustment “Travel surcharge £50”.

---

### Step 5 — Vendor writes adjustments

**Endpoint:** `PUT /api/v1/vendor/booking-requests/abc-booking-uuid/adjustments`

**Body:**

```json
{
  "adjustments": [
    { "tag": "travel", "label": "Travel surcharge", "amount_gbp": 50 }
  ]
}
```

**File:** `adjustments.py` → `put_vendor_booking_adjustments`

- Validates `status === pending` and `initiator === client`
- Validates surcharge caps (`booking_max_adjustment_gbp`, `booking_max_adjustment_pct_of_subtotal`)
- Stores `vendor_adjustments` JSON on row
- Recomputes `total_label` via `build_pricing_breakdown` (service fee recalculated on new vendor portion)
- Sets `initial_client_total_label` on first adjustment (snapshot “was £210”)
- Notifies client (`booking_pricing_updated`)

---

### Step 6 — Client detail refreshes

Realtime event `bookings:refresh` or navigation bump triggers `bumpDetail()` → re-fetch detail.

**Orchestrator** — `showUpdatedPriceBanner` becomes true:

```149:152:frontend/features/client/bookings/useClientBookingsController.ts
  const showUpdatedPriceBanner =
    detail?.booking_status === "pending" &&
    detail.initiator === "client" &&
    detail.vendor_adjustments.length > 0;
```

**File:** `ClientBookingDetailExtras.tsx` → `BookingPriceUpdateBanner`

| UI element | Source |
|------------|--------|
| Was price | `resolveWasClientTotalLabel(detail)` → `initial_client_total_label` or `clientTotalBeforeVendorAdjustments` |
| Now price | `detail.pricing.client_total_label` → e.g. “£262.50” |
| Line items | `pricing.vendor_adjustments` → Travel surcharge £50 |
| Fee breakdown | `ClientFeeBreakdownSummary` inside banner — vendor portion + service fee |
| Accept / Decline | `onAccept` / `onDecline` → orchestrator passes `applyClientUpdatedPriceResponse` |

```56:59:frontend/features/client/bookings/ClientBookingDetailExtras.tsx
        <BookingPriceUpdateBanner
          wasTotalLabel={resolveWasClientTotalLabel(detail)}
          nowTotalLabel={detail.pricing?.client_total_label ?? detail.total_label}
```

List row subtext (left panel): “New price. Your response needed” via `has_price_update` flag from list API.

---

### Step 7a — Client accepts updated price

**UI:** Click **Accept new price** on banner.

**File:** `useClientBookingActions.ts`

```106:137:frontend/features/client/bookings/useClientBookingActions.ts
  const applyClientUpdatedPriceResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "client" || detail.booking_status !== "pending") return;
    if (detail.vendor_adjustments.length === 0) return;
    ...
    await patchClientBookingStatus(bookingId, next);
    ...
    bumpDetail();
  };
```

**HTTP:**

```
PATCH /api/v1/client/booking-requests/abc-booking-uuid/status
{ "booking_status": "accepted" }
```

**File:** `status_client.py` → `update_booking_request_status_for_client`

- Confirms `client_price_confirmation_required(row)` is true (`is_updated_price`)
- Updates `status` to `accepted`
- Notifies vendor (`_notify_client_confirmed_updated_price`)
- Returns updated row

**UI after refresh:**

- `StatusBadge` → “Accepted”
- Price banner gone (`showUpdatedPriceBanner` false — no longer `pending`)
- `useClientBookingPaymentReturn` sets `paymentDue` → true → “Payment needed” banner with **Pay now** → `/client/bookings/{id}/pay` (Slice 4)

```37:39:frontend/features/client/bookings/useClientBookingPaymentReturn.ts
  const paymentDue = detail ? bookingCanBePaid(detail) : false;
  const paymentConfirmed =
    detail?.payment_status === "paid" || detail?.payment_status === "payout_released";
```

---

### Step 7b — Client declines updated price (alternate path)

**UI:** Click **Decline** on banner → confirm dialog (`declinePriceOpen` from `useClientBookingActions`).

**HTTP:** same `PATCH` with `{ "booking_status": "declined" }`

**File:** `status_client.py` (updated-price branch)

```140:169:backend/app/features/bookings/status_client.py
    if new_status == "declined":
        if is_updated_price:
            ...
            revert_payload: dict[str, Any] = {
                "vendor_adjustments": [],
                "total_label": persisted_booking_total_label(pb),
            }
            ...
            return {"id": booking_id, "status": "pending"}
```

**UI after refresh:**

- Still “Pending”
- Adjustments cleared
- Total back to £210
- Vendor notified — can message or send a new price

---

## Scenario C — Vendor-initiated quote (different pending UI)

**Setup:** `initiator=vendor`, `status=pending`. Vendor sent quote from their portal.

**Detail differences:**

| Condition | UI |
|-----------|-----|
| `initiator === "vendor"` + `pending` | Header: **Accept quote** / **Decline** (not price banner) |
| Accept | `applyClientQuoteResponse("accepted")` in `useClientBookingActions` |
| Decline | confirm dialog → `applyClientQuoteResponse("declined")` |

**Orchestrator builds header actions:**

```195:217:frontend/features/client/bookings/useClientBookingsController.ts
  if (detail && detail.initiator === "vendor" && detail.booking_status === "pending") {
    headerActions.push(
      { key: "accept", label: "Accept quote", ... onClick: () => void applyClientQuoteResponse("accepted") },
      { key: "decline", label: "Decline", ... onClick: () => setDeclineQuoteOpen(true) },
    );
  }
```

**File:** `useClientBookingActions.ts` — quote handler:

```68:104:frontend/features/client/bookings/useClientBookingActions.ts
  const applyClientQuoteResponse = async (next: "accepted" | "declined") => {
    if (!detail?.booking_request_id) return;
    if (detail.initiator !== "vendor" || detail.booking_status !== "pending") return;
    ...
    await patchClientBookingStatus(bookingId, next);
    ...
    bumpDetail();
  };
```

Same endpoint, different backend branch in **`status_client.py`** (`is_vendor_quote` vs `is_updated_price`):

```133:138:backend/app/features/bookings/status_client.py
    is_vendor_quote = initiator == "vendor"
    is_updated_price = initiator == "client" and client_price_confirmation_required(row0)
```

- **Accept quote** → `status=accepted`; may require `event_postcode` in PATCH body (`ClientBookingStatusBody`)
- **Decline quote** → `status=declined`; booking closes (not the “revert to pending” path)

---

## Scenario D — Cancel from detail

**UI:** Footer **Cancel booking** → confirm dialog (`cancelOpen` from `useClientBookingActions`).

**File:** `useClientBookingActions.ts`

```40:66:frontend/features/client/bookings/useClientBookingActions.ts
  const confirmCancelBooking = async () => {
    if (!detail?.booking_request_id) return;
    ...
    await postCancelClientBooking(bookingId);
    ...
    bumpDetail();
  };
```

**HTTP:** `POST /api/v1/client/booking-requests/{id}/cancel`

**File:** `status_client.py` → `cancel_booking_request_for_client`

Uses shared helpers from **`status_shared.py`**:

- `assert_booking_may_be_cancelled` — not after payout, not with open dispute
- `expire_pending_checkout_session` — close in-flight Stripe session
- `refund_paid_booking_before_cancel` — full refund if already paid

**Orchestrator cancel guard** — vendor-quote pending bookings cannot be cancelled by client (must accept/decline instead):

```164:168:frontend/features/client/bookings/useClientBookingsController.ts
  const canCancel =
    detail &&
    (detail.booking_status === "pending" || detail.booking_status === "accepted") &&
    detail.payment_status !== "payout_released" &&
    !(detail.initiator === "vendor" && detail.booking_status === "pending");
```

**Result:** `booking_status = cancelled`. If already paid, refund logic runs (Slice 4/6 territory).

---

## Status + payment matrix (quick reference)

| booking_status | payment_status | Typical client view |
|----------------|----------------|---------------------|
| `pending` | `unpaid` | Waiting for vendor / price update banner |
| `accepted` | `unpaid` | Payment needed banner (`useClientBookingPaymentReturn.paymentDue`) |
| `accepted` | `paid` | Confirmed; may show completion banner after event |
| `completed` | `payout_released` | Done; review form |
| `declined` | `unpaid` | Closed |
| `cancelled` | `refunded` | Closed + refund message |

---

## Files to open when debugging

| Step | File |
|------|------|
| Route | `[bookingId]/page.tsx` |
| Orchestrator | `useClientBookingsController.ts` |
| List groups | `groupBookingsByEvent.ts`, `bookingListOrder.ts` |
| List panel | `BookingListPanel.tsx` (`eventGroups`, `shortId`, `CopyToClipboardButton`) |
| Mutations | `useClientBookingActions.ts` |
| Payment return | `useClientBookingPaymentReturn.ts` |
| Price labels | `bookingPriceLabels.ts` |
| API types | `clientBookingsApi.ts`, `domain-types.ts` |
| GET handler | `bookings/http/client.py` |
| Detail query | `bookings/queries.py` (`_attach_pricing_fields`, `source=row`) |
| Read-path pricing | `vendor_referrals/booking_discount.py` |
| List sort | `bookings/list_order.py` |
| Pricing contract | `contracts/booking.py` (`BookingPricingBreakdown`) |
| Client status patch | `bookings/status_client.py` |
| Shared cancel/refund | `bookings/status_shared.py` |
| Adjustment write | `bookings/adjustments.py` |
| Price confirmation guard | `bookings/pricing_confirmation.py` |
| Shared panel | `BookingDetailPanel.tsx` |
| Client banners | `ClientBookingDetailExtras.tsx` |
| Price banner | `BookingPriceUpdateBanner.tsx` |
| Detail fee footer | `BookingPricingBreakdown.tsx` → `ClientFeeBreakdownSummary` |

---

## Tests to read

- `backend/tests/test_status_pricing_confirmation.py` — accept/decline with adjustments
- `backend/tests/test_adjustments.py` — surcharge caps
- `backend/tests/test_booking_list_labels.py` — `has_price_update` list flag
