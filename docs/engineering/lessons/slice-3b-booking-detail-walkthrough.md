# Slice 3b — Booking detail walkthrough (thorough)

Trace **one booking** from post-enquire redirect → detail load → vendor price update → client accept. Read this when `slice-3b-client-booking-detail.md` feels too high-level.

**Detail endpoint:** `GET /api/v1/client/booking-requests/{id}`  
**Status endpoint:** `PATCH /api/v1/client/booking-requests/{id}/status`  
**Orchestrator:** `get_booking_request_for_client` in `queries.py`; `update_booking_request_status_for_client` in `status.py`

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  Slice 3a — enquire creates pending/unpaid row             │
│  redirect → /client/bookings/{id}                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ fetchClientBookingDetail
┌────────────────────────────▼─────────────────────────────────┐
│  Detail — status badge + snapshot line_items + pricing       │
│  BookingDetailPanel + ClientBookingDetailExtras              │
└────────────────────────────┬─────────────────────────────────┘
                             │ vendor PUT adjustments (optional)
┌────────────────────────────▼─────────────────────────────────┐
│  Price update — BookingPriceUpdateBanner                     │
│  client PATCH status accepted → accepted/unpaid              │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** `line_items` are frozen at enquire. Adjustments are **extra lines** the vendor adds before accept. Client must confirm.

---

## Scenario A — Fresh enquiry lands on detail

**Setup:** Client completed Slice 3a enquire. Browser at `/client/bookings/abc-booking-uuid`. Row: `status=pending`, `payment_status=unpaid`, `initiator=client`, `vendor_adjustments=[]`.

---

### Step 1 — Route passes booking id

**File:** `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx`

```tsx
<ClientBookingsView selectedBookingId={bookingId} />
```

No fetch here — `useClientBookingsController` inside the view handles it.

---

### Step 2 — Scaffold fetches detail

**File:** `useParticipantBookingsScaffold.ts`

When `selectedBookingId` is set, the scaffold calls `fetchDetail(selectedBookingId)` and stores the result in `detail`.

Parallel: fetches the **list** for the left panel (`fetchClientBookings({ group: tab })`).

---

### Step 3 — HTTP GET detail

**File:** `clientBookingsApi.ts`

```
GET /api/v1/client/booking-requests/abc-booking-uuid
Cookie: eventtz_access_token=...
```

**File:** `client.py` → `require_client` → `get_booking_request_for_client(client_id, booking_id)`

**File:** `queries.py`

1. `SELECT * FROM booking_requests WHERE id = ? AND client_user_id = ?`
2. `_attach_pricing_fields(row)` — builds `pricing` object from `line_items` + `vendor_adjustments`
3. `initial_client_total_label` — “was” price for future adjustments
4. `apply_counterparty_contact_visibility` — phone hidden until paid + accepted

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
      "client_total_gbp": 210,
      "client_total_label": "£210"
    },
    "vendor_display_name": "Sparkle Events"
  }
}
```

---

### Step 4 — View model + panel render

**File:** `clientBookingViewModel.ts` → `toClientBookingDetailViewModel(detail)`

Maps API fields to `BookingDetailViewModel` (shared with vendor portal).

**File:** `BookingDetailPanel.tsx`

- `StatusBadge` → “Pending”
- No `PaymentStatusBadge` when `unpaid` (hidden by convention)
- `BookingPricingBreakdown` → Gold package £200 + service fee → £210 total
- “Message vendor” opens chat drawer

**File:** `ClientBookingDetailExtras.tsx`

- No price update banner (`vendor_adjustments` empty)
- No payment due banner (`booking_status !== "accepted"`)
- Footer: **Cancel booking** available

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
- Recomputes `total_label` via `build_pricing_breakdown`
- Sets `initial_client_total_label` on first adjustment (snapshot “was £210”)
- Notifies client (`booking_pricing_updated`)

---

### Step 6 — Client detail refreshes

Realtime event `bookings:refresh` or navigation bump triggers `bumpDetail()` → re-fetch detail.

**Controller:**

```typescript
const showUpdatedPriceBanner =
  detail?.booking_status === "pending" &&
  detail.initiator === "client" &&
  detail.vendor_adjustments.length > 0;
// → true
```

**File:** `BookingPriceUpdateBanner.tsx`

| UI element | Source |
|------------|--------|
| Was price | `resolveWasClientTotalLabel(detail)` → `initial_client_total_label` or pre-adjustment total |
| Now price | `detail.pricing.client_total_label` → e.g. “£262.50” |
| Line items | `pricing.vendor_adjustments` → Travel surcharge £50 |
| Accept / Decline | `onAccept` / `onDecline` → `applyClientUpdatedPriceResponse` |

List row subtext (left panel): “New price. Your response needed” via `has_price_update` flag from list API.

---

### Step 7a — Client accepts updated price

**UI:** Click **Accept** on banner.

**File:** `useClientBookingsController.ts`

```typescript
await patchClientBookingStatus(bookingId, "accepted");
```

**HTTP:**

```
PATCH /api/v1/client/booking-requests/abc-booking-uuid/status
{ "booking_status": "accepted" }
```

**File:** `status.py` → `update_booking_request_status_for_client`

- Confirms `client_price_confirmation_required(row)` is true
- Updates `status` to `accepted`
- Notifies vendor
- Returns updated row

**UI after refresh:**

- `StatusBadge` → “Accepted”
- Price banner gone
- `paymentDue` → true → “Payment needed” banner with **Pay now** → `/client/bookings/{id}/pay` (Slice 4)

---

### Step 7b — Client declines updated price (alternate path)

**UI:** Click **Decline** on banner → confirm dialog.

**HTTP:** same `PATCH` with `{ "booking_status": "declined" }`

**File:** `status.py` (updated-price branch)

```python
revert_payload = {
    "vendor_adjustments": [],
    "total_label": persisted_booking_total_label(pb),  # original snapshot total
}
# status stays "pending"
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
| Accept | `PATCH status accepted` — may require venue postcode in body |
| Decline | `PATCH status declined` — booking closes |

Same endpoint, different backend branch in `status.py` (`is_vendor_quote` vs `is_updated_price`).

---

## Scenario D — Cancel from detail

**UI:** Footer **Cancel booking** → confirm dialog.

**HTTP:** `POST /api/v1/client/booking-requests/{id}/cancel`

**Result:** `booking_status = cancelled`. If already paid, refund logic runs (Slice 4/6 territory).

---

## Status + payment matrix (quick reference)

| booking_status | payment_status | Typical client view |
|----------------|----------------|---------------------|
| `pending` | `unpaid` | Waiting for vendor / price update banner |
| `accepted` | `unpaid` | Payment needed banner |
| `accepted` | `paid` | Confirmed; may show completion banner after event |
| `completed` | `payout_released` | Done; review form |
| `declined` | `unpaid` | Closed |
| `cancelled` | `refunded` | Closed + refund message |

---

## Files to open when debugging

| Step | File |
|------|------|
| Route | `[bookingId]/page.tsx` |
| Fetch + banners | `useClientBookingsController.ts` |
| API types | `clientBookingsApi.ts` |
| GET handler | `bookings/http/client.py` |
| Detail query | `bookings/queries.py` |
| Pricing math | `bookings/pricing.py` |
| Status patch | `bookings/status.py` |
| Adjustment write | `bookings/adjustments.py` |
| Price confirmation guard | `bookings/pricing_confirmation.py` |
| Shared panel | `BookingDetailPanel.tsx` |
| Price banner | `BookingPriceUpdateBanner.tsx` |

---

## Tests to read

- `backend/tests/test_status_pricing_confirmation.py` — accept/decline with adjustments
- `backend/tests/test_adjustments.py` — surcharge caps
- `backend/tests/test_booking_list_labels.py` — `has_price_update` list flag
