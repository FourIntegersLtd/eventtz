# Slice 3a — Enquire flow walkthrough (thorough)

Trace **one enquire click** from button → `useVendorBookingSubmit.submit()` → `POST` → `create_booking_request` → DB row → redirect. Read this when `slice-3a-client-booking-enquire.md` feels too high-level.

**For the full booking form UI, per-unit pricing, referral codes, fee breakdown, and parameter mapping (form → API → DB), see the main lesson.**

**Endpoint:** `POST /api/v1/client/booking-requests`  
**Submit hook:** `useVendorBookingSubmit` in `frontend/features/client/browse/useVendorBookingSubmit.ts`  
**Payload builder:** `buildBookingRequestPayload` in `frontend/lib/bookingEnquireSubmit.ts`  
**Orchestrator:** `create_booking_request` in `backend/app/features/bookings/create.py`

### What changed (2026-08-31)

- `buildBookingRequestPayload` centralises POST body assembly for single- and multi-vendor enquire.
- `VendorBookingModal` delegates package selection to `usePerUnitPackageSelection`, event fields to `useEnquireEventFormState`, and submit to `useVendorBookingSubmit`.
- `VendorBrowseDetailBody` uses the same `usePerUnitPackageSelection` hook as the modal.

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI — pick package IDs + per-unit quantities on profile              │
│  guardBooking → VendorBrowseDetailBody → VendorBookingModal          │
│  ?vref= → useVendorReferralPreview → ClientFeeBreakdownSummary         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ useVendorBookingSubmit.submit()
                             │ buildBookingRequestPayload → postBookingRequest({ ids, quantities, vendor_referral_code, ... })
┌────────────────────────────▼─────────────────────────────────────────┐
│  HTTP — require_client, CreateBookingRequestBody validation          │
│  client.py → create_booking_request()                                │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ resolve_line_items(..., quantities)
                             │ resolve_referral_pricing_inputs → build_pricing_breakdown
┌────────────────────────────▼─────────────────────────────────────────┐
│  DB — booking_requests row: pending, line_items JSON,                │
│       service_fee_percent, vendor_referral_code                        │
│  + chat notes + notifications + analytics + success modal              │
│  → View booking → redirect to booking detail                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Browser sends **IDs + quantities + optional referral code** — never prices.
- Server copies prices into `line_items` (qty × unit rate for per-unit packages).
- Client cannot POST `£1`.

---

## Scenario — single vendor enquire with per-unit + referral

**Setup:** Client logged in. Opens `/client/browse/abc-vendor-uuid?vref=482910`. Ticks “Chair hire” (`id: pkg-chairs`, per-unit £12/chair). Sets quantity **50** on profile sidebar. Clicks “Request booking”. Fills event name “Ada’s 30th”, date 2026-09-20, notes “Outdoor garden”.

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

## Step 2 — Load vendor + capture `?vref=`

**File:** `ClientVendorBrowseDetailView.tsx`

```45:45:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
```

```56:60:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  useEffect(() => {
    if (!userId) return;
    const code = captureVendorReferralFromSearchParams(userId, searchParams);
    setStoredReferralCode(code);
  }, [userId, searchParams]);
```

`useExploreVendor` → `GET /api/v1/vendors/explore/vendor/{id}` (public, no auth).

`?vref=482910` is stored per vendor and passed to the profile body and booking modal as `initialReferralCode`.

---

## Step 3 — Build pricing options (including per-unit mode)

**File:** `vendorBrowseDetailModel.ts` — `buildBrowsePricingOptions(vendor)`

Reads `vendor.profile_form_data.packages`. Each option gets `pricingMode` (`fixed` or `per_unit`), `minQuantity`, `maxQuantity`, and `unitPriceGbp` (rate for per-unit).

**File:** `VendorBrowseDetailBody.tsx`

```118:122:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const selectedLineItems = useMemo(
    () =>
      buildBookingLineItems(pricingOptions, [...selectedPackageIds], quantities),
    [pricingOptions, selectedPackageIds, quantities],
  );
```

For per-unit option `pkg-chairs` with qty 50:

```75:83:frontend/features/client/browse/vendorBrowseDetailModel.ts
      const perUnit = o.pricingMode === "per_unit";
      const qty = perUnit
        ? Math.max(quantities?.[o.id] ?? o.minQuantity, o.minQuantity)
        : 1;
      return {
        id: o.id,
        heading: o.heading,
        unitPriceGbp: lineTotalGbp(o.unitPriceGbp, qty),
```

UI estimate: £12 × 50 = **£600** vendor portion. **Not sent to API as prices.**

**Fee preview on sidebar** — `useVendorReferralPreview` + `computeClientFeeBreakdown`:

```127:137:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const { referralDiscountGbp } = useVendorReferralPreview({
    vendorUserId: vendor.user_id,
    vendorPortionGbp: selectedTotal.sumNumeric,
    initialCode: storedReferralCode,
  });
  const selectedFeeBreakdown = useMemo(() => {
    if (selectedTotal.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: selectedTotal.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [selectedTotal.hasTbc, selectedTotal.sumNumeric, referralDiscountGbp]);
```

At £600 vendor portion, referral tier gives −£15 off the 5% Eventtz fee.

---

## Step 4 — Guest vs client on the button

```271:277:frontend/features/client/browse/VendorBrowseDetailBody.tsx
              onClick={() => {
                if (selectedPackageIds.size === 0) {
                  setBookingSelectError(true);
                  return;
                }
                onRequestBooking([...selectedPackageIds], quantities);
              }}
```

| `requireLoginForActions` | `onRequestBooking` | What user sees |
|--------------------------|-------------------|----------------|
| `true` (guest) | — | Register / sign in |
| `false` + client | defined | Request booking |
| `false` + no hook | undefined | Contact only |

**File:** `ClientVendorBrowseDetailView.tsx`

```228:238:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
          onRequestBooking={
            isClient
              ? (ids, quantities) => {
                  guardBooking(() => {
                    setBookingSelectionIds(ids);
                    setBookingQuantities(quantities);
                    setBookingOpen(true);
                    track(MixpanelEvents.enquiry_started, { vendor_user_id: userId });
                  });
                }
              : undefined
          }
```

`guardBooking` (from `useLaunchingSoonBookingGuard`) may show a launching-soon modal when `BOOKINGS_LAUNCHING_SOON` is `true`. **Currently `BOOKINGS_LAUNCHING_SOON = false`** in `bookingsLaunchingSoon.ts` — enquires proceed.

---

## Step 5 — Modal opens with packages, quantities, referral prefill

```242:266:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
        {user && bookingOpen && vendor ? (
          <VendorBookingModal
            key={`${bookingSelectionIds.slice().sort().join("|")}|${JSON.stringify(bookingQuantities)}|${searchParams.toString()}`}
            onClose={() => setBookingOpen(false)}
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: CLIENT_BOOKING_TOAST_COPY.requestSent,
                description: `${businessName} will be notified. ${usualReplyExpectation(vendor.avg_response_seconds)}`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
            }}
            vendorDisplayName={businessName}
            vendorUserId={userId}
            pricingOptions={pricingOptions}
            initialSelectedIds={bookingSelectionIds}
            initialQuantities={bookingQuantities}
            vendorPayload={vendorPayload}
            searchPrefill={bookingSearchPrefill}
            initialPrefill={plannerEventPrefill}
            linkedEventId={linkedEventId}
            clientSearchContext={bookingClientSearchContext}
            initialReferralCode={storedReferralCode}
          />
        ) : null}
```

**File:** `VendorBookingModal.tsx` — wires hooks:

```78:108:frontend/features/client/browse/VendorBookingModal.tsx
  const {
    selectedIds,
    quantities,
    setPackageQuantity,
    lineItems,
  } = usePerUnitPackageSelection({
    pricingOptions,
    initialSelectedIds,
    initialQuantities,
  });
  const {
    eventName,
    setEventName,
    eventDate,
    setEventDate,
    eventEndDate,
    setEventEndDate,
    venueAddress,
    setVenueAddress,
    notes,
    setNotes,
    pendingPrefill,
    bannerVisible,
    dismissForNewEvent,
    applyBannerPrefill,
    selectedEventId,
  } = useEnquireEventFormState({
    searchPrefill,
    initialPrefill,
    linkedEventId,
  });
```

```180:192:frontend/features/client/browse/VendorBookingModal.tsx
  const {
    validationError,
    setValidationError,
    submitting,
    submitResult,
    dismissResultModal,
    submit: submitBooking,
  } = useVendorBookingSubmit({
    vendorUserId,
    selectedEventId,
    clientSearchContext,
    calendarConflict,
  });
```

Per-unit lines show `QuantityStepper` in the modal (can adjust before submit via `setPackageQuantity` from `usePerUnitPackageSelection`).

**Prefill sources:** browse URL dates, planner query params, linked celebration (`linkedEventId`), `?vref=` referral code, active-event banner.

---

## Step 6 — Client clicks “Send booking request”

**File:** `VendorBookingModal.tsx` — thin submit wrapper:

```204:219:frontend/features/client/browse/VendorBookingModal.tsx
  const submit = () => {
    submitBooking({
      eventName,
      eventDate,
      eventEndDate,
      venueAddress,
      notes,
      selectedOptionIds: [...selectedIds],
      quantities: bookingQuantitiesPayload(
        [...selectedIds],
        pricingOptions,
        quantities,
      ),
      vendorReferralCode: normalizedReferralCode,
    });
  };
```

**File:** `useVendorBookingSubmit.ts` — validation + `buildBookingRequestPayload` + POST:

```45:77:frontend/features/client/browse/useVendorBookingSubmit.ts
  const submit = useCallback(
    (fields: VendorBookingSubmitFields) => {
      const parsed = parseForm(clientBookingRequestSchema, {
        eventName: fields.eventName,
        eventDate: fields.eventDate,
        eventEndDate: fields.eventEndDate || null,
        venueAddress: fields.venueAddress,
        notes: fields.notes,
        selectedOptionIds: fields.selectedOptionIds,
        quantities: fields.quantities,
      });
      if (!parsed.ok) {
        setValidationError(parsed.formError);
        return;
      }
      if (calendarConflict) {
        setValidationError(
          "These dates don't match this vendor's availability. Adjust the dates or message them to confirm.",
        );
        return;
      }
      setValidationError(null);
      setSubmitting(true);
      void postBookingRequest(
        buildBookingRequestPayload(parsed.data, {
          vendorUserId,
          selectedOptionIds: parsed.data.selectedOptionIds,
          quantities: parsed.data.quantities,
          clientSearchContext,
          eventId: selectedEventId,
          vendorReferralCode: fields.vendorReferralCode,
        }),
      )
```

**Calendar soft block** runs inside the hook when `calendarConflict` is true (passed from modal).

**Zod schema** — `frontend/lib/validation/bookings.ts`:

```27:37:frontend/lib/validation/bookings.ts
export const clientBookingRequestSchema = z
  .object({
    eventName: z.string().trim().min(1, "Enter an event name.").max(500),
    notes: z.string().trim().max(4000).optional().default(""),
    venueAddress: z.string().trim().max(500).optional().default(""),
    selectedOptionIds: z.array(z.string()).min(1, "Choose at least one package."),
    quantities: z
      .record(z.number().int().min(1).max(100_000))
      .optional(),
  })
  .and(eventDatesSchema({ requireStart: true }));
```

### HTTP request (example for this scenario)

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
  "selected_option_ids": ["pkg-chairs"],
  "quantities": { "pkg-chairs": 50 },
  "vendor_referral_code": "482910",
  "client_search_context": { "q": "...", "country": "GB" }
}
```

---

## Step 7 — `postBookingRequest`

```54:58:frontend/lib/clientBookingsApi.ts
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

```461:476:backend/app/features/bookings/http/client.py
        out = create_booking_request(
            client_user_id=client_id,
            vendor_user_id=vendor_id,
            event_name=body.event_name,
            event_date=body.event_date,
            event_end_date=body.event_end_date,
            event_postcode=body.event_postcode,
            event_address=body.event_address,
            notes=body.notes,
            selected_option_ids=body.selected_option_ids,
            client_search_context=body.client_search_context,
            event_id=body.event_id,
            quantities=body.quantities,
            vendor_referral_code=body.vendor_referral_code,
        )
```

`require_client` — 401 without session, 403 if not `user_type=client`.

**Contract** `CreateBookingRequestBody` — past dates rejected, min 1 option id, optional `quantities` and `vendor_referral_code`.

---

## Step 9 — `create_booking_request` (line by line)

### 9a — Guards

- Cannot book own vendor profile
- Vendor must be bookable (`_vendor_is_approved_for_explore`)
- Neither party suspended
- `_enforce_vendor_calendar` — blocked dates / weekdays
- `_enforce_max_bookings_per_day` — capacity per day
- `BOOKING_NO_VALID_PRICE` — no priced lines and no TBC flag

### 9b — Snapshot prices with quantities

```202:218:backend/app/features/bookings/create.py
    line_items = resolve_line_items(payload, selected_option_ids, quantities)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)

    li_sum = sum(float(li.get("unit_price_gbp") or 0) for li in line_items if isinstance(li, dict))
    vendor_portion_est = round(li_sum, 2)
    normalized_referral, referral_discount, tier_min = resolve_referral_pricing_inputs(
        vendor_user_id,
        vendor_referral_code,
        vendor_portion_est,
    )
    pb = build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=float(BOOKING_SERVICE_FEE_PERCENT),
        referral_fee_discount_gbp=referral_discount,
        referral_tier_min_spend_gbp=tier_min,
    )
```

**File:** `list_pricing.py` — for `pkg-chairs` with qty 50:

1. `_quantity_for_option` reads `quantities["pkg-chairs"]` → 50
2. `_option_to_line_item` sets `unit_price_gbp: 600.0`, `quantity: 50`, `unit_rate_gbp: 12.0`

**Example `line_items` JSON stored on row:**

```json
[
  {
    "id": "pkg-chairs",
    "heading": "Chair hire",
    "unit_price_gbp": 600.0,
    "quantity": 50,
    "unit_rate_gbp": 12.0,
    "unit_label": "chair",
    "description": "White folding chairs…",
    "feature_lines": ["Delivery included"],
    "timeline_line": null
  }
]
```

### 9c — Resolve celebration event (before insert)

```227:235:backend/app/features/bookings/create.py
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

If `event_id` is set, links to that celebration. Otherwise creates a new `client_events` row.

### 9d — Insert row

```236:255:backend/app/features/bookings/create.py
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
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
        "vendor_referral_code": normalized_referral,
    }
    if search_ctx is not None:
        row_out["client_search_context"] = search_ctx

    try:
        res = get_db().table("booking_requests").insert(row_out).execute()
```

At £600 vendor portion with referral: `total_label` reflects vendor £600 + fee £15 − referral £15 = **£615** client total (5% of £600 = £30 fee, −£15 referral).

Table: `backend/sql/010_booking_requests.sql` — `status` default `pending`, `line_items` jsonb. Referral/fee columns: `backend/sql/083_vendor_client_referrals.sql`.

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

**File:** `useVendorBookingSubmit.ts` — POST success:

```81:89:frontend/features/client/browse/useVendorBookingSubmit.ts
        .then((created) => {
          track(MixpanelEvents.enquiry_created, {
            booking_id: created.booking_request_id,
            vendor_user_id: vendorUserId,
            option_count: parsed.data.selectedOptionIds.length,
            source: "single",
          });
          setSubmitResult({ type: "success", bookingId: created.booking_request_id });
          setSubmitting(false);
```

**File:** `VendorBookingModal.tsx` — success modal → View booking → `onSuccess`:

```277:284:frontend/features/client/browse/VendorBookingModal.tsx
        submitResult?.type === "success" ? (
          <Button
            variant="primary"
            onClick={() => {
              const id = submitResult.bookingId;
              dismissResultModal();
              onSuccess?.(id);
            }}
```

**File:** `ClientVendorBrowseDetailView.tsx` — toast + redirect:

```246:253:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: CLIENT_BOOKING_TOAST_COPY.requestSent,
                description: `${businessName} will be notified. ${usualReplyExpectation(vendor.avg_response_seconds)}`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
```

POST failure uses `CLIENT_BOOKING_ERROR_COPY.enquiryFailed` as fallback message.

Slice 3b starts at the redirect.

---

## Multi-vendor enquire (browse grid)

**File:** `MultiVendorEnquireModal.tsx`

Loop — one `buildBookingRequestPayload` → `postBookingRequest` per vendor:

```168:195:frontend/features/marketplace/MultiVendorEnquireModal.tsx
      for (let index = 0; index < optionIdsByVendor.length; index += 1) {
        const { vendor, optionId } = optionIdsByVendor[index]!;
        const pricingOptions = pricingOptionsForVendor(vendor);
        try {
          const created = await postBookingRequest(
            buildBookingRequestPayload(parsed.data, {
              vendorUserId: vendor.user_id,
              selectedOptionIds: [optionId!],
              quantities: bookingQuantitiesPayload(
                [optionId!],
                pricingOptions,
                {
                  [optionId!]:
                    quantityByVendorId[vendor.user_id] ??
                    defaultQuantityForOption(
                      pricingOptions.find((option) => option.id === optionId)!,
                    ),
                },
              ),
              clientSearchContext: {
                ...clientSearchContext,
                batchSize,
                batchIndex: index,
                source: resolvedSource,
              },
              eventId: linkedEventIdForBatch,
            }),
          );
```

Note: multi-vendor flow does **not** send `vendor_referral_code` today (referral is single-vendor profile flow via `?vref=`).

First success returns `event_id`; later enquiries reuse it → one celebration, many vendor rows.

**Partial failure:** loop continues on error; uses `CLIENT_BOOKING_ERROR_COPY.multiEnquireNone` and `CLIENT_BOOKING_TOAST_COPY.partialRequestsSent`.

**Redirect** (`MarketplaceExploreView`):

```383:387:frontend/features/marketplace/MarketplaceExploreView.tsx
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
    useVendorBookingSubmit.submit()
      parseForm(clientBookingRequestSchema)
      calendarConflict check (soft)
      buildBookingRequestPayload()
      postBookingRequest()
        POST /api/v1/client/booking-requests
          post_booking_request()
            require_client()
            create_booking_request()
              guards (calendar, capacity, price)
              resolve_line_items(..., quantities)
              resolve_referral_pricing_inputs()
              build_pricing_breakdown(service_fee_percent=5)
              resolve_event_for_booking()
              booking_requests.insert()
              _post_client_booking_notes_to_chat()
              dispatch_booking_notification() × 2
              mark_vendor_notified + analytics
      setSubmitResult(success)
  success modal → View booking → onSuccess()
  toast (CLIENT_BOOKING_TOAST_COPY.requestSent) + router.push(/client/bookings/{id})
```

---

## Debugging

| Symptom | Check |
|---------|--------|
| Button missing | `isClient`, `onRequestBooking` wired |
| Modal never opens | `guardBooking` / `BOOKINGS_LAUNCHING_SOON` (currently `false`) |
| 401 | Session cookie / login |
| Packages no longer available | Stale option id vs vendor profile |
| Per-unit quantity rejected | `quantities` missing or out of min/max range |
| Referral code 400 | `resolve_referral_pricing_inputs` — wrong vendor or invalid code |
| Referral preview shows no discount | Vendor portion below `REFERRAL_LOWEST_TIER_SPEND_GBP` (£400) |
| Calendar rejected | `calendar.py` vs modal warning (soft vs hard) |
| No valid price | Quote-only with no TBC |
| Fee mismatch UI vs booking | `computeClientFeeBreakdown` vs server `build_pricing_breakdown` |
| Generic submit error | `CLIENT_BOOKING_ERROR_COPY.enquiryFailed` |
| Multi partial send | `MultiVendorEnquireModal` failures + `partialRequestsSent` toast |

---

## Related

- `slice-3a-client-booking-enquire.md` — route list + concepts
- Slice 2 — how vendor profile JSON becomes `pricingOptions` (including `per_unit`)
