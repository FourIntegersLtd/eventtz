# Slice 3a — Enquire flow walkthrough (thorough)

Trace **one enquire click** from button → DB row → redirect. Read this when `slice-3a-client-booking-enquire.md` feels too high-level.

**Endpoint:** `POST /api/v1/client/booking-requests`  
**Orchestrator:** `create_booking_request` in `backend/app/features/bookings/create.py`

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  UI — pick package IDs on profile (prices shown for UX only) │
│  VendorBrowseDetailBody → VendorBookingModal                 │
└────────────────────────────┬─────────────────────────────────┘
                             │ postBookingRequest({ selected_option_ids, ... })
┌────────────────────────────▼─────────────────────────────────┐
│  HTTP — require_client, CreateBookingRequestBody validation  │
│  client.py → create_booking_request()                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ resolve_line_items (SERVER reads vendor profile)
┌────────────────────────────▼─────────────────────────────────┐
│  DB — booking_requests row: pending, line_items JSON snapshot │
│  + chat notes + notifications + redirect to booking detail   │
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
                  });
                }
              : undefined
          }
```

`isClient` = `user?.user_type === "client"`.

---

## Step 5 — Modal opens with fixed package selection

```228:250:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
        {user && bookingOpen && vendor ? (
          <VendorBookingModal
            initialSelectedIds={bookingSelectionIds}
            vendorUserId={userId}
            pricingOptions={pricingOptions}
            clientSearchContext={bookingClientSearchContext}
            onSuccess={(bookingId) => {
              router.push(`/client/bookings/${bookingId}`);
            }}
          />
```

Modal does **not** let you change packages — close modal, re-pick on profile.

**File:** `VendorBookingModal.tsx` line 77:

```77:77:frontend/features/client/browse/VendorBookingModal.tsx
  const selectedIds = useMemo(() => new Set(initialSelectedIds), [initialSelectedIds]);
```

---

## Step 6 — Client fills form + submit

Fields: `eventName`, `eventDate`, `eventEndDate`, `venueAddress`, `notes`.

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
- `_enforce_max_bookings_per_day` — capacity

### 9b — Snapshot prices

```189:198:backend/app/features/bookings/create.py
    payload = get_bookable_vendor_profile_form_data(vendor_user_id)
    line_items = resolve_line_items(payload, selected_option_ids)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)
    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
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

### 9c — Insert row

```218:235:backend/app/features/bookings/create.py
    row_out = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
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

### 9d — After insert

1. Notes → chat (`ensure_client_booking_notes_in_chat`)
2. `dispatch_booking_notification` vendor: `booking_request_received`
3. `dispatch_booking_notification` client: `booking_request_sent`
4. `_notify_booking_changed` (SSE)
5. Analytics: `enquiry_created`
6. `resolve_event_for_booking` — link/create `client_events` row

### 9e — Response

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

Success modal → “View booking” → `onSuccess(bookingId)` →

```239:239:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
              router.push(`/client/bookings/${bookingId}`);
```

Slice 3b starts here.

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

---

## Function call order (cheat sheet)

```
Request booking click
  ClientVendorBrowseDetailView → setBookingOpen(true)
  VendorBookingModal.submit()
    postBookingRequest()
      POST /api/v1/client/booking-requests
        post_booking_request()
          require_client()
          create_booking_request()
            resolve_line_items()
            build_pricing_breakdown()
            booking_requests.insert()
            _post_client_booking_notes_to_chat()
            dispatch_booking_notification() × 2
  router.push(/client/bookings/{id})
```

---

## Debugging

| Symptom | Check |
|---------|--------|
| Button missing | `isClient`, `onRequestBooking` wired |
| 401 | Session cookie / login |
| Packages no longer available | Stale option id vs vendor profile |
| Calendar rejected | `calendar.py` vs modal warning (soft vs hard) |
| Wrong price on booking | Server `line_items` — not UI estimate |

---

## Related

- `slice-3a-client-booking-enquire.md` — route list + concepts
- Slice 2 — how vendor profile JSON becomes `pricingOptions`
