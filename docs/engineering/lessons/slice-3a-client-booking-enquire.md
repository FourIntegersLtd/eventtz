# Slice 3a — Client booking: enquire

**Walkthrough:** `slice-3a-enquire-flow-walkthrough.md` — traces one click button → DB row with example payload.

### User story

A **signed-in client** picks packages on a vendor profile (or selects several vendors on browse), fills event details, and sends an enquiry. The backend creates a `booking_requests` row with **snapshotted prices**, status **`pending`**, payment **`unpaid`**. The vendor is notified; the client lands on booking detail to wait for a response.

**Guests** can browse but see “Sign in / Create account” instead of enquire.

---

## What happens at a glance

```
Client picks packages → VendorBookingModal → POST /client/booking-requests
    → create_booking_request()
        → resolve_line_items()   (prices from vendor profile, not browser)
        → insert booking_requests (pending)
        → notes → chat
        → notify vendor + client
    → redirect /client/bookings/{id}
```

---

## Complete route — single vendor enquire

### Frontend (profile → modal → API)

1. `frontend/app/client/(portal)/browse/[userId]/page.tsx` — route `/client/browse/[userId]`
2. `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx` — orchestration
3. `frontend/features/client/browse/useExploreVendor.ts` — loads vendor (public explore API, Slice 2)
4. `frontend/features/client/browse/VendorBrowseDetailBody.tsx` — packages UI + “Request booking”
5. `frontend/features/client/browse/vendorBrowseDetailModel.ts` — `buildBrowsePricingOptions`, `buildBookingLineItems`
6. `frontend/features/bookings/useLaunchingSoonBookingGuard.tsx` — optional feature-flag gate
7. `frontend/features/client/browse/VendorBookingModal.tsx` — form + submit
8. `frontend/lib/validation/bookings.ts` — `clientBookingRequestSchema` (Zod)
9. `frontend/lib/clientBookingsApi.ts` — `postBookingRequest`
10. `frontend/lib/axios.ts` — session cookies (`withCredentials`)

### Backend (HTTP → business logic → DB)

11. `backend/app/http/router.py` — mounts client booking router
12. `backend/app/features/bookings/http/client.py` — `POST /booking-requests`
13. `backend/app/features/auth/http/guards.py` — `require_client`
14. `backend/app/contracts/booking.py` — `CreateBookingRequestBody`, `BookingRequestCreated`
15. `backend/app/features/bookings/create.py` — `create_booking_request`
16. `backend/app/features/vendors/list_pricing.py` — `resolve_line_items` (snapshot)
17. `backend/app/features/bookings/pricing.py` — `build_pricing_breakdown`, totals
18. `backend/app/features/bookings/calendar.py` — availability + capacity checks
19. `backend/app/features/client_events/events.py` — link/create celebration event
20. `backend/app/features/chat/service.py` — notes → first chat message
21. `backend/app/features/email/dispatch.py` — in-app + email notifications
22. `backend/app/core/db.py` — `booking_requests` insert

### After success

23. `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx` — booking detail (Slice 3b)

---

## Complete route — multi-vendor enquire (browse grid)

Same API from step 9 onward. Different UI entry:

1. `frontend/app/client/(portal)/browse/page.tsx` — `/client/browse`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx` — multi-select + “Message N together”
3. `frontend/features/marketplace/MultiVendorEnquireModal.tsx` — one brief, **N sequential** `postBookingRequest` calls
4. `frontend/features/bookings/MultiVendorPackagePicker.tsx` — pick one package per vendor

---

## Step 1 — Who can enquire?

Browse is **public** (Slice 2). Enquire requires a **client** session.

**File:** `ClientVendorBrowseDetailView.tsx`

```150:150:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const isClient = user?.user_type === "client";
```

```215:225:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
          onRequestBooking={
            isClient
              ? (ids) => {
                  guardBooking(() => {
                    setBookingSelectionIds(ids);
                    setBookingOpen(true);
                    track(MixpanelEvents.enquiry_started, { vendor_user_id: userId });
                  });
                }
              : undefined
          }
```

| User | Sees on profile |
|------|-----------------|
| Guest | Login / register links (`requireLoginForActions`) |
| Client | “Request booking” → modal |
| Vendor / admin browsing | Public chrome, no enquire hook |

**Backend:** `require_client` on the POST handler — 401/403 without a valid client session.

---

## Step 2 — Package selection on the profile

**File:** `VendorBrowseDetailBody.tsx`

Client ticks packages/rates on the vendor profile. Selected option IDs are passed into the modal as `initialSelectedIds`.

**File:** `vendorBrowseDetailModel.ts`

- `buildBrowsePricingOptions(vendor)` — turns `profile_form_data.packages` into selectable options with stable `id` strings
- `buildBookingLineItems` — UI-only estimate (server recomputes on submit)

Plain English: the UI shows prices for convenience, but the **server** re-reads the vendor profile when you submit.

---

## Step 3 — VendorBookingModal (the form)

**File:** `VendorBookingModal.tsx`

Fields the client fills:

| Field | Payload field |
|-------|----------------|
| Event name | `event_name` |
| Event date(s) | `event_date`, `event_end_date` |
| Venue address | `event_address` |
| Notes to vendor | `notes` |
| Selected packages | `selected_option_ids` |

Prefill sources:

- Browse URL dates → `searchPrefill`
- Planner handoff → `initialPrefill` from query params
- Linked celebration → `linkedEventId` / `event_id`
- Search context → `clientSearchContext` (for analytics + nudges)

Submit handler:

```216:227:frontend/features/client/browse/VendorBookingModal.tsx
    void postBookingRequest({
      vendor_user_id: vendorUserId,
      event_name: parsed.data.eventName,
      event_date: parsed.data.eventDate,
      event_end_date: parsed.data.eventEndDate?.trim() || null,
      event_postcode: null,
      event_address: (parsed.data.venueAddress ?? "").trim() || null,
      notes: (parsed.data.notes ?? "").trim() || null,
      selected_option_ids: parsed.data.selectedOptionIds,
      client_search_context: clientSearchContext ?? undefined,
      event_id: selectedEventId,
    })
```

**Important:** No prices in the payload — only `selected_option_ids`.

---

## Step 4 — Frontend API call

**File:** `clientBookingsApi.ts`

```27:56:frontend/lib/clientBookingsApi.ts
export type CreateBookingRequestPayload = {
  vendor_user_id: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  event_postcode?: string | null;
  event_address?: string | null;
  notes: string | null;
  selected_option_ids: string[];
  client_search_context?: ClientSearchContext | null;
  event_id?: string | null;
};

export async function postBookingRequest(
  payload: CreateBookingRequestPayload,
): Promise<BookingRequestCreated> {
  const { data } = await api.post<BookingRequestCreated>("/api/v1/client/booking-requests", payload);
  return data;
}
```

Response shape (`BookingRequestCreated`):

```json
{
  "success": true,
  "booking_request_id": "uuid",
  "booking_status": "pending",
  "created_at": "2026-08-16T12:00:00+00:00",
  "event_id": "optional-celebration-uuid"
}
```

---

## Step 5 — Backend HTTP handler

**File:** `backend/app/features/bookings/http/client.py`

```409:453:backend/app/features/bookings/http/client.py
@router.post("/booking-requests", response_model=BookingRequestCreated)
def post_booking_request(
    request: Request,
    response: Response,
    body: CreateBookingRequestBody,
) -> BookingRequestCreated:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    # ...
    out = create_booking_request(
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        event_name=body.event_name,
        event_date=body.event_date,
        event_end_date=body.event_end_date,
        # ...
        selected_option_ids=body.selected_option_ids,
        client_search_context=body.client_search_context,
        event_id=body.event_id,
    )
    return BookingRequestCreated(
        id=str(out["id"]),
        status="pending",
        created_at=created_at if isinstance(created_at, str) else None,
        event_id=str(out.get("event_id") or "") or None,
    )
```

**Contract validation** (`CreateBookingRequestBody`):

- Event date not in the past
- End date ≥ start date
- At least one `selected_option_ids`
- Notes max 4000 chars

---

## Step 6 — `create_booking_request` (core logic)

**File:** `backend/app/features/bookings/create.py`

Walk in order:

### 6a — Guards

```176:186:backend/app/features/bookings/create.py
    if client_user_id == vendor_user_id:
        raise ValueError(booking_messages.CANNOT_BOOK_OWN_VENDOR)

    if not _vendor_is_approved_for_explore(vendor_user_id):
        raise ValueError(booking_messages.VENDOR_NOT_AVAILABLE_FULL)

    assert_user_not_suspended(client_user_id)
    assert_user_not_suspended(vendor_user_id)

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date)
```

Same bookability rules as browse listing + hard calendar check.

### 6b — Snapshot line items (the key modeling idea)

```189:203:backend/app/features/bookings/create.py
    payload = get_bookable_vendor_profile_form_data(vendor_user_id)
    line_items = resolve_line_items(payload, selected_option_ids)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
    client_total = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
```

**File:** `list_pricing.py` — `resolve_line_items`

```229:262:backend/app/features/vendors/list_pricing.py
def resolve_line_items(
    payload: dict[str, Any],
    selected_option_ids: list[str],
) -> list[dict[str, Any]]:
    options = build_pricing_options(payload)
    by_id = {o.id: o for o in options}
    for oid in unique_ids:
        opt = by_id.get(oid)
        if opt is None:
            raise ValueError(vendor_messages.PACKAGES_NO_LONGER_AVAILABLE)
        line_items.append(_option_to_line_item(opt))
```

Plain English: if the vendor later changes a package from £200 → £300, this enquiry still shows £200 in `line_items` JSON.

### 6c — Insert row

```218:235:backend/app/features/bookings/create.py
    row_out: dict[str, Any] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        **event_fields,
        "notes": (notes.strip() if notes else None),
        "status": "pending",
        "selected_option_ids": selected_option_ids,
        "line_items": line_items,
        "total_label": persisted_booking_total_label(pb),
        "initial_client_total_label": client_total,
        "vendor_adjustments": [],
        "initiator": "client",
    }
    res = get_db().table("booking_requests").insert(row_out).execute()
```

| Column | Value at enquire |
|--------|------------------|
| `status` | `pending` |
| `payment_status` | `unpaid` (DB default) |
| `initiator` | `client` |
| `line_items` | JSON snapshot |
| `client_search_context` | optional browse filters |

### 6d — Side effects after insert

1. **Notes → chat** — `_post_client_booking_notes_to_chat` creates DM, inserts message with `metadata.source = "booking_notes"`
2. **Vendor notification** — `dispatch_booking_notification(..., kind="booking_request_received")`
3. **Client confirmation** — `booking_request_sent`
4. **Realtime** — `_notify_booking_changed` (SSE)
5. **Analytics** — `enquiry_created`, optional `enquiry_multi_created`
6. **Celebration event** — `resolve_event_for_booking` links or creates `client_events` row

---

## Step 7 — Success UX

**File:** `ClientVendorBrowseDetailView.tsx`

```232:239:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: "Request sent",
                description: `${businessName} will be notified. ${usualReplyExpectation(vendor.avg_response_seconds)}`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
            }}
```

Client lands on `/client/bookings/{bookingId}` — **Slice 3b** (detail, status, chat, pay later).

---

## Multi-vendor enquire (browse grid)

**File:** `MarketplaceExploreView.tsx`

Signed-in clients can checkbox vendors → sticky bar → “Message N together” → `MultiVendorEnquireModal`.

- One shared event brief
- One package per vendor (`MultiVendorPackagePicker`)
- **Sequential** `postBookingRequest` per vendor (not one bulk API)
- First successful response may return `event_id`; later calls reuse it so all enquiries link to one celebration

`client_search_context` includes `source: "multi"`, `batchSize`, `batchIndex` for analytics.

---

## Models vs SQL (what to remember)

| Concept | Contract / type | Stored in |
|---------|---------------|-----------|
| Enquiry payload | `CreateBookingRequestBody` | — (request only) |
| Created response | `BookingRequestCreated` | — (response only) |
| Persisted booking | row in `booking_requests` | Postgres via Supabase |
| Price snapshot | `line_items` JSON on row | not live join to vendor packages |
| Package IDs sent | `selected_option_ids` | also stored on row |

Table definition: `backend/sql/010_booking_requests.sql`

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Browse view | Public read |
| Enquire button | `user_type === "client"` |
| POST API | `require_client` |
| Cannot book self | `create_booking_request` |
| Vendor must be bookable | same as explore listing |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| 401 on enquire | Session cookie / `AuthProvider` / `require_client` |
| “Packages no longer available” | Vendor edited packages; client had stale IDs |
| “Event date cannot be in the past” | `CreateBookingRequestBody` validator |
| Calendar rejected | `calendar.py` — blocked dates / weekdays |
| Price looks wrong on UI but right on booking | UI estimate vs server `build_pricing_breakdown` |
| Notes missing in chat | `ensure_client_booking_notes_in_chat` in `create.py` |
| Vendor not notified | `dispatch_booking_notification` / email config |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Server-side `resolve_line_items` snapshot | **Leave it alone** — correct commerce modeling |
| IDs-only payload from browser | **Leave it alone** — prevents price tampering |
| Multi-vendor = N POSTs | **Improve later** — could be one batch endpoint |
| Calendar warning in modal vs hard reject on server | **Leave it alone** — good UX + safety |

---

## Key concepts from this slice

- **Enquiry vs booking paid** — enquire creates `pending` + `unpaid`; payment is Slice 4.
- **Snapshot `line_items`** — agreed prices frozen at submit time.
- **selected_option_ids** — client sends IDs; server resolves prices.
- **initiator `client`** — vendor-initiated quotes use a different create path (`create_vendor_quote_booking_request`).
- **client_search_context** — remembers browse filters for product analytics.

---

## TL;DR

- **Enquire** = `POST /api/v1/client/booking-requests` from `VendorBookingModal` or `MultiVendorEnquireModal`.
- **Only clients** with a valid session; guests must sign in.
- **Server** copies package prices into `line_items`; browser cannot set £1.
- **Row** starts `pending` / `unpaid`; vendor notified; notes go to chat.
- **Next:** Slice 3b — client booking detail page (`/client/bookings/[id]`).

---

## Related lessons

- Slice 2: `slice-2-client-browse.md`, `slice-2-browse-flow-walkthrough.md`
- Domain modeling intro: `PROGRESS.md` Day 2 trace (`create.py` → `list_pricing.py`)
