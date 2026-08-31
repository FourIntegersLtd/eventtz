# Slice 3a — Client booking: enquire

**Walkthrough:** `slice-3a-enquire-flow-walkthrough.md` — traces one click → `useVendorBookingSubmit.submit()` → `POST` → `create_booking_request` → DB row.

### User story

A **signed-in client** picks packages on a vendor profile (or selects several vendors on browse), sets quantities for per-unit rates, optionally enters a vendor referral code (`?vref=` or in the modal), fills event details, and sends an enquiry. The backend creates a `booking_requests` row with **snapshotted prices** (including quantity × unit rate), **service fee percent**, optional **`vendor_referral_code`**, status **`pending`**, payment **`unpaid`**. The vendor is notified; the client lands on booking detail to wait for a response.

**Guests** can browse but see “Sign in / Create account” instead of enquire.

---

## What changed in this slice

| Area | Before | Now |
|------|--------|-----|
| Submit logic | Inline in `VendorBookingModal` | `useVendorBookingSubmit.ts` hook |
| Per-unit pricing | Fixed qty 1 | `packagePricing.ts`, `vendorBrowseDetailModel.ts`, `QuantityStepper` on profile + modal |
| Fee display | Vendor total only | `ClientFeeBreakdownSummary` + `bookingServiceFee.ts` (5% Eventtz fee, referral discount) |
| Referral codes | — | `?vref=` URL → `useVendorReferralPreview.ts` → `vendor_referral_code` on create |
| Error copy | Hard-coded strings | `CLIENT_BOOKING_ERROR_COPY` in `bookingConfirmCopy.ts` |
| Backend create | IDs + event fields | `quantities`, `vendor_referral_code`, `service_fee_percent`; `resolve_referral_pricing_inputs` |
| Multi-vendor | Sequential POSTs | Same, plus per-vendor quantities + `bookingConfirmCopy` toasts |

### What changed (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| POST payload assembly | Inline in `useVendorBookingSubmit` and `MultiVendorEnquireModal` | Shared `buildBookingRequestPayload` in `bookingEnquireSubmit.ts` |
| Modal form state | Local `useState` in `VendorBookingModal` | `useEnquireEventFormState.ts` (event fields + celebration prefill) |
| Package selection | Duplicated `setPackageQuantity` in modal + profile | `usePerUnitPackageSelection.ts` (profile sidebar + modal) |
| `VendorBookingModal` | Owned selection + form + submit | Thin shell — delegates to the three hooks above + `useVendorBookingSubmit` |

---

## What the booking form does

```typescript
void postBookingRequest(
  buildBookingRequestPayload(parsed.data, {
    vendorUserId,
    selectedOptionIds: parsed.data.selectedOptionIds,
    quantities: parsed.data.quantities,
    vendorReferralCode: fields.vendorReferralCode,
    // …
  }),
);
```

| Piece | Role |
|--------|------|
| `VendorBookingModal` | Thin React shell — wires `usePerUnitPackageSelection`, `useEnquireEventFormState`, `useVendorBookingSubmit`; referral + fee UI |
| `usePerUnitPackageSelection` | Selected package ids + per-unit quantities (profile sidebar and modal) |
| `useEnquireEventFormState` | Event name, dates, venue, notes; browse/planner/celebration prefill |
| `useVendorBookingSubmit` | Zod validation, calendar guard, `buildBookingRequestPayload` → `postBookingRequest`, success/error modal state, Mixpanel |
| `buildBookingRequestPayload` | Maps validated form fields → `CreateBookingRequestPayload` (shared by single- and multi-vendor) |
| `useVendorReferralPreview` | Live referral-code validation + discount preview against vendor portion |
| `clientBookingRequestSchema` | Zod validation before submit (includes optional `quantities`) |
| `postBookingRequest()` | HTTP `POST` to `/api/v1/client/booking-requests` with session cookie |
| `CreateBookingRequestBody` | Pydantic contract — dates, option ids, quantities, `vendor_referral_code` |
| `create_booking_request()` | Business logic — snapshot prices (with qty), referral discount, insert row, notify vendor |

Plain English: the client fills a form in a modal. The browser sends **package IDs, quantities (per-unit only), event details, and an optional referral code** — never prices. The server re-reads the vendor profile, multiplies per-unit rates by quantity, applies referral fee discount tiers, copies prices into `line_items`, and saves a `pending` booking row.

---

## What happens at a glance

```
Client picks packages (+ quantities for per-unit) on profile
    → guardBooking (optional launching-soon gate — currently OFF)
    → VendorBookingModal (prefill from browse URL / planner / ?vref= / celebration event)
    → calendar soft warning OR submit
    → useVendorBookingSubmit.submit()
        → POST /client/booking-requests
            → create_booking_request()
                → guards (self-book, bookable vendor, calendar, capacity)
                → resolve_line_items(payload, ids, quantities) + automatic discounts
                → resolve_referral_pricing_inputs() → build_pricing_breakdown(service_fee_percent)
                → resolve_event_for_booking() (link or create celebration event)
                → insert booking_requests (pending / unpaid, service_fee_percent, vendor_referral_code)
                → notes → chat + conversation_id on row
                → notify vendor + client + SSE + analytics
    → success modal → "View booking"
    → toast + redirect /client/bookings/{id}
```

---

## Example: client enquires from a vendor profile

1. Signed-in client opens `/client/browse/abc-vendor-uuid?dates=2026-09-20&vref=482910`.
2. Ticks “Chair hire” (per-unit, £12/chair), sets quantity 50 on the profile sidebar → clicks **Request booking**.
3. `guardBooking` passes (`BOOKINGS_LAUNCHING_SOON` is `false` — see Step 1).
4. `VendorBookingModal` opens with package IDs + quantities fixed, referral code prefilled, event date from URL.
5. Client sees `ClientFeeBreakdownSummary`: vendor portion £600, Eventtz fee 5%, referral discount −£15, estimated total.
6. Client fills event name + notes → submits (calendar conflict blocks submit client-side if dates don’t match vendor calendar).
7. `POST /api/v1/client/booking-requests` with `selected_option_ids`, `quantities`, `vendor_referral_code` — no prices.
8. Server snapshots `line_items` (qty × rate), stores `service_fee_percent: 5`, `vendor_referral_code: "482910"`, links `client_events`, inserts `pending` booking.
9. Notes appear in chat; vendor gets in-app + email notification.
10. Modal shows success → client clicks **View booking** → toast + redirect to `/client/bookings/{id}` (Slice 3b).

---

## Complete route — single vendor enquire

### Frontend (profile → modal → API)

1. `frontend/app/client/(portal)/browse/[userId]/page.tsx` — route `/client/browse/[userId]`
2. `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx` — orchestration, `?vref=` capture, quantities state
3. `frontend/features/client/browse/useExploreVendor.ts` — loads vendor (public explore API, Slice 2)
4. `frontend/features/client/browse/VendorBrowseDetailBody.tsx` — packages UI, quantity steppers, fee preview, “Request booking”
5. `frontend/features/client/browse/usePerUnitPackageSelection.ts` — shared package id + quantity state (`syncPerUnitPackageSelection`)
6. `frontend/features/client/browse/vendorBrowseDetailModel.ts` — `buildBrowsePricingOptions`, `buildBookingLineItems`, `bookingQuantitiesPayload`
7. `frontend/lib/packagePricing.ts` — `lineTotalGbp`, `parsePackagePricingMode`, per-unit helpers
8. `frontend/components/ui/QuantityStepper.tsx` — +/- control on profile and modal
9. `frontend/lib/vendorReferralAttribution.ts` — `captureVendorReferralFromSearchParams` (`?vref=`)
10. `frontend/features/client/browse/useVendorReferralPreview.ts` — live referral preview API
11. `frontend/lib/bookingServiceFee.ts` — `computeClientFeeBreakdown`, `BOOKING_SERVICE_FEE_PERCENT`
12. `frontend/features/bookings/ClientFeeBreakdownSummary.tsx` — vendor portion + fee + referral rows
13. `frontend/features/bookings/useLaunchingSoonBookingGuard.tsx` — optional feature-flag gate
14. `frontend/features/bookings/eventEnquirePrefill.ts` — planner URL → prefill fields
15. `frontend/features/bookings/useEnquireEventFormState.ts` — event form fields + celebration prefill wiring
16. `frontend/features/bookings/useActiveEventPrefill.ts` — linked celebration event prefill (used by form-state hook)
17. `frontend/features/bookings/ActiveEventPrefillBanner.tsx` — “Use your event” banner in modal
18. `frontend/lib/marketplaceSearchParams.ts` — browse filters → `clientSearchContext`
19. `frontend/features/client/browse/VendorBookingModal.tsx` — thin modal shell (hooks + UI)
20. `frontend/features/client/browse/useVendorBookingSubmit.ts` — validate + `buildBookingRequestPayload` + POST + result modal
21. `frontend/lib/bookingEnquireSubmit.ts` — `buildBookingRequestPayload` (shared POST body builder)
22. `frontend/features/bookings/bookingConfirmCopy.ts` — `CLIENT_BOOKING_ERROR_COPY`, `CLIENT_BOOKING_TOAST_COPY`
23. `frontend/lib/validation/bookings.ts` — `clientBookingRequestSchema` (Zod)
24. `frontend/lib/clientBookingsApi.ts` — `postBookingRequest`
25. `frontend/lib/bookingsLaunchingSoon.ts` — `BOOKINGS_LAUNCHING_SOON` flag
26. `frontend/lib/mixpanelEvents.ts` — `enquiry_started`, `enquiry_created`, `enquiry_failed`
27. `frontend/lib/axios.ts` — session cookies (`withCredentials`)

### Backend (HTTP → business logic → DB)

1. `backend/app/http/router.py` — mounts client booking router
2. `backend/app/features/bookings/http/client.py` — `POST /booking-requests`
3. `backend/app/features/auth/http/guards.py` — `require_client`
4. `backend/app/contracts/booking.py` — `CreateBookingRequestBody`, `BookingRequestCreated`
5. `backend/app/features/bookings/create.py` — `create_booking_request`
6. `backend/app/features/vendors/list_pricing.py` — `resolve_line_items` (snapshot + quantities)
7. `backend/app/features/bookings/pricing.py` — `build_pricing_breakdown`, totals, service fee
8. `backend/app/features/vendor_referrals/validate.py` — `resolve_referral_pricing_inputs`
9. `backend/app/features/bookings/calendar.py` — availability + capacity checks
10. `backend/app/features/client_events/events.py` — `resolve_event_for_booking`
11. `backend/app/features/chat/service.py` — notes → first chat message
12. `backend/app/features/email/dispatch.py` — in-app + email notifications
13. `backend/app/features/bookings/booking_funnel_timestamps.py` — `mark_vendor_notified`
14. `backend/app/features/analytics/events.py` — `enquiry_created`, `enquiry_multi_created`, `vendor_notified`
15. `backend/app/core/db.py` — `booking_requests` insert

### After success

16. `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx` — booking detail (Slice 3b)

---

## Complete route — multi-vendor enquire (browse grid)

Same API from step 24 onward. Different UI entry:

1. `frontend/app/client/(portal)/browse/page.tsx` — `/client/browse`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx` — multi-select + “Message N together”
3. `frontend/features/marketplace/MultiVendorEnquireModal.tsx` — one brief, **N sequential** `buildBookingRequestPayload` → `postBookingRequest` calls, per-vendor quantities
4. `frontend/features/bookings/MultiVendorPackagePicker.tsx` — pick one package per vendor (+ quantity steppers)
5. `frontend/features/bookings/multiVendorPackageSelection.ts` — initial package picks and default quantities

---

## Parameter map — form → API → database

Every field the client can edit, and how it travels through the stack:

| Form state | Zod field | Frontend payload | Backend body | Stored on `booking_requests` |
|------------|-----------|------------------|--------------|------------------------------|
| `eventName` | `eventName` | `event_name` | `event_name` | `event_name` (or celebration title if linked) |
| `eventDate` | `eventDate` | `event_date` | `event_date` | `event_date` |
| `eventEndDate` | `eventEndDate` | `event_end_date` | `event_end_date` | `event_end_date` |
| `venueAddress` | `venueAddress` | `event_address` | `event_address` | `event_address` |
| — (always `null` at enquire) | — | `event_postcode` | `event_postcode` | `event_postcode` (Slice 4 payment) |
| `notes` | `notes` | `notes` | `notes` | `notes` + first chat message |
| `selectedIds` / profile checkboxes | `selectedOptionIds` | `selected_option_ids` | `selected_option_ids` | `selected_option_ids` + `line_items` snapshot |
| `quantities` (per-unit only) | `quantities` | `quantities` | `quantities` | reflected in `line_items` (`quantity`, `unit_rate_gbp`) |
| prop `vendorUserId` | — | `vendor_user_id` | `vendor_user_id` | `vendor_user_id` |
| `normalizedReferralCode` | — | `vendor_referral_code` | `vendor_referral_code` | `vendor_referral_code` |
| prop `clientSearchContext` | — | `client_search_context` | `client_search_context` | `client_search_context` (jsonb) |
| `selectedEventId` | — | `event_id` | `event_id` | `event_id` (links `client_events`) |
| — (from session cookie) | — | — | — | `client_user_id` (from `require_client`) |
| — (server default) | — | — | — | `service_fee_percent` (snapshotted, default 5%) |

**Not sent from the browser:** package prices, `line_items`, `total_label`, `status`, `initiator`, `service_fee_percent`. The server computes all of those.

---

## Step 1 — Who can enquire?

Browse is **public** (Slice 2). Enquire requires a **client** session.

**File:** `ClientVendorBrowseDetailView.tsx`

```162:162:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const isClient = user?.user_type === "client";
```

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

| User | Sees on profile |
|------|-----------------|
| Guest | Login / register links (`requireLoginForActions`) |
| Client | “Request booking” → modal (after `guardBooking`) |
| Vendor / admin browsing | Public chrome, no enquire hook |

**Launching-soon gate** — `useLaunchingSoonBookingGuard.tsx`:

```8:11:frontend/features/bookings/useLaunchingSoonBookingGuard.tsx
export function isBookingBlockedByLaunchGuard(email: string | null | undefined): boolean {
  return BOOKINGS_LAUNCHING_SOON && !hasBookingEarlyAccess(email);
}
```

**File:** `bookingsLaunchingSoon.ts` — current flag value:

```1:2:frontend/lib/bookingsLaunchingSoon.ts
/** When true, clients can browse vendors but cannot send booking requests yet. */
export const BOOKINGS_LAUNCHING_SOON = false;
```

As of this codebase, **`BOOKINGS_LAUNCHING_SOON` is `false`** — enquires are not blocked. When flipped to `true`, `guardBooking` shows `LaunchingSoonBookingModal` for clients whose email is not in `BOOKING_EARLY_ACCESS_EMAILS`.

**Backend:** `require_client` on the POST handler:

```83:90:backend/app/features/auth/http/guards.py
def require_client(request: Request, response: Response) -> AuthUser:
    """403 if the signed-in user is not a client (e.g. vendor/admin) or the account is suspended."""
    return require_role(
        request,
        response,
        role="client",
        forbidden_detail=auth_messages.CLIENT_PORTAL_FORBIDDEN,
    )
```

---

## Step 2 — Package selection + per-unit quantities on the profile

**File:** `VendorBrowseDetailBody.tsx` — client ticks packages via `usePerUnitPackageSelection`; per-unit options get a `QuantityStepper`; selected IDs and quantities pass to the modal.

```110:119:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const {
    selectedIds: selectedPackageIds,
    quantities,
    togglePackage,
    setPackageQuantity,
    lineItems: selectedLineItems,
  } = usePerUnitPackageSelection({
    pricingOptions,
    onSelectionChange: () => setBookingSelectError(false),
  });
```

**File:** `usePerUnitPackageSelection.ts` — keeps ids and quantities in sync for per-unit rates:

```22:37:frontend/features/client/browse/usePerUnitPackageSelection.ts
export function syncPerUnitPackageSelection(
  pricingOptions: BrowsePricingOption[],
  selectedIds: Set<string>,
  quantities: Record<string, number>,
  id: string,
  qty: number,
): PackageSelectionState {
  const option = pricingOptions.find((entry) => entry.id === id);
  const nextQuantities = { ...quantities, [id]: qty };
  const nextSelectedIds = new Set(selectedIds);
  if (option?.pricingMode === "per_unit") {
    if (qty >= option.minQuantity) nextSelectedIds.add(id);
    else nextSelectedIds.delete(id);
  }
  return { selectedIds: nextSelectedIds, quantities: nextQuantities };
}
```

“Request booking” passes ids **and** quantities from the hook’s `selectedPackageIds` and `quantities`.

**File:** `vendorBrowseDetailModel.ts` — UI estimate with per-unit line totals:

```66:88:frontend/features/client/browse/vendorBrowseDetailModel.ts
export function buildBookingLineItems(
  options: BrowsePricingOption[],
  selectedIds: string[],
  quantities?: Record<string, number>,
): BookingLineItem[] {
  const set = new Set(selectedIds);
  return options
    .filter((o) => set.has(o.id))
    .map((o) => {
      const perUnit = o.pricingMode === "per_unit";
      const qty = perUnit
        ? Math.max(quantities?.[o.id] ?? o.minQuantity, o.minQuantity)
        : 1;
      return {
        id: o.id,
        heading: o.heading,
        unitPriceGbp: lineTotalGbp(o.unitPriceGbp, qty),
        quantity: perUnit ? qty : undefined,
        unitRateGbp: perUnit ? o.unitPriceGbp : undefined,
        unitLabel: perUnit ? o.unitLabel : undefined,
      };
    });
}
```

**File:** `packagePricing.ts` — shared rate × quantity math:

```55:58:frontend/lib/packagePricing.ts
export function lineTotalGbp(unitRateGbp: number | null, quantity: number): number | null {
  if (unitRateGbp == null || !Number.isFinite(unitRateGbp)) return null;
  return Math.round(unitRateGbp * quantity * 100) / 100;
}
```

Plain English: the UI shows prices for convenience, but the **server** re-reads the vendor profile and applies the posted quantities when you submit.

---

## Step 3 — Referral code from `?vref=` URL

**File:** `ClientVendorBrowseDetailView.tsx` — captures `?vref=` on load and passes to profile + modal:

```56:60:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  useEffect(() => {
    if (!userId) return;
    const code = captureVendorReferralFromSearchParams(userId, searchParams);
    setStoredReferralCode(code);
  }, [userId, searchParams]);
```

```265:265:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
            initialReferralCode={storedReferralCode}
```

**File:** `useVendorReferralPreview.ts` — validates code against vendor portion (used on profile sidebar and in modal):

```25:49:frontend/features/client/browse/useVendorReferralPreview.ts
  const refreshPreview = useCallback(
    async (rawCode: string, portion: number) => {
      const normalized = normalizeVendorReferralCode(rawCode);
      if (!normalized) {
        setReferralDiscountGbp(0);
        setCodeValid(false);
        setError(rawCode.trim() ? "Enter a valid referral code (1–6 digits)." : null);
        return;
      }
      setValidating(true);
      setError(null);
      try {
        const preview = await fetchVendorReferralPreview(vendorUserId, normalized, portion);
        const isCodeValid = preview.code_valid;
        setCodeValid(isCodeValid);
        setReferralDiscountGbp(isCodeValid ? preview.qualified_discount_gbp : 0);
        // …
```

Referral discount tiers (frontend mirror of backend) — `bookingServiceFee.ts`:

```5:8:frontend/lib/bookingServiceFee.ts
export const REFERRAL_FEE_TIERS = [
  { minSpendGbp: 600, feeDiscountGbp: 15 },
  { minSpendGbp: 400, feeDiscountGbp: 10 },
] as const;
```

---

## Step 4 — Fee breakdown on profile and modal

**File:** `VendorBrowseDetailBody.tsx` — sidebar shows `ClientFeeBreakdownSummary` when selection has priced lines:

```132:138:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const selectedFeeBreakdown = useMemo(() => {
    if (selectedTotal.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: selectedTotal.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [selectedTotal.hasTbc, selectedTotal.sumNumeric, referralDiscountGbp]);
```

**File:** `VendorBookingModal.tsx` — same breakdown in the modal footer:

```194:200:frontend/features/client/browse/VendorBookingModal.tsx
  const clientFeeBreakdown = useMemo(() => {
    if (estimate.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: estimate.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [estimate.sumNumeric, estimate.hasTbc, referralDiscountGbp]);
```

```584:589:frontend/features/client/browse/VendorBookingModal.tsx
                <ClientFeeBreakdownSummary
                  breakdown={clientFeeBreakdown}
                  footnote="The vendor may adjust the price before you pay."
                />
```

`ClientFeeBreakdownSummary` renders vendor portion, Eventtz fee (5%), optional referral discount rows, and estimated total.

---

## Step 5 — Open the modal (orchestration + prefill)

**Modal mount** — passes selection, quantities, referral code, and search context:

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

| Prop | Source | Purpose |
|------|--------|---------|
| `initialSelectedIds` | Profile sidebar checkboxes | Package selection |
| `initialQuantities` | Profile quantity steppers | Per-unit counts |
| `initialReferralCode` | `?vref=` via `captureVendorReferralFromSearchParams` | Pre-fill referral field |
| `vendorPayload` | `vendor.profile_form_data` | Calendar conflict check |
| `searchPrefill` | Browse URL `?dates=…` | Pre-fill event dates |
| `clientSearchContext` | Marketplace filters | Stored on booking for analytics |

---

## Step 6 — `VendorBookingModal`: thin shell + delegated submit

The modal wires three hooks — package selection, event form state, and submit — then renders UI.

**Package selection** — `usePerUnitPackageSelection` (same hook as the profile sidebar):

```78:87:frontend/features/client/browse/VendorBookingModal.tsx
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
```

**Event form state** — `useEnquireEventFormState` (dates, venue, notes, celebration prefill):

```88:108:frontend/features/client/browse/VendorBookingModal.tsx
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

**Calendar soft warning** (client-side, before POST):

```128:134:frontend/features/client/browse/VendorBookingModal.tsx
  const calendarConflict = useMemo(() => {
    if (!vendorPayload || !eventDate.trim()) return false;
    const end = eventEndDate.trim() || null;
    const range = isoDatesInEventRange(eventDate.trim(), end);
    if (range.length === 0) return false;
    return !vendorPayloadAllowsEventDates(vendorPayload, range);
  }, [vendorPayload, eventDate, eventEndDate]);
```

**Submit delegates to hook:**

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

---

## Step 7 — `useVendorBookingSubmit`: validation → payload → POST

**File:** `useVendorBookingSubmit.ts`

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

**File:** `bookingEnquireSubmit.ts` — shared payload builder (also used by `MultiVendorEnquireModal`):

```4:28:frontend/lib/bookingEnquireSubmit.ts
export function buildBookingRequestPayload(
  parsed: ClientBookingRequestInput,
  options: {
    vendorUserId: string;
    selectedOptionIds: string[];
    quantities?: Record<string, number>;
    clientSearchContext?: ClientSearchContext | null;
    eventId?: string | null;
    vendorReferralCode?: string | null;
  },
): CreateBookingRequestPayload {
  return {
    vendor_user_id: options.vendorUserId,
    event_name: parsed.eventName,
    event_date: parsed.eventDate,
    event_end_date: parsed.eventEndDate?.trim() || null,
    event_postcode: null,
    event_address: (parsed.venueAddress ?? "").trim() || null,
    notes: (parsed.notes ?? "").trim() || null,
    selected_option_ids: options.selectedOptionIds,
    quantities: options.quantities,
    client_search_context: options.clientSearchContext ?? undefined,
    event_id: options.eventId ?? null,
    vendor_referral_code: options.vendorReferralCode?.trim() || null,
  };
}
```

**Error fallback** uses shared copy:

```96:99:frontend/features/client/browse/useVendorBookingSubmit.ts
          setSubmitResult({
            type: "error",
            message: getApiErrorDetail(err) ?? CLIENT_BOOKING_ERROR_COPY.enquiryFailed,
          });
```

### HTTP request example

```http
POST /api/v1/client/booking-requests
Cookie: eventtz_access_token=...

{
  "vendor_user_id": "abc-vendor-uuid",
  "event_name": "Ada's 30th",
  "event_date": "2026-09-20",
  "event_end_date": null,
  "event_postcode": null,
  "event_address": "The Grand Hall, 12 Park Lane, London",
  "notes": "Outdoor garden, ~80 guests",
  "selected_option_ids": ["pkg-chairs"],
  "quantities": { "pkg-chairs": 50 },
  "vendor_referral_code": "482910",
  "client_search_context": {
    "q": "wedding photography",
    "country": "GB",
    "dates": ["2026-09-20"]
  },
  "event_id": null
}
```

---

## Step 8 — Validation (Zod)

**File:** `frontend/lib/validation/bookings.ts`

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

**Payload builder** — only per-unit option ids are included:

```91:104:frontend/features/client/browse/vendorBrowseDetailModel.ts
export function bookingQuantitiesPayload(
  selectedIds: string[],
  options: BrowsePricingOption[],
  quantities: Record<string, number>,
): Record<string, number> | undefined {
  const byId = new Map(options.map((o) => [o.id, o]));
  const out: Record<string, number> = {};
  for (const id of selectedIds) {
    const opt = byId.get(id);
    if (!opt || opt.pricingMode !== "per_unit") continue;
    out[id] = Math.max(quantities[id] ?? opt.minQuantity, opt.minQuantity);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
```

---

## Step 9 — Frontend API layer

**File:** `clientBookingsApi.ts`

```27:44:frontend/lib/clientBookingsApi.ts
export type CreateBookingRequestPayload = {
  vendor_user_id: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  event_postcode?: string | null;
  event_address?: string | null;
  notes: string | null;
  selected_option_ids: string[];
  /** Client-chosen counts for per-item packages. */
  quantities?: Record<string, number> | null;
  client_search_context?: ClientSearchContext | null;
  event_id?: string | null;
  vendor_referral_code?: string | null;
};
```

---

## Step 10 — Backend HTTP handler

**File:** `backend/app/features/bookings/http/client.py`

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

**Contract** — `CreateBookingRequestBody` in `backend/app/contracts/booking.py`:

```139:146:backend/app/contracts/booking.py
    selected_option_ids: list[str] = Field(min_length=1)
    #: Client-chosen counts keyed by option id. Required for per-unit packages; ignored for fixed.
    quantities: dict[str, int] | None = None
    #: Marketplace search filters at enquire time (for alternative-vendor nudges).
    client_search_context: dict[str, Any] | None = None
    event_id: str | None = Field(default=None, max_length=36)
    #: Vendor client referral code (?vref=) — up to 6 digits when valid.
    vendor_referral_code: str | None = Field(default=None, max_length=6)
```

---

## Step 11 — `create_booking_request` (core logic)

**File:** `backend/app/features/bookings/create.py`

### 11a — Guards

```181:200:backend/app/features/bookings/create.py
    if client_user_id == vendor_user_id:
        raise ValueError(booking_messages.CANNOT_BOOK_OWN_VENDOR)

    if not _vendor_is_approved_for_explore(vendor_user_id):
        raise ValueError(
            booking_messages.VENDOR_NOT_AVAILABLE_FULL,
        )

    assert_user_not_suspended(client_user_id)
    assert_user_not_suspended(vendor_user_id)

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date)

    payload = get_bookable_vendor_profile_form_data(vendor_user_id)
    if payload is None:
        raise ValueError(
            booking_messages.VENDOR_NOT_AVAILABLE_FULL,
        )

    _enforce_max_bookings_per_day(vendor_user_id, payload, event_date, event_end_date)
```

### 11b — Snapshot line items + referral pricing

```202:221:backend/app/features/bookings/create.py
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
    if float(pb.get("vendor_portion_gbp") or 0) <= 0 and not pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.BOOKING_NO_VALID_PRICE)
```

**File:** `list_pricing.py` — per-unit quantity enforcement:

```442:463:backend/app/features/vendors/list_pricing.py
def _quantity_for_option(
    opt: PricingOption,
    quantities: dict[str, int] | None,
) -> int:
    if opt.pricing_mode != PRICING_MODE_PER_UNIT:
        return 1
    qty: int | None = None
    if quantities:
        raw = quantities.get(opt.id)
        if raw is not None:
            try:
                qty = int(raw)
            except (TypeError, ValueError):
                qty = None
    if qty is None:
        raise ValueError(vendor_messages.PER_UNIT_QUANTITY_REQUIRED)
    min_qty = opt.min_quantity if opt.min_quantity >= 1 else 1
    if qty < min_qty or (opt.max_quantity is not None and qty > opt.max_quantity):
        raise ValueError(
            vendor_messages.quantity_out_of_range(opt.heading, min_qty, opt.max_quantity),
        )
    return qty
```

**File:** `validate.py` — `resolve_referral_pricing_inputs`:

```59:80:backend/app/features/vendor_referrals/validate.py
def resolve_referral_pricing_inputs(
    vendor_user_id: str,
    referral_code: str | None,
    vendor_portion_gbp: float,
    *,
    require_valid_when_provided: bool = True,
) -> tuple[str | None, float, float | None]:
    """
    Return (normalized_code, referral_fee_discount_gbp, tier_min_spend_gbp).

    Discount is tier amount capped later in build_pricing_breakdown.
    """
    normalized = validate_vendor_referral_code(
        vendor_user_id,
        referral_code,
        require_valid_when_provided=require_valid_when_provided,
    )
    if not normalized:
        return None, 0.0, None
    discount = referral_fee_discount_for_spend(vendor_portion_gbp)
    tier_min = referral_tier_min_spend(vendor_portion_gbp) if discount > 0 else None
    return normalized, discount, tier_min
```

### 11c — Insert row (with fee + referral snapshot)

```236:250:backend/app/features/bookings/create.py
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
```

| Column | Value at enquire |
|--------|------------------|
| `status` | `pending` |
| `payment_status` | `unpaid` (DB default) |
| `initiator` | `client` |
| `line_items` | JSON snapshot (qty × rate for per-unit) |
| `service_fee_percent` | `5` (snapshotted) |
| `vendor_referral_code` | normalized code or `null` |
| `client_search_context` | optional browse filters |

---

## Step 12 — Success UX

After POST succeeds, the modal shows a **success overlay** — redirect only happens when the client clicks **View booking**.

**File:** `VendorBookingModal.tsx` — result modal wired from `useVendorBookingSubmit`:

```270:288:frontend/features/client/browse/VendorBookingModal.tsx
    <Modal
      isOpen={submitResult !== null}
      onClose={dismissResultModal}
      zIndexClassName="z-[60]"
      maxWidthClassName="max-w-md"
      title={submitResult?.type === "success" ? "Request sent" : "Couldn't send request"}
      footer={
        submitResult?.type === "success" ? (
          <Button
            variant="primary"
            onClick={() => {
              const id = submitResult.bookingId;
              dismissResultModal();
              onSuccess?.(id);
            }}
            className="w-full"
          >
            View booking
          </Button>
```

Flow: POST success → success modal → **View booking** → toast (`CLIENT_BOOKING_TOAST_COPY.requestSent`) + `router.push(`/client/bookings/${bookingId}`)`.

---

## Full chain (one picture)

```
Client ticks packages (+ quantities) on profile sidebar
  ↓
Clicks "Request booking"
  ↓
guardBooking() → setBookingOpen(true) → VendorBookingModal mounts
  ↓
Client fills eventName, eventDate, venueAddress, notes; optional referral code
  (packages/quantities from profile; adjustable per-unit in modal)
  ↓
Clicks "Send booking request"
  ↓
useVendorBookingSubmit.submit()
  → parseForm(clientBookingRequestSchema)
  → calendarConflict check (soft block)
  → buildBookingRequestPayload(...) → postBookingRequest(...)
  → POST /api/v1/client/booking-requests (session cookie)
  ↓
post_booking_request() → require_client() → CreateBookingRequestBody
  ↓
create_booking_request()
  → resolve_line_items(..., quantities) — snapshot prices
  → resolve_referral_pricing_inputs() — referral fee discount
  → build_pricing_breakdown(service_fee_percent=5)
  → resolve_event_for_booking() — link or create celebration
  → booking_requests.insert({ status: "pending", line_items, service_fee_percent, vendor_referral_code, ... })
  → notes → chat + conversation_id
  → notify vendor + client + SSE + analytics
  ↓
Response: { booking_request_id, booking_status: "pending", event_id }
  ↓
Success modal "Request sent" → client clicks "View booking"
  ↓
onSuccess(bookingId) → toast + router.push(/client/bookings/{id})
```

---

## Analytics (Mixpanel + backend)

| Event | When | Where |
|-------|------|-------|
| `enquiry_started` | Client clicks “Request booking” | `ClientVendorBrowseDetailView` |
| `multi_enquire_opened` | Client opens multi-vendor modal | `MarketplaceExploreView` |
| `enquiry_created` | POST succeeds (per vendor) | `useVendorBookingSubmit`, `MultiVendorEnquireModal` |
| `enquiry_failed` | POST throws | both modals |
| `multi_enquiry_created` | All vendors in batch succeed | `MultiVendorEnquireModal` |
| `enquiry_created` (backend) | Row inserted | `create.py` → `record_marketplace_event` |
| `enquiry_multi_created` (backend) | First item in multi batch | `create.py` when `batchSize > 1` |
| `vendor_notified` (backend) | Vendor notification dispatched | `create.py` |

---

## Multi-vendor enquire (browse grid)

**File:** `MultiVendorEnquireModal.tsx` — same form fields, sequential `buildBookingRequestPayload` → `postBookingRequest` per vendor:

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

Partial-failure handling uses `CLIENT_BOOKING_ERROR_COPY` and `CLIENT_BOOKING_TOAST_COPY`:

```217:244:frontend/features/marketplace/MultiVendorEnquireModal.tsx
      if (createdIds.length === 0) {
        setError(failures.join("\n") || CLIENT_BOOKING_ERROR_COPY.multiEnquireNone);
        await withMutationFeedback(showToast, {
          successTitle: CLIENT_BOOKING_TOAST_COPY.requestsNotSent,
          // …
        });
        return;
      }
      if (failures.length > 0) {
        setError(
          `Sent ${createdIds.length} of ${optionIdsByVendor.length} requests.\n\n${failures.join("\n")}`,
        );
        await withMutationFeedback(showToast, {
          successTitle: CLIENT_BOOKING_TOAST_COPY.partialRequestsSent(
            createdIds.length,
            optionIdsByVendor.length,
          ),
```

- One shared event brief, one package per vendor
- **Sequential** `postBookingRequest` per vendor (not one bulk API)
- Per-unit packages include `quantities` map per vendor
- First successful response may return `event_id`; later calls reuse it
- **Redirect:** 1 success → `/client/bookings/{id}`; 2+ successes → `/client/bookings` list

---

## Models vs SQL (what to remember)

| Concept | Contract / type | Stored in |
|---------|---------------|-----------|
| Enquiry payload | `CreateBookingRequestBody` | — (request only) |
| Created response | `BookingRequestCreated` | — (response only) |
| Persisted booking | row in `booking_requests` | Postgres via Supabase |
| Price snapshot | `line_items` JSON on row | not live join to vendor packages |
| Per-unit lines | `quantity`, `unit_rate_gbp`, `unit_label` in `line_items` | snapshotted at create |
| Package IDs sent | `selected_option_ids` | also stored on row |
| Service fee | `service_fee_percent` column | snapshotted (default 5%) |
| Referral | `vendor_referral_code` column | normalized 1–6 digit code |

Table definition: `backend/sql/010_booking_requests.sql` (+ `083_vendor_client_referrals.sql` for referral/fee columns)

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Browse view | Public read |
| Enquire button | `user_type === "client"` |
| POST API | `require_client` |
| Cannot book self | `create_booking_request` |
| Vendor must be bookable | same as explore listing |
| Invalid referral code (when provided) | `resolve_referral_pricing_inputs` → 400 |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| 401 on enquire | Session cookie / `AuthProvider` / `require_client` |
| Enquire blocked before modal | `useLaunchingSoonBookingGuard` / `BOOKINGS_LAUNCHING_SOON` (currently `false`) |
| “Packages no longer available” | Vendor edited packages; client had stale IDs |
| “Quantity required” for per-unit | Missing `quantities` in POST — `list_pricing._quantity_for_option` |
| Quantity out of range | `packagePricing` min/max vs modal `QuantityStepper` |
| “Event date cannot be in the past” | `CreateBookingRequestBody` validator |
| Calendar rejected | `calendar.py` — blocked dates / weekdays / capacity |
| Calendar blocked in modal only | `VendorBookingModal` `calendarConflict` (soft) vs server hard reject |
| “No valid price” | Quote-only packages with no TBC flag — `BOOKING_NO_VALID_PRICE` |
| Referral code rejected | `validate.py` — wrong vendor, disabled, or malformed |
| Referral preview OK but no discount | Vendor portion below tier (`REFERRAL_LOWEST_TIER_SPEND_GBP`) |
| Fee breakdown mismatch | Compare `computeClientFeeBreakdown` vs server `build_pricing_breakdown` |
| Generic “Request failed” | `CLIENT_BOOKING_ERROR_COPY.enquiryFailed` in `useVendorBookingSubmit` |
| Multi-vendor partial send | `MultiVendorEnquireModal` failures array + `partialRequestsSent` toast |
| Notes missing in chat | `ensure_client_booking_notes_in_chat` in `create.py` |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Server-side `resolve_line_items` snapshot | **Leave it alone** — correct commerce modeling |
| IDs + quantities payload (no prices) | **Leave it alone** — prevents price tampering |
| `useVendorBookingSubmit` extraction | **Leave it alone** — reusable for future enquire UIs |
| `buildBookingRequestPayload` shared helper | **Leave it alone** — single source of truth for POST bodies |
| `usePerUnitPackageSelection` + `useEnquireEventFormState` | **Leave it alone** — keeps modal thin and profile/modal in sync |
| Multi-vendor = N POSTs | **Improve later** — could be one batch endpoint |
| Calendar warning in modal vs hard reject on server | **Leave it alone** — good UX + safety |

---

## Key concepts from this slice

- **Enquiry vs booking paid** — enquire creates `pending` + `unpaid`; payment is Slice 4.
- **Snapshot `line_items`** — agreed prices frozen at submit time (qty × rate for per-unit).
- **Per-unit pricing** — `pricingMode: "per_unit"`; client sends `quantities`; server multiplies.
- **Service fee** — 5% Eventtz fee on vendor portion; shown via `ClientFeeBreakdownSummary`.
- **Referral codes** — `?vref=` → preview → `vendor_referral_code` on row; discount applies to Eventtz fee tiers.
- **selected_option_ids** — client sends IDs; server resolves prices.
- **initiator `client`** — vendor-initiated quotes use a different create path (`create_vendor_quote_booking_request`).
- **client_search_context** — remembers browse filters for product analytics.
- **Celebration events** — every enquire links to a `client_events` row (existing or newly created).
- **Two calendar layers** — modal soft warning + server hard reject.
- **Shared copy** — `bookingConfirmCopy.ts` centralises toast and error strings.

---

## TL;DR

- **Enquire** = `POST /api/v1/client/booking-requests` via `buildBookingRequestPayload` + `useVendorBookingSubmit` from `VendorBookingModal` or `MultiVendorEnquireModal`.
- **Only clients** with a valid session; guests must sign in.
- **Form** collects event details; packages + per-unit quantities from profile (adjustable in modal).
- **Browser** sends `selected_option_ids`, optional `quantities`, optional `vendor_referral_code`, event fields — never prices.
- **Server** copies package prices into `line_items`, applies referral fee discount, stores `service_fee_percent`, inserts `pending` / `unpaid` row.
- **UI** shows vendor portion + Eventtz fee via `ClientFeeBreakdownSummary`.
- **Success** = modal confirmation → View booking → toast + redirect.
- **Next:** Slice 3b — client booking detail page (`/client/bookings/[id]`).

---

## Related lessons

- Slice 1: `slice-1-auth-me.md`
- Slice 2: `slice-2-client-browse.md`, `slice-2-browse-flow-walkthrough.md`
- Slice 3b: `slice-3b-client-booking-detail.md`
