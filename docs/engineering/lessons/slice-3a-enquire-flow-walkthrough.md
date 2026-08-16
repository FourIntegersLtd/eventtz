# Slice 3a — Enquire flow walkthrough (thorough)

Trace **one enquire click** from button → DB row → redirect. Read this when `slice-3a-client-booking-enquire.md` feels too high-level.

**For the full booking form UI, state, validation, and parameter mapping (form → API → DB), see the main lesson Steps 3–8.**

**Endpoint:** `POST /api/v1/client/booking-requests`  
**Orchestrator:** `create_booking_request` in `backend/app/features/bookings/create.py`

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  UI — pick package IDs on profile (prices shown for UX only) │
│  guardBooking → VendorBrowseDetailBody → VendorBookingModal  │
└────────────────────────────┬─────────────────────────────────┘
                             │ postBookingRequest({ selected_option_ids, ... })
┌────────────────────────────▼─────────────────────────────────┐
│  HTTP — require_client, CreateBookingRequestBody validation  │
│  client.py → create_booking_request()                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ resolve_line_items + resolve_event_for_booking
┌────────────────────────────▼─────────────────────────────────┐
│  DB — booking_requests row: pending, line_items JSON snapshot │
│  + chat notes + notifications + analytics + success modal      │
│  → View booking → redirect to booking detail                   │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** Browser sends **IDs only**. Server copies prices into `line_items`. Client cannot POST `£1`.

---

## Scenario — single vendor enquire

**Setup:** Client logged in. Opens `/client/browse/abc-vendor-uuid`. Ticks “Gold package” (`id: pkg-gold`). Clicks “Request booking”. Fills event name “Ada’s 30th”, date 2026-09-20, notes “Outdoor garden”.

---

## Step 1 — Route loads detail view

**File:** `frontend/app/client/(portal)/browse/[userId]/page.tsx`

```tsx
export default function ClientVendorDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading vendor…" ... />}>
      <ClientVendorBrowseDetailView />
    </Suspense>
  );
}
```

No enquire logic here — all in `ClientVendorBrowseDetailView`.

---

## Step 2 — Load vendor (read-only, Slice 2)

**File:** `ClientVendorBrowseDetailView.tsx`

```43:43:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
```

`useExploreVendor` → `GET /api/v1/vendors/explore/vendor/{id}` (public, no auth).

---

## Step 3 — Build pricing options from profile JSON

**File:** `vendorBrowseDetailModel.ts` — `buildBrowsePricingOptions(vendor)`

Reads `vendor.profile_form_data.packages` (or hourly/daily rates, or quote-only).

Each option gets a stable `id` (e.g. `pkg-gold`, `fixed-hourly`, `quote`).

**File:** `VendorBrowseDetailBody.tsx`

```102:110:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedLineItems = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selectedPackageIds]),
    [pricingOptions, selectedPackageIds],
  );
```

`buildBookingLineItems` — UI estimate only. **Not sent to API as prices.**

---

## Step 4 — Guest vs client on the button

```193:233:frontend/features/client/browse/VendorBrowseDetailBody.tsx
        {requireLoginForActions ? (
          <> Create account / Sign in ... </>
        ) : onRequestBooking ? (
          <Button onClick={() => {
                if (selectedPackageIds.size === 0) { setBookingSelectError(true); return; }
                onRequestBooking([...selectedPackageIds]);
              }}>
            Request booking
          </Button>
```

| `requireLoginForActions` | `onRequestBooking` | What user sees |
|--------------------------|-------------------|----------------|
| `true` (guest) | — | Register / sign in |
| `false` + client | defined | Request booking |
| `false` + no hook | undefined | Continue only |

**File:** `ClientVendorBrowseDetailView.tsx`

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

`guardBooking` (from `useLaunchingSoonBookingGuard`) may show a launching-soon modal instead of opening the booking form when the feature flag is on.

`isClient` = `user?.user_type === "client"`.

---

## Step 5 — Modal opens with fixed package selection

```228:250:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
        {user && bookingOpen && vendor ? (
          <VendorBookingModal
            key={`${bookingSelectionIds.slice().sort().join("|")}|${searchParams.toString()}`}
            onClose={() => setBookingOpen(false)}
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: "Request sent",
                description: `${businessName} will be notified. ${usualReplyExpectation(vendor.avg_response_seconds)}`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
            }}
            vendorDisplayName={businessName}
            vendorUserId={userId}
            pricingOptions={pricingOptions}
            initialSelectedIds={bookingSelectionIds}
            vendorPayload={vendorPayload}
            searchPrefill={bookingSearchPrefill}
            initialPrefill={plannerEventPrefill}
            linkedEventId={linkedEventId}
            clientSearchContext={bookingClientSearchContext}
          />
        ) : null}
```

Modal does **not** let you change packages — close modal, re-pick on profile.

**Prefill:** browse URL dates (`searchPrefill`), planner query params (`initialPrefill`), linked celebration (`linkedEventId` → `useActiveEventPrefill`), or active-event banner (`ActiveEventPrefillBanner`).

**File:** `VendorBookingModal.tsx` — packages are fixed from profile:

```76:77:frontend/features/client/browse/VendorBookingModal.tsx
  // Selection happens once, on the profile sidebar - this modal only confirms dates/venue/notes.
  const selectedIds = useMemo(() => new Set(initialSelectedIds), [initialSelectedIds]);
```

**Form fields** (event name, dates, venue, notes) — see main lesson Step 5 for full JSX snippets.

---

## Step 6 — Client fills form + submit

Fields: `eventName`, `eventDate`, `eventEndDate`, `venueAddress`, `notes`.

**Calendar soft block** — before POST, if dates conflict with vendor calendar:

```208:212:frontend/features/client/browse/VendorBookingModal.tsx
    if (calendarConflict) {
      setValidationError(
        "These dates don’t match this vendor’s availability. Adjust the dates or message them to confirm.",
      );
      return;
    }
```

Validation — **File:** `frontend/lib/validation/bookings.ts`

```27:34:frontend/lib/validation/bookings.ts
export const clientBookingRequestSchema = z
  .object({
    eventName: z.string().trim().min(1, "Enter an event name.").max(500),
    notes: z.string().trim().max(4000).optional().default(""),
    venueAddress: z.string().trim().max(500).optional().default(""),
    selectedOptionIds: z.array(z.string()).min(1, "Choose at least one package."),
  })
  .and(eventDatesSchema({ requireStart: true }));
```

Submit builds payload — **no prices:**

```216:227:frontend/features/client/browse/VendorBookingModal.tsx
    void postBookingRequest({
      vendor_user_id: vendorUserId,
      event_name: parsed.data.eventName,
      event_date: parsed.data.eventDate,
      event_end_date: parsed.data.eventEndDate?.trim() || null,
      event_address: (parsed.data.venueAddress ?? "").trim() || null,
      notes: (parsed.data.notes ?? "").trim() || null,
      selected_option_ids: parsed.data.selectedOptionIds,
      client_search_context: clientSearchContext ?? undefined,
      event_id: selectedEventId,
    })
```

### HTTP request (example)

```http
POST /api/v1/client/booking-requests
Cookie: eventtz_access_token=...

{
  "vendor_user_id": "abc-vendor-uuid",
  "event_name": "Ada's 30th",
  "event_date": "2026-09-20",
  "event_end_date": null,
  "event_address": null,
  "notes": "Outdoor garden",
  "selected_option_ids": ["pkg-gold"],
  "client_search_context": { "q": "...", "country": "GB" }
}
```

---

## Step 7 — `postBookingRequest`

```51:56:frontend/lib/clientBookingsApi.ts
export async function postBookingRequest(
  payload: CreateBookingRequestPayload,
): Promise<BookingRequestCreated> {
  const { data } = await api.post<BookingRequestCreated>("/api/v1/client/booking-requests", payload);
  return data;
}
```

`axios` sends session cookie (`withCredentials: true`).

---

## Step 8 — FastAPI handler

Router: `APIRouter(prefix="/client")` + app `/api/v1` → `/api/v1/client/booking-requests`

```409:436:backend/app/features/bookings/http/client.py
@router.post("/booking-requests", response_model=BookingRequestCreated)
def post_booking_request(...) -> BookingRequestCreated:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    out = create_booking_request(
        client_user_id=client_id,
        vendor_user_id=vendor_id,
        ...
        selected_option_ids=body.selected_option_ids,
    )
```

`require_client` — 401 without session, 403 if not `user_type=client`.

**Contract** `CreateBookingRequestBody` — past dates rejected, min 1 option id.

---

## Step 9 — `create_booking_request` (line by line)

### 9a — Guards

- Cannot book own vendor profile
- Vendor must be bookable (`_vendor_is_approved_for_explore`)
- Neither party suspended
- `_enforce_vendor_calendar` — blocked dates / weekdays
- `_enforce_max_bookings_per_day` — capacity per day
- `BOOKING_NO_VALID_PRICE` — no priced lines and no TBC flag

### 9b — Snapshot prices

```197:202:backend/app/features/bookings/create.py
    line_items = resolve_line_items(payload, selected_option_ids)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)
    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
    if float(pb.get("vendor_portion_gbp") or 0) <= 0 and not pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.BOOKING_NO_VALID_PRICE)
```

**File:** `list_pricing.py` — `resolve_line_items`

For each id in `selected_option_ids`:

1. Find option in `build_pricing_options(payload)`
2. If missing → `PACKAGES_NO_LONGER_AVAILABLE`
3. Append `_option_to_line_item(opt)` with `unit_price_gbp`, heading, description, etc.

**Example `line_items` JSON stored on row:**

```json
[
  {
    "id": "pkg-gold",
    "heading": "Gold package",
    "unit_price_gbp": 450.0,
    "description": "Full day coverage...",
    "feature_lines": ["Photography"],
    "timeline_line": "6 hours"
  },
  {
    "id": "auto-bulk-10",
    "heading": "10% off - Easter discount",
    "unit_price_gbp": -45.0
  }
]
```

### 9c — Resolve celebration event (before insert)

```209:217:backend/app/features/bookings/create.py
    resolved_event_id, event_fields = resolve_event_for_booking(
        client_user_id,
        event_id=event_id,
        event_name=event_name,
        event_date=event_date,
        event_end_date=event_end_date,
        event_address=event_address,
        event_postcode=event_postcode,
    )
```

If `event_id` is set, links to that celebration. Otherwise creates a new `client_events` row. Returns denormalized event columns merged into the booking insert.

### 9d — Insert row

```218:235:backend/app/features/bookings/create.py
    row_out = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        **event_fields,
        ...
        "status": "pending",
        "selected_option_ids": selected_option_ids,
        "line_items": line_items,
        "total_label": persisted_booking_total_label(pb),
        "initial_client_total_label": client_total,
        "initiator": "client",
    }
    res = get_db().table("booking_requests").insert(row_out).execute()
```

Table: `backend/sql/010_booking_requests.sql` — `status` default `pending`, `line_items` jsonb.

### 9e — After insert

1. Notes → chat (`ensure_client_booking_notes_in_chat`) + `conversation_id` on row
2. `dispatch_booking_notification` vendor: `booking_request_received` + `mark_vendor_notified`
3. `dispatch_booking_notification` client: `booking_request_sent`
4. `_notify_booking_changed` (SSE)
5. Analytics: `enquiry_created`, optional `enquiry_multi_created`, `vendor_notified`
6. `touch_client_event_updated_at(resolved_event_id)`

### 9f — Response

```json
{
  "success": true,
  "booking_request_id": "new-booking-uuid",
  "booking_status": "pending",
  "created_at": "2026-08-16T19:00:00+00:00",
  "event_id": "celebration-uuid"
}
```

---

## Step 10 — Back to browser

**File:** `VendorBookingModal.tsx`

POST success → modal shows success overlay with **View booking** button → `onSuccess(bookingId)`.

```228:236:frontend/features/client/browse/VendorBookingModal.tsx
      .then((created) => {
        track(MixpanelEvents.enquiry_created, {
          booking_id: created.booking_request_id,
          vendor_user_id: vendorUserId,
          option_count: parsed.data.selectedOptionIds.length,
          source: "single",
        });
        setSubmitResult({ type: "success", bookingId: created.booking_request_id });
```

**File:** `ClientVendorBrowseDetailView.tsx`

```232:239:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({ title: "Request sent", ... });
              router.push(`/client/bookings/${bookingId}`);
            }}
```

Slice 3b starts at the redirect.

---

## Multi-vendor enquire (browse grid)

**File:** `MultiVendorEnquireModal.tsx`

Loop — one POST per vendor:

```154:173:frontend/features/marketplace/MultiVendorEnquireModal.tsx
      for (let i = 0; i < optionIdsByVendor.length; i += 1) {
        const created = await postBookingRequest({
          vendor_user_id: vendor.user_id,
          ...
          selected_option_ids: [optionId!],
          client_search_context: {
            ...clientSearchContext,
            batchSize,
            batchIndex: i,
            source: enquirySource,
          },
          event_id: linkedEventId,
        });
        if (created.event_id && !linkedEventId) {
          linkedEventId = created.event_id;
        }
      }
```

First success returns `event_id`; later enquiries reuse it → one celebration, many vendor rows.

**Partial failure:** loop continues on error; if some fail, modal shows errors and toast reports partial send. Only when all succeed does `onSuccess(createdIds)` run.

**Redirect** (`MarketplaceExploreView`):

```646:650:frontend/features/marketplace/MarketplaceExploreView.tsx
            router.push(
              createdIds.length === 1
                ? `/client/bookings/${createdIds[0]}`
                : "/client/bookings",
            );
```

---

## Function call order (cheat sheet)

```
Request booking click
  ClientVendorBrowseDetailView
    guardBooking() → setBookingOpen(true) → track(enquiry_started)
  VendorBookingModal.submit()
    calendarConflict check (soft)
    postBookingRequest()
      POST /api/v1/client/booking-requests
        post_booking_request()
          require_client()
          create_booking_request()
            guards (calendar, capacity, price)
            resolve_line_items()
            resolve_event_for_booking()
            build_pricing_breakdown()
            booking_requests.insert()
            _post_client_booking_notes_to_chat()
            dispatch_booking_notification() × 2
            mark_vendor_notified + analytics
    success modal → View booking → onSuccess()
  toast + router.push(/client/bookings/{id})
```

---

## Debugging

| Symptom | Check |
|---------|--------|
| Button missing | `isClient`, `onRequestBooking` wired |
| Modal never opens | `guardBooking` / launching-soon flag |
| 401 | Session cookie / login |
| Packages no longer available | Stale option id vs vendor profile |
| Calendar rejected | `calendar.py` vs modal warning (soft vs hard) |
| No valid price | Quote-only with no TBC |
| Wrong price on booking | Server `line_items` — not UI estimate |
| Multi partial send | `MultiVendorEnquireModal` failures + toast |

---

## Related

- `slice-3a-client-booking-enquire.md` — route list + concepts
- Slice 2 — how vendor profile JSON becomes `pricingOptions`
