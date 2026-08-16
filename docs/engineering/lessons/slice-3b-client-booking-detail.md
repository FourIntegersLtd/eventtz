# Slice 3b — Client booking: detail, status, adjustments

**Walkthrough:** `slice-3b-booking-detail-walkthrough.md` — traces one redirect after enquire → detail load → vendor price update → client accept/decline.

### User story

A **signed-in client** opens `/client/bookings/{id}` after sending an enquiry (Slice 3a). They see booking status, snapshotted packages, and any vendor price changes. They can **accept or decline** a vendor quote or an updated price, **cancel** while still open, and see banners when payment is due (Slice 4) or completion is waiting.

**Guests** cannot open client bookings — the portal requires a client session.

---

## What happens at a glance

```
Slice 3a redirect → /client/bookings/{id}
    → fetchClientBookingDetail(id)
        → GET /client/booking-requests/{id}
        → get_booking_request_for_client() + build_pricing_breakdown()
    → BookingDetailPanel (shared UI) + ClientBookingDetailExtras (client banners)

Vendor adds adjustments (vendor portal, while pending)
    → PUT /vendor/booking-requests/{id}/adjustments
    → client detail reloads → BookingPriceUpdateBanner

Client accepts updated price
    → PATCH /client/booking-requests/{id}/status  { status: "accepted" }
    → booking_status = accepted → payment due banner (Slice 4)
```

---

## Two lifecycles on one row

Every `booking_requests` row tracks **two independent fields**:

| Field | Question it answers | Example values |
|-------|---------------------|----------------|
| `booking_status` (API: `booking_status`) | Has the booking been agreed / finished / closed? | `pending`, `accepted`, `completed`, `declined`, `cancelled` |
| `payment_status` | Has money moved? | `unpaid`, `pending`, `paid`, `refunded`, `payout_released` |

Plain English: you can be **accepted but unpaid** (vendor said yes, client still owes money) or **pending with a price update** (still negotiating, no payment yet).

**`initiator`** (`client` | `vendor`) changes which buttons appear while `pending`:

| Initiator | Pending means | Client actions on detail |
|-----------|---------------|--------------------------|
| `client` | Client sent enquiry; vendor may add adjustments | Wait, or respond to **price update** banner |
| `vendor` | Vendor sent quote; client must respond | **Accept quote** / **Decline** in header |

---

## Complete route — open booking detail

### Frontend (route → controller → shared panel)

1. `frontend/app/client/(portal)/bookings/layout.tsx` — portal shell for bookings section
2. `frontend/app/client/(portal)/bookings/page.tsx` — `/client/bookings` list-only
3. `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx` — `/client/bookings/{id}` detail route
4. `frontend/features/client/bookings/ClientBookingsView.tsx` — master–detail layout, confirm dialogs, chat drawer
5. `frontend/features/client/bookings/useClientBookingsController.ts` — **central hook**: fetch, status patches, cancel, banners
6. `frontend/features/bookings/useParticipantBookingsScaffold.ts` — generic list/detail loading + realtime refresh
7. `frontend/features/client/bookings/clientBookingViewModel.ts` — maps API → shared view model
8. `frontend/features/bookings/BookingDetailPanel.tsx` — status badges, event info, pricing breakdown (shared with vendor)
9. `frontend/features/client/bookings/ClientBookingDetailExtras.tsx` — client-only banners (price update, payment due, completion)
10. `frontend/features/bookings/BookingPriceUpdateBanner.tsx` — accept/decline updated price UI
11. `frontend/features/bookings/BookingPricingBreakdown.tsx` — line items + adjustments + service fee
12. `frontend/lib/clientBookingsApi.ts` — `fetchClientBookingDetail`, `patchClientBookingStatus`, `postCancelClientBooking`
13. `frontend/lib/domain-types.ts` — `BookingStatus`, `VendorAdjustmentItem`, `BookingPricingBreakdown`
14. `frontend/lib/bookingStatusStyles.ts` — badge labels for booking + payment status

### Backend (HTTP → queries → pricing)

15. `backend/app/http/router.py` — mounts client booking router
16. `backend/app/features/bookings/http/client.py` — `GET` detail, `PATCH` status, `POST` cancel
17. `backend/app/features/auth/http/guards.py` — `require_client`
18. `backend/app/contracts/booking.py` — `ClientBookingDetail`, `ClientBookingStatusBody`, `VendorAdjustmentItem`
19. `backend/app/features/bookings/queries.py` — `get_booking_request_for_client`, `_attach_pricing_fields`
20. `backend/app/features/bookings/pricing.py` — `build_pricing_breakdown`
21. `backend/app/features/bookings/pricing_confirmation.py` — `client_price_confirmation_required`
22. `backend/app/features/bookings/status.py` — `update_booking_request_status_for_client`
23. `backend/app/core/db.py` — reads/writes `booking_requests`

### Vendor writes adjustments (client only reads)

24. `backend/app/features/bookings/http/vendor.py` — `PUT /vendor/booking-requests/{id}/adjustments`
25. `backend/app/features/bookings/adjustments.py` — `put_vendor_booking_adjustments`

### Adjacent (named, not Slice 3b core)

- `frontend/app/client/(portal)/bookings/[bookingId]/pay/page.tsx` — Stripe checkout (Slice 4)
- `frontend/features/client/payments/` — pay flow
- `frontend/features/bookings/BookingDisputeSection.tsx` — disputes
- Chat drawer wired from `ClientBookingsView`

---

## Step 1 — Land on detail after enquire

Slice 3a ends with `router.push(`/client/bookings/${bookingId}`)`.

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

The page only passes `bookingId` into `ClientBookingsView`. All logic lives in the controller hook.

---

## Step 2 — Controller loads list + detail

**File:** `useClientBookingsController.ts`

The hook wires API calls into the shared scaffold:

```46:77:frontend/features/client/bookings/useClientBookingsController.ts
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
    tab,
    setTab,
    list,
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

`useParticipantBookingsScaffold` is reused by the **vendor** bookings portal too — same list/detail pattern, different API functions.

**Payment due** (banner trigger, not payment itself):

```96:98:frontend/features/client/bookings/useClientBookingsController.ts
  const paymentDue =
    detail?.booking_status === "accepted" &&
    (detail?.payment_status === "unpaid" || detail?.payment_status === "pending");
```

---

## Step 3 — API client fetches detail

**File:** `clientBookingsApi.ts`

```174:181:frontend/lib/clientBookingsApi.ts
export async function fetchClientBookingDetail(
  bookingId: string,
): Promise<ClientBookingDetail> {
  const { data } = await api.get<ClientBookingDetailResponse>(
    `/api/v1/client/booking-requests/${bookingId}`,
  );
  return data.booking;
}
```

The `ClientBookingDetail` type documents both lifecycles:

```125:126:frontend/lib/clientBookingsApi.ts
  /** Money lifecycle, independent of `booking_status`: unpaid/pending/paid/refunded/partially_refunded/payout_released. */
  payment_status: string;
```

---

## Step 4 — Backend returns enriched detail

**File:** `client.py`

```102:121:backend/app/features/bookings/http/client.py
@router.get("/booking-requests/{booking_id}", response_model=ClientBookingDetailResponse)
def get_client_booking(
    request: Request,
    response: Response,
    booking_id: str,
) -> ClientBookingDetailResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    ...
    row = get_booking_request_for_client(client_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return ClientBookingDetailResponse(booking=ClientBookingDetail(**row))
```

**File:** `queries.py` — `_attach_pricing_fields` recomputes totals from snapshot `line_items` + `vendor_adjustments` every time detail is loaded. The DB stores the snapshot; the API always returns fresh math.

Contract shape (`backend/app/contracts/booking.py`):

```305:336:backend/app/contracts/booking.py
class ClientBookingDetail(BaseModel):
    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")
    ...
    line_items: list[dict[str, Any]]
    vendor_adjustments: list[VendorAdjustmentItem] = Field(default_factory=list)
    pricing: BookingPricingBreakdown | None = None
    initial_client_total_label: str | None = None
    ...
    payment_status: str = "unpaid"
    ...
    initiator: Literal["client", "vendor"] = "client"
```

---

## Step 5 — Shared detail panel renders status + pricing

**File:** `BookingDetailPanel.tsx`

Status and payment badges sit at the top of every booking detail (client and vendor):

```111:115:frontend/features/bookings/BookingDetailPanel.tsx
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            {booking.paymentStatus ? (
              <PaymentStatusBadge status={booking.paymentStatus} />
            ) : null}
```

`BookingPricingBreakdown` shows snapshotted packages plus any `vendor_adjustments` lines and the platform service fee.

---

## Step 6 — Vendor adjustments (write path)

Vendors add surcharges or discounts **while the booking is still `pending`** and **client-initiated** (`initiator = client`).

**File:** `adjustments.py`

```57:78:backend/app/features/bookings/adjustments.py
def put_vendor_booking_adjustments(
    vendor_user_id: str,
    booking_id: str,
    adjustments_in: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Replace the vendor's extra costs and discounts while the booking is still pending."""
    ...
    if _row_initiator(row0) == "vendor":
        raise ValueError(booking_messages.ADJUSTMENTS_NOT_ON_VENDOR_QUOTE)
    if str(row0.get("status", "")) != "pending":
        raise ValueError(booking_messages.ADDITIONAL_COSTS_PENDING_ONLY)
```

Each adjustment: `{ tag/adjustment_category, label, amount_gbp }` — positive = extra cost, negative = discount.

On first adjustment set, the backend snapshots `initial_client_total_label` so the UI can show a **“was”** price.

**Client does not POST adjustments.** They only read them on detail and respond via status patch.

---

## Step 7 — Price update banner (client read + respond)

**File:** `useClientBookingsController.ts`

```342:345:frontend/features/client/bookings/useClientBookingsController.ts
  const showUpdatedPriceBanner =
    detail?.booking_status === "pending" &&
    detail.initiator === "client" &&
    detail.vendor_adjustments.length > 0;
```

**File:** `ClientBookingDetailExtras.tsx` renders `BookingPriceUpdateBanner` with was/now totals.

Accept or decline calls the **same** status endpoint as vendor-quote accept/decline:

```197:224:frontend/features/client/bookings/useClientBookingsController.ts
  const applyClientUpdatedPriceResponse = async (next: "accepted" | "declined") => {
    ...
    await patchClientBookingStatus(bookingId, next);
    ...
  };
```

Backend guard (`pricing_confirmation.py`):

```14:21:backend/app/features/bookings/pricing_confirmation.py
def client_price_confirmation_required(row: dict[str, Any]) -> bool:
    """True when a client-initiated pending booking has vendor price changes waiting for the client."""
    if str(row.get("status", "")) != "pending":
        return False
    initiator = row.get("initiator")
    if initiator == "vendor":
        return False
    return len(normalize_vendor_adjustments_list(row.get("vendor_adjustments"))) > 0
```

**Decline updated price** — booking stays `pending` at the **original** price; adjustments cleared:

```410:429:backend/app/features/bookings/status.py
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

**Accept updated price** — `booking_status` becomes `accepted`; client sees payment-due banner (Slice 4).

---

## Step 8 — Vendor-initiated quote on detail

When `initiator === "vendor"` and `booking_status === "pending"`, header actions show **Accept quote** / **Decline**:

```388:409:frontend/features/client/bookings/useClientBookingsController.ts
  if (detail && detail.initiator === "vendor" && detail.booking_status === "pending") {
    headerActions.push(
      { key: "accept", label: "Accept quote", ... onClick: () => void applyClientQuoteResponse("accepted") },
      { key: "decline", label: "Decline", ... onClick: () => setDeclineQuoteOpen(true) },
    );
  }
```

Declining a vendor quote closes the booking (`declined`). Accepting moves to `accepted` (may require venue postcode before pay — see `ClientBookingStatusBody`).

---

## Step 9 — Cancel and completion (status edges)

**Cancel** — footer action while `pending` or `accepted` (with guards for payout released):

```356:371:frontend/features/client/bookings/useClientBookingsController.ts
  const canCancel =
    detail &&
    (detail.booking_status === "pending" || detail.booking_status === "accepted") &&
    detail.payment_status !== "payout_released" &&
    !(detail.initiator === "vendor" && detail.booking_status === "pending");
```

Calls `POST /client/booking-requests/{id}/cancel`.

**Confirm completion** — after event, when `accepted` + `paid`, client can confirm event complete (`POST .../confirm-completion`). Slice 6 covers payout release.

---

## Full chain (one picture)

```
Enquire (3a) → redirect /client/bookings/{id}
  ↓
[bookingId]/page.tsx → ClientBookingsView
  ↓
useClientBookingsController
  → fetchClientBookingDetail
  → GET /api/v1/client/booking-requests/{id}
  → get_booking_request_for_client + build_pricing_breakdown
  ↓
BookingDetailPanel (status + pricing)
ClientBookingDetailExtras (banners)

Vendor: PUT .../adjustments → vendor_adjustments on row
  ↓
Client reload → BookingPriceUpdateBanner
  ↓
PATCH .../status accepted|declined
  → update_booking_request_status_for_client
  → accepted (pay next) OR pending at original price (decline)
```

---

## Why two status fields?

- **`booking_status`** — negotiation and fulfilment lifecycle (agree → complete).
- **`payment_status`** — money lifecycle (Stripe checkout, refund, payout).
- **Orthogonal by design** — lets the UI show “Accepted · Unpaid” without overloading one enum.

## Why adjustments instead of editing line_items?

- **`line_items`** are the **snapshot** from enquire time (Slice 3a) — the agreed catalog packages.
- **Adjustments** are pre-accept extras/discounts the vendor adds on top — they do not rewrite the catalog snapshot.
- Client must **confirm** adjustments before the booking becomes `accepted`.

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| 404 on detail | Wrong booking id or not your booking — `get_booking_request_for_client` |
| Price banner missing | `showUpdatedPriceBanner` conditions; check `initiator` + `vendor_adjustments` |
| “Only pending accept/decline” | `status.py` — booking already accepted/closed |
| PATCH status 400 | `update_booking_request_status_for_client` — wrong initiator for action |
| Totals look wrong | `pricing.py` `build_pricing_breakdown`; compare `line_items` vs `vendor_adjustments` |
| List says “New price” but detail doesn’t | `has_price_update` in `queries.py` vs detail `vendor_adjustments` |
| Payment banner but pay fails | Slice 4 — `/pay` route and checkout |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Shared `BookingDetailPanel` for client + vendor | **Leave it alone** — one source of truth for layout |
| Same `PATCH /status` for quote + price update | **Leave it alone** — backend disambiguates via `initiator` |
| `useParticipantBookingsScaffold` reuse | **Leave it alone** — DRY list/detail pattern |
| Decline price reverts to `pending` (not `declined`) | **Leave it alone** — keeps negotiation open |
| Payment sync effects in detail controller | **Improve later** — could be a dedicated hook (Slice 4) |

---

## Key concepts from this slice

- **Booking status** — request lifecycle: `pending` → `accepted` → `completed`, or closed via `declined` / `cancelled`.
- **Payment status** — money lifecycle on the same row; independent of booking status.
- **Initiator** — who started the request; drives which pending actions apply.
- **Vendor adjustment** — pre-accept surcharge/discount line; not a catalog package change.
- **Price update** — pending client-initiated booking with non-empty `vendor_adjustments`.
- **`initial_client_total_label`** — client total at enquiry time; “was” price in the banner.
- **`client_price_confirmation_required`** — backend guard before vendor can accept a adjusted booking.
- **Master–detail scaffold** — `useParticipantBookingsScaffold` + shared panels.

---

## TL;DR

- **Detail** = `GET /api/v1/client/booking-requests/{id}` → `ClientBookingDetail` with pricing breakdown.
- **Two lifecycles** — `booking_status` (agreement) and `payment_status` (money) on one row.
- **Adjustments** — vendor writes via `PUT .../adjustments`; client reads and confirms via `PATCH .../status`.
- **Price update banner** — `pending` + `initiator=client` + adjustments present.
- **Decline price** — clears adjustments, stays `pending` at original snapshot price.
- **Next:** Slice 4 — client payment (`/client/bookings/{id}/pay`, Stripe Checkout).

---

## Related lessons

- Slice 3a: `slice-3a-client-booking-enquire.md`, `slice-3a-enquire-flow-walkthrough.md`
- Slice 2: `slice-2-client-browse.md`
- Slice 1: `slice-1-auth-me.md`
