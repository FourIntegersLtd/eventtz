# Slice 3a — Client booking: enquire

**Walkthrough:** `slice-3a-enquire-flow-walkthrough.md` — traces one click button → DB row with example payload.

### User story

A **signed-in client** picks packages on a vendor profile (or selects several vendors on browse), fills event details, and sends an enquiry. The backend creates a `booking_requests` row with **snapshotted prices**, status **`pending`**, payment **`unpaid`**. The vendor is notified; the client lands on booking detail to wait for a response.

**Guests** can browse but see “Sign in / Create account” instead of enquire.

---

## What the booking form does

```typescript
void postBookingRequest({
  vendor_user_id: vendorUserId,
  event_name: parsed.data.eventName,
  event_date: parsed.data.eventDate,
  selected_option_ids: parsed.data.selectedOptionIds,
  // …
});
```

| Piece | Role |
|--------|------|
| `VendorBookingModal` | React form — event name, dates, venue, notes; packages are fixed from the profile sidebar |
| `clientBookingRequestSchema` | Zod validation before submit |
| `postBookingRequest()` | HTTP `POST` to `/api/v1/client/booking-requests` with session cookie |
| `CreateBookingRequestBody` | Pydantic contract on the backend — validates dates, option ids |
| `create_booking_request()` | Business logic — snapshot prices, insert row, notify vendor |

Plain English: the client fills a form in a modal. The browser sends **package IDs and event details only** — never prices. The server re-reads the vendor profile, copies prices into `line_items`, and saves a `pending` booking row.

---

## What happens at a glance

```
Client picks packages on profile
    → guardBooking (optional launching-soon gate)
    → VendorBookingModal (prefill from browse URL / planner / celebration event)
    → calendar soft warning OR submit
    → POST /client/booking-requests
        → create_booking_request()
            → guards (self-book, bookable vendor, calendar, capacity)
            → resolve_line_items() + automatic discounts (prices from vendor profile)
            → resolve_event_for_booking() (link or create celebration event)
            → insert booking_requests (pending / unpaid)
            → notes → chat + conversation_id on row
            → notify vendor + client + SSE + analytics
    → success modal → "View booking"
    → toast + redirect /client/bookings/{id}
```

---

## Example: client enquires from a vendor profile

1. Signed-in client opens `/client/browse/abc-vendor-uuid?dates=2026-09-20`.
2. Ticks “Gold package” on the profile sidebar → clicks **Request booking**.
3. `guardBooking` passes (or shows launching-soon modal if feature flag is on).
4. `VendorBookingModal` opens with package IDs fixed, event date prefilled from URL.
5. Client fills event name + notes → submits (calendar conflict blocks submit client-side if dates don’t match vendor calendar).
6. `POST /api/v1/client/booking-requests` with `selected_option_ids` only — no prices.
7. Server snapshots prices into `line_items`, links a `client_events` row, inserts `pending` booking.
8. Notes appear in chat; vendor gets in-app + email notification.
9. Modal shows success → client clicks **View booking** → toast + redirect to `/client/bookings/{id}` (Slice 3b).

---

## Complete route — single vendor enquire

### Frontend (profile → modal → API)

1. `frontend/app/client/(portal)/browse/[userId]/page.tsx` — route `/client/browse/[userId]`
2. `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx` — orchestration
3. `frontend/features/client/browse/useExploreVendor.ts` — loads vendor (public explore API, Slice 2)
4. `frontend/features/client/browse/VendorBrowseDetailBody.tsx` — packages UI + “Request booking”
5. `frontend/features/client/browse/vendorBrowseDetailModel.ts` — `buildBrowsePricingOptions`, `buildBookingLineItems`
6. `frontend/features/bookings/useLaunchingSoonBookingGuard.tsx` — optional feature-flag gate
7. `frontend/features/bookings/eventEnquirePrefill.ts` — planner URL → prefill fields
8. `frontend/features/bookings/useActiveEventPrefill.ts` — linked celebration event prefill
9. `frontend/features/bookings/ActiveEventPrefillBanner.tsx` — “Use your event” banner in modal
10. `frontend/lib/marketplaceSearchParams.ts` — browse filters → `clientSearchContext`
11. `frontend/features/client/browse/VendorBookingModal.tsx` — form + submit + success modal
12. `frontend/lib/validation/bookings.ts` — `clientBookingRequestSchema` (Zod)
13. `frontend/lib/clientBookingsApi.ts` — `postBookingRequest`
14. `frontend/lib/mixpanelEvents.ts` — `enquiry_started`, `enquiry_created`, `enquiry_failed`
15. `frontend/lib/axios.ts` — session cookies (`withCredentials`)

### Backend (HTTP → business logic → DB)

1. `backend/app/http/router.py` — mounts client booking router
2. `backend/app/features/bookings/http/client.py` — `POST /booking-requests`
3. `backend/app/features/auth/http/guards.py` — `require_client`
4. `backend/app/contracts/booking.py` — `CreateBookingRequestBody`, `BookingRequestCreated`
5. `backend/app/features/bookings/create.py` — `create_booking_request`
6. `backend/app/features/vendors/list_pricing.py` — `resolve_line_items` (snapshot)
7. `backend/app/features/bookings/pricing.py` — `build_pricing_breakdown`, totals
8. `backend/app/features/bookings/calendar.py` — availability + capacity checks
9. `backend/app/features/client_events/events.py` — `resolve_event_for_booking`
10. `backend/app/features/chat/service.py` — notes → first chat message
11. `backend/app/features/email/dispatch.py` — in-app + email notifications
12. `backend/app/features/bookings/booking_funnel_timestamps.py` — `mark_vendor_notified`
13. `backend/app/features/analytics/events.py` — `enquiry_created`, `enquiry_multi_created`, `vendor_notified`
14. `backend/app/core/db.py` — `booking_requests` insert

### After success

15. `frontend/app/client/(portal)/bookings/[bookingId]/page.tsx` — booking detail (Slice 3b)

---

## Complete route — multi-vendor enquire (browse grid)

Same API from step 13 onward. Different UI entry:

1. `frontend/app/client/(portal)/browse/page.tsx` — `/client/browse`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx` — multi-select + “Message N together”
3. `frontend/features/marketplace/MultiVendorEnquireModal.tsx` — one brief, **N sequential** `postBookingRequest` calls
4. `frontend/features/bookings/MultiVendorPackagePicker.tsx` — pick one package per vendor
5. `frontend/features/bookings/multiVendorPackageSelection.ts` — initial package picks per vendor

---

## Parameter map — form → API → database

Every field the client can edit, and how it travels through the stack:

| Form state (`VendorBookingModal`) | Zod field (`clientBookingRequestSchema`) | Frontend payload (`CreateBookingRequestPayload`) | Backend body (`CreateBookingRequestBody`) | Stored on `booking_requests` row |
|-----------------------------------|------------------------------------------|--------------------------------------------------|-------------------------------------------|----------------------------------|
| `eventName` | `eventName` | `event_name` | `event_name` | `event_name` (or celebration title if linked) |
| `eventDate` | `eventDate` | `event_date` | `event_date` | `event_date` |
| `eventEndDate` | `eventEndDate` | `event_end_date` | `event_end_date` | `event_end_date` |
| `venueAddress` | `venueAddress` | `event_address` | `event_address` | `event_address` |
| — (always `null` at enquire) | — | `event_postcode` | `event_postcode` | `event_postcode` (Slice 4 payment) |
| `notes` | `notes` | `notes` | `notes` | `notes` + first chat message |
| `initialSelectedIds` (from profile) | `selectedOptionIds` | `selected_option_ids` | `selected_option_ids` | `selected_option_ids` + `line_items` snapshot |
| prop `vendorUserId` | — | `vendor_user_id` | `vendor_user_id` | `vendor_user_id` |
| prop `clientSearchContext` | — | `client_search_context` | `client_search_context` | `client_search_context` (jsonb) |
| `selectedEventId` (from prefill hook) | — | `event_id` | `event_id` | `event_id` (links `client_events`) |
| — (from session cookie) | — | — | — | `client_user_id` (from `require_client`) |

**Not sent from the browser:** package prices, `line_items`, `total_label`, `status`, `initiator`. The server computes all of those.

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
| Client | “Request booking” → modal (after `guardBooking`) |
| Vendor / admin browsing | Public chrome, no enquire hook |

**Launching-soon gate** — `useLaunchingSoonBookingGuard.tsx`:

```8:23:frontend/features/bookings/useLaunchingSoonBookingGuard.tsx
export function useLaunchingSoonBookingGuard() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isLaunchingSoon = BOOKINGS_LAUNCHING_SOON && !hasBookingEarlyAccess(user?.email);

  const guardBooking = useCallback(
    (action?: () => void) => {
      if (isLaunchingSoon) {
        setOpen(true);
        return true;
      }
      action?.();
      return false;
    },
    [isLaunchingSoon],
  );
```

When `BOOKINGS_LAUNCHING_SOON` is on and the client lacks early access, `guardBooking` shows `LaunchingSoonBookingModal` instead of opening the booking form.

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

## Step 2 — Package selection on the profile

**File:** `VendorBrowseDetailBody.tsx` — client ticks packages; selected IDs are passed to the modal as `initialSelectedIds`.

```102:110:frontend/features/client/browse/VendorBrowseDetailBody.tsx
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedLineItems = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selectedPackageIds]),
    [pricingOptions, selectedPackageIds],
  );
```

“Request booking” passes the selected ids up:

```193:206:frontend/features/client/browse/VendorBrowseDetailBody.tsx
        ) : onRequestBooking ? (
          <Button onClick={() => {
                if (selectedPackageIds.size === 0) { setBookingSelectError(true); return; }
                onRequestBooking([...selectedPackageIds]);
              }}>
            Request booking
          </Button>
```

**File:** `vendorBrowseDetailModel.ts` — UI estimate only (not sent to API):

```47:58:frontend/features/client/browse/vendorBrowseDetailModel.ts
export function buildBookingLineItems(
  options: BrowsePricingOption[],
  selectedIds: string[],
): BookingLineItem[] {
  const set = new Set(selectedIds);
  return options.filter((o) => set.has(o.id)).map((o) => ({
    id: o.id,
    heading: o.heading,
    unitPriceGbp: o.unitPriceGbp,
  }));
}
```

Plain English: the UI shows prices for convenience, but the **server** re-reads the vendor profile when you submit.

---

## Step 3 — Open the modal (orchestration + prefill)

Before the form renders, `ClientVendorBrowseDetailView` builds prefill props from the browse URL and mounts the modal.

**Prefill from browse URL dates:**

```79:91:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const bookingSearchPrefill = useMemo((): VendorBookingSearchPrefill => {
    const d = marketplaceSearch.dates;
    const first = d[0];
    let eventEndDate: string | undefined;
    if (d.length === 2 && first && d[1] && d[1] >= first) {
      eventEndDate = d[1];
    }
    return {
      eventDate: first ?? "",
      eventEndDate,
      datesFlexible: marketplaceSearch.dateFlexible,
    };
  }, [marketplaceSearch]);
```

**Search context for analytics (stored on the booking row):**

```100:105:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const bookingClientSearchContext = useMemo(() => {
    const base = toClientSearchContext(marketplaceSearch);
    const planId = searchParams.get("fromPlanner")?.trim();
    if (!planId) return base;
    return { ...base, source: "planner" as const, plannerPlanId: planId };
  }, [marketplaceSearch, searchParams]);
```

**Modal mount — all props passed into the form:**

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

| Prop | Source | Purpose |
|------|--------|---------|
| `initialSelectedIds` | Profile sidebar checkboxes | Fixed package selection for this modal |
| `vendorPayload` | `vendor.profile_form_data` | Calendar conflict check |
| `searchPrefill` | Browse URL `?dates=…` | Pre-fill event dates |
| `initialPrefill` | Planner query params | Pre-fill event name/dates from AI planner |
| `linkedEventId` | `?event_id=…` | Link to existing celebration |
| `clientSearchContext` | Marketplace filters | Stored on booking for analytics |

---

## Step 4 — `VendorBookingModal`: props and form state

**File:** `VendorBookingModal.tsx`

### 4a — Props the form receives

```43:61:frontend/features/client/browse/VendorBookingModal.tsx
type VendorBookingModalProps = {
  onClose: () => void;
  /** Called once the request is created - the caller owns navigation to the new booking's detail page. */
  onSuccess?: (bookingId: string) => void;
  vendorDisplayName: string;
  vendorUserId: string;
  pricingOptions: BrowsePricingOption[];
  /** Package / rate ids selected on the profile sidebar - fixed for this modal; change selection by closing and re-picking there. */
  initialSelectedIds: string[];
  /** Vendor onboarding payload - used to warn if chosen dates conflict with calendar. */
  vendorPayload?: Record<string, unknown>;
  /** Dates/types from marketplace URL on `/client/browse/[id]?…`. */
  searchPrefill?: VendorBookingSearchPrefill;
  /** Event fields from AI planner (or other deep links) - applied when no active client event. */
  initialPrefill?: EventEnquirePrefill | null;
  linkedEventId?: string | null;
  /** Marketplace filters to store on the booking for alternative-vendor nudges. */
  clientSearchContext?: ClientSearchContext | null;
};
```

### 4b — React state (one `useState` per form field)

```76:101:frontend/features/client/browse/VendorBookingModal.tsx
  // Selection happens once, on the profile sidebar - this modal only confirms dates/venue/notes.
  const selectedIds = useMemo(() => new Set(initialSelectedIds), [initialSelectedIds]);
  const [eventName, setEventName] = useState(initialPrefill?.eventName ?? "");
  const [eventDate, setEventDate] = useState(
    searchPrefill?.eventDate?.trim() ||
      initialPrefill?.eventDate?.trim() ||
      todayIsoDate(),
  );
  const [eventEndDate, setEventEndDate] = useState(
    searchPrefill?.eventEndDate ?? initialPrefill?.eventEndDate ?? "",
  );
  const [venueAddress, setVenueAddress] = useState(initialPrefill?.venueAddress ?? "");
  const [notes, setNotes] = useState(initialPrefill?.notes ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    null | { type: "error"; message: string } | { type: "success"; bookingId: string }
  >(null);
  const {
    pendingPrefill,
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    applyPrefill,
    dismissForNewEvent,
  } = useActiveEventPrefill({ linkedEventId });
```

| State variable | Form field | Initial value |
|----------------|------------|---------------|
| `eventName` | Event name input | Planner prefill, or empty |
| `eventDate` | Start date | Browse URL dates → planner → today |
| `eventEndDate` | End date (optional) | Browse URL range, or empty |
| `venueAddress` | Venue textarea | Planner prefill, or empty |
| `notes` | Details textarea | Planner prefill, or empty |
| `selectedIds` | Packages list (read-only) | `initialSelectedIds` from profile |
| `selectedEventId` | Hidden — links celebration | From `useActiveEventPrefill` when `linkedEventId` set |

### 4c — Calendar soft warning (client-side, before POST)

```140:146:frontend/features/client/browse/VendorBookingModal.tsx
  const calendarConflict = useMemo(() => {
    if (!vendorPayload || !eventDate.trim()) return false;
    const end = eventEndDate.trim() || null;
    const range = isoDatesInEventRange(eventDate.trim(), end);
    if (range.length === 0) return false;
    return !vendorPayloadAllowsEventDates(vendorPayload, range);
  }, [vendorPayload, eventDate, eventEndDate]);
```

If `calendarConflict` is true, submit is blocked with a validation message. The server still runs `_enforce_vendor_calendar` as a hard reject — the modal warning is UX, not the only guard.

---

## Step 5 — The booking form UI

**File:** `VendorBookingModal.tsx` — the fields the client fills:

### Event name

```366:384:frontend/features/client/browse/VendorBookingModal.tsx
            <div>
              <label
                htmlFor="booking-event-name"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Event name
              </label>
              <input
                id="booking-event-name"
                type="text"
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  setValidationError(null);
                }}
                placeholder="e.g. Ade and Kemi - wedding reception"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
              />
            </div>
```

### Event dates

```386:426:frontend/features/client/browse/VendorBookingModal.tsx
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="booking-event-date"
                  className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Event date
                </label>
                <DateInput
                  id="booking-event-date"
                  min={minEventDate}
                  value={eventDate}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    setValidationError(null);
                  }}
                  shellClassName="mt-1.5"
                  className="focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="booking-event-end"
                  className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  End date <span className="font-normal normal-case text-neutral-400">(optional)</span>
                </label>
                <DateInput
                  id="booking-event-end"
                  allowEmpty
                  min={eventDate.trim() || minEventDate}
                  value={eventEndDate}
                  onChange={(e) => {
                    setEventEndDate(e.target.value);
                    setValidationError(null);
                  }}
                  shellClassName="mt-1.5"
                  className="focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
```

### Venue address (optional)

```428:448:frontend/features/client/browse/VendorBookingModal.tsx
            <div>
              <label
                htmlFor="booking-venue-address"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Venue location{" "}
                <span className="font-normal normal-case text-neutral-400">(optional)</span>
              </label>
              <textarea
                id="booking-venue-address"
                rows={3}
                value={venueAddress}
                onChange={(e) => {
                  setVenueAddress(e.target.value);
                  setValidationError(null);
                }}
                placeholder="e.g. The Grand Hall, 12 Park Lane, London"
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500">Add before you pay.</p>
            </div>
```

### Packages (read-only — selected on profile)

```450:514:frontend/features/client/browse/VendorBookingModal.tsx
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Packages &amp; rates
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  Change
                </button>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {pricingOptions
                  .filter((opt) => selectedIds.has(opt.id))
                  .map((opt) => (
                    <li key={opt.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5">
                      <span className="text-sm font-medium text-neutral-900">{opt.heading}</span>
                      ...
                    </li>
                  ))}
                {estimate.autoLines.map((line) => (
                  <li key={line.id} ...>
                    ...
                  </li>
                ))}
              </ul>
            </div>
```

“Change” closes the modal so the client re-picks packages on the profile sidebar. Prices shown here are a **UI estimate** — only `selected_option_ids` are sent to the API.

### Notes to vendor

```516:533:frontend/features/client/browse/VendorBookingModal.tsx
            <div>
              <label
                htmlFor="booking-notes"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Details for the vendor
              </label>
              <textarea
                id="booking-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Guest count, venue, dietary needs, timeline, or questions…"
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{notes.length}/2000</p>
            </div>
```

### Submit button

```550:553:frontend/features/client/browse/VendorBookingModal.tsx
          <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
            <Button variant="primary" size="md" onClick={submit} loading={submitting} className="w-full py-3">
              Send booking request
            </Button>
          </div>
```

---

## Step 6 — Validation (Zod) before submit

**File:** `frontend/lib/validation/bookings.ts`

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

The modal calls `parseForm(clientBookingRequestSchema, { eventName, eventDate, eventEndDate, venueAddress, notes, selectedOptionIds })` inside `submit()`. If validation fails, `validationError` is set and no HTTP request is made.

---

## Step 7 — Submit handler: form → `postBookingRequest`

**File:** `VendorBookingModal.tsx` — full `submit()` function:

```195:246:frontend/features/client/browse/VendorBookingModal.tsx
  const submit = () => {
    const parsed = parseForm(clientBookingRequestSchema, {
      eventName,
      eventDate,
      eventEndDate: eventEndDate || null,
      venueAddress,
      notes,
      selectedOptionIds: [...selectedIds],
    });
    if (!parsed.ok) {
      setValidationError(parsed.formError);
      return;
    }
    if (calendarConflict) {
      setValidationError(
        "These dates don’t match this vendor’s availability. Adjust the dates or message them to confirm.",
      );
      return;
    }
    setValidationError(null);
    setSubmitting(true);
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
      .then((created) => {
        track(MixpanelEvents.enquiry_created, {
          booking_id: created.booking_request_id,
          vendor_user_id: vendorUserId,
          option_count: parsed.data.selectedOptionIds.length,
          source: "single",
        });
        setSubmitResult({ type: "success", bookingId: created.booking_request_id });
        setSubmitting(false);
      })
      .catch((err: unknown) => {
        track(MixpanelEvents.enquiry_failed, {
          vendor_user_id: vendorUserId,
          source: "single",
        });
        setSubmitResult({ type: "error", message: getApiErrorDetail(err) ?? "Request failed. Try again." });
        setSubmitting(false);
      });
  };
```

Walkthrough of the mapping:

1. **Zod** validates camelCase form fields → `parsed.data`
2. **`postBookingRequest`** receives snake_case payload (API convention)
3. **`event_postcode`** is always `null` at enquire — required later at payment (Slice 4)
4. **`selected_option_ids`** — IDs only, no prices
5. **`event_id`** — from `useActiveEventPrefill` when linking a celebration; omitted otherwise (server creates one)

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
  "selected_option_ids": ["pkg-gold"],
  "client_search_context": {
    "q": "wedding photography",
    "country": "GB",
    "dates": ["2026-09-20"]
  },
  "event_id": null
}
```

---

## Step 8 — Frontend API layer

**File:** `clientBookingsApi.ts`

```11:56:frontend/lib/clientBookingsApi.ts
export type ClientSearchContext = {
  q?: string;
  types?: string[];
  location?: string;
  country?: string;
  dates?: string[];
  dateFlexible?: boolean;
  /** Set when sending the same brief to several vendors (analytics). */
  batchSize?: number;
  batchIndex?: number;
  /** Where the enquiry originated. */
  source?: "browse" | "multi" | "planner";
  /** AI planner plan id when source is planner. */
  plannerPlanId?: string;
};

export type CreateBookingRequestPayload = {
  vendor_user_id: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  /** Venue / event location postcode (optional at request; required before pay). */
  event_postcode?: string | null;
  /** Free-text venue address line(s). */
  event_address?: string | null;
  notes: string | null;
  selected_option_ids: string[];
  /** Marketplace filters at enquire time (for alternative-vendor nudges). */
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

`api` is the shared axios instance (`frontend/lib/axios.ts`) with `withCredentials: true` — the session cookie is sent automatically.

**Response shape (`BookingRequestCreated`):**

```json
{
  "success": true,
  "booking_request_id": "new-booking-uuid",
  "booking_status": "pending",
  "created_at": "2026-08-16T12:00:00+00:00",
  "event_id": "celebration-uuid"
}
```

---

## Step 9 — Backend HTTP handler

**File:** `backend/app/features/bookings/http/client.py`

Router prefix: `APIRouter(prefix="/client")` mounted at `/api/v1` → full path `/api/v1/client/booking-requests`.

```409:453:backend/app/features/bookings/http/client.py
@router.post("/booking-requests", response_model=BookingRequestCreated)
def post_booking_request(
    request: Request,
    response: Response,
    body: CreateBookingRequestBody,
) -> BookingRequestCreated:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    vendor_id = body.vendor_user_id.strip()
    try:
        uuid.UUID(vendor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_VENDOR_ID) from e

    try:
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
        )
    except ValueError as e:
        logger.info("booking_request rejected: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("booking_request insert failed client=%s vendor=%s", client_id, vendor_id)
        raise HTTPException(
            status_code=500,
            detail=booking_messages.COULD_NOT_SAVE_BOOKING_REQUEST,
        ) from None

    created_at = out.get("created_at")
    return BookingRequestCreated(
        id=str(out["id"]),
        status="pending",
        created_at=created_at if isinstance(created_at, str) else None,
        event_id=str(out.get("event_id") or "") or None,
    )
```

**Contract** — `CreateBookingRequestBody` in `backend/app/contracts/booking.py`:

```114:156:backend/app/contracts/booking.py
class CreateBookingRequestBody(BaseModel):
    vendor_user_id: str = Field(min_length=1)
    event_name: str = Field(min_length=1, max_length=500)
    event_date: date
    event_end_date: date | None = None
    #: Venue / event location postcode (optional at request; required before pay).
    event_postcode: str | None = Field(default=None, max_length=16)
    #: Free-text venue address (optional at request).
    event_address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
    selected_option_ids: list[str] = Field(min_length=1)
    #: Marketplace search filters at enquire time (for alternative-vendor nudges).
    client_search_context: dict[str, Any] | None = None
    event_id: str | None = Field(default=None, max_length=36)

    @model_validator(mode="after")
    def event_dates_valid(self) -> Self:
        today = date.today()
        if self.event_date < today:
            raise ValueError("Event date cannot be in the past.")
        if self.event_end_date is not None and self.event_end_date < self.event_date:
            raise ValueError("Event end date must be on or after the event start date.")
        return self
```

Pydantic parses the JSON body into this model before `create_booking_request` runs. `client_user_id` comes from the session cookie via `require_client`, not from the request body.

---

## Step 10 — `create_booking_request` (core logic)

**File:** `backend/app/features/bookings/create.py`

### 10a — Guards

```176:195:backend/app/features/bookings/create.py
    if client_user_id == vendor_user_id:
        raise ValueError(booking_messages.CANNOT_BOOK_OWN_VENDOR)

    if not _vendor_is_approved_for_explore(vendor_user_id):
        raise ValueError(booking_messages.VENDOR_NOT_AVAILABLE_FULL)

    assert_user_not_suspended(client_user_id)
    assert_user_not_suspended(vendor_user_id)

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date)

    payload = get_bookable_vendor_profile_form_data(vendor_user_id)
    if payload is None:
        raise ValueError(booking_messages.VENDOR_NOT_AVAILABLE_FULL)

    _enforce_max_bookings_per_day(vendor_user_id, payload, event_date, event_end_date)
```

### 10b — Snapshot line items (the key modeling idea)

```197:202:backend/app/features/bookings/create.py
    line_items = resolve_line_items(payload, selected_option_ids)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
    if float(pb.get("vendor_portion_gbp") or 0) <= 0 and not pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.BOOKING_NO_VALID_PRICE)
    client_total = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
```

**File:** `list_pricing.py` — `resolve_line_items`:

```229:262:backend/app/features/vendors/list_pricing.py
def resolve_line_items(
    payload: dict[str, Any],
    selected_option_ids: list[str],
) -> list[dict[str, Any]]:
    ...
    options = build_pricing_options(payload)
    by_id = {o.id: o for o in options}

    line_items: list[dict[str, Any]] = []
    for oid in unique_ids:
        opt = by_id.get(oid)
        if opt is None:
            raise ValueError(vendor_messages.PACKAGES_NO_LONGER_AVAILABLE)
        line_items.append(_option_to_line_item(opt))
```

Plain English: if the vendor later changes a package from £200 → £300, this enquiry still shows £200 in `line_items` JSON.

### 10c — Resolve celebration event (before insert)

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

**File:** `client_events/events.py` — link existing or create new:

```169:195:backend/app/features/client_events/events.py
    if event_id and event_id.strip():
        existing = get_client_event_by_id(client_user_id, event_id.strip())
        if existing is None:
            raise ValueError(client_event_messages.EVENT_NOT_FOUND)
        if str(existing.get("status") or "") == "archived":
            raise ValueError(client_event_messages.EVENT_ARCHIVED)
        ...
        return (str(existing["id"]), { "event_id": ..., "event_name": ..., ... })

    created = create_client_event(
        client_user_id,
        title=event_name,
        event_date=event_date,
        event_end_date=event_end_date,
        event_address=event_address,
        event_postcode=event_postcode,
    )
```

| `event_id` in payload | What happens |
|-------------------------|--------------|
| Set (linked celebration) | Validates event belongs to client and is not archived; uses event title/dates on the booking row |
| Omitted / null | Creates a new `client_events` row from the form fields |

Multi-vendor enquire reuses the `event_id` returned from the first successful POST for later vendors in the batch.

### 10d — Insert row

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

### 10e — Side effects after insert

**Notes → chat:**

```95:121:backend/app/features/bookings/create.py
    text = (notes or "").strip()
    ...
        if not _conversation_has_client_notes(
            conversation_id=cid,
            client_user_id=client_user_id,
            notes=text,
        ):
            insert_message(
                conversation_id=cid,
                sender_user_id=client_user_id,
                body=text,
                metadata={"source": "booking_notes", "booking_id": booking_id},
            )
```

**Vendor + client notifications + analytics** (after insert):

```249:307:backend/app/features/bookings/create.py
    if vendor_user_id:
        dispatch_booking_notification(
            user_id=vendor_user_id,
            booking_id=bid,
            kind="booking_request_received",
        )
        mark_vendor_notified(bid)
        record_marketplace_event("enquiry_created", ...)
        ...
    dispatch_booking_notification(
        user_id=client_user_id,
        booking_id=bid,
        kind="booking_request_sent",
        mode="insert_if_absent",
        portal="client",
    )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_user_id)
    touch_client_event_updated_at(resolved_event_id)
```

---

## Step 11 — Success UX

After POST succeeds, the modal shows a **success overlay** — redirect only happens when the client clicks **View booking**.

**File:** `VendorBookingModal.tsx`

```248:274:frontend/features/client/browse/VendorBookingModal.tsx
    <>
    <Modal
      isOpen={submitResult !== null}
      onClose={dismissResultModal}
      ...
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
        ) : (
          <Button variant="primary" onClick={dismissResultModal} className="w-full">
            Back to form
          </Button>
        )
      }
    >
```

**File:** `ClientVendorBrowseDetailView.tsx` — `onSuccess` closes modal, shows toast, redirects:

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

Flow: POST success → success modal → **View booking** → toast + `router.push(`/client/bookings/${bookingId}`)`.

Client lands on `/client/bookings/{bookingId}` — **Slice 3b** (detail, status, chat, pay later).

---

## Full chain (one picture)

```
Client ticks packages on profile sidebar
  ↓
Clicks "Request booking"
  ↓
guardBooking() → setBookingOpen(true) → VendorBookingModal mounts
  ↓
Client fills eventName, eventDate, venueAddress, notes
  (packages fixed from initialSelectedIds)
  ↓
Clicks "Send booking request"
  ↓
parseForm(clientBookingRequestSchema) — Zod validation
  ↓
calendarConflict check (soft block)
  ↓
postBookingRequest({ vendor_user_id, event_name, selected_option_ids, ... })
  → POST /api/v1/client/booking-requests (session cookie)
  ↓
post_booking_request() → require_client() → CreateBookingRequestBody
  ↓
create_booking_request()
  → resolve_line_items() — snapshot prices from vendor profile
  → resolve_event_for_booking() — link or create celebration
  → booking_requests.insert({ status: "pending", line_items, ... })
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
| `enquiry_created` | POST succeeds (per vendor) | `VendorBookingModal`, `MultiVendorEnquireModal` |
| `enquiry_failed` | POST throws | both modals |
| `multi_enquiry_created` | All vendors in batch succeed | `MultiVendorEnquireModal` |
| `enquiry_created` (backend) | Row inserted | `create.py` → `record_marketplace_event` |
| `enquiry_multi_created` (backend) | First item in multi batch | `create.py` when `batchSize > 1` |
| `vendor_notified` (backend) | Vendor notification dispatched | `create.py` |

---

## Multi-vendor enquire (browse grid)

**File:** `MarketplaceExploreView.tsx`

Signed-in clients can checkbox vendors → sticky bar → “Message N together” → `MultiVendorEnquireModal`.

```628:649:frontend/features/marketplace/MarketplaceExploreView.tsx
      {multiEnquireOpen && selectedCount > 0 ? (
        <MultiVendorEnquireModal
          vendors={selectedVendors}
          clientSearchContext={multiEnquireContext}
          ...
          onSuccess={(createdIds) => {
            setMultiEnquireOpen(false);
            clearSelection();
            showToast({ ... });
            router.push(
              createdIds.length === 1
                ? `/client/bookings/${createdIds[0]}`
                : "/client/bookings",
            );
          }}
        />
      ) : null}
```

**File:** `MultiVendorEnquireModal.tsx` — same form fields, sequential POST per vendor:

```154:177:frontend/features/marketplace/MultiVendorEnquireModal.tsx
      for (let i = 0; i < optionIdsByVendor.length; i += 1) {
        const { vendor, optionId } = optionIdsByVendor[i]!;
        try {
          const created = await postBookingRequest({
            vendor_user_id: vendor.user_id,
            event_name: parsed.data.eventName,
            event_date: parsed.data.eventDate,
            event_end_date: parsed.data.eventEndDate?.trim() || null,
            event_postcode: null,
            event_address: (parsed.data.venueAddress ?? "").trim() || null,
            notes: (parsed.data.notes ?? "").trim() || null,
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
```

- One shared event brief, one package per vendor
- **Sequential** `postBookingRequest` per vendor (not one bulk API)
- First successful response may return `event_id`; later calls reuse it
- **Partial failure:** if some POSTs fail, modal shows which vendors failed; toast reports “N of M sent”
- **Redirect:** 1 success → `/client/bookings/{id}`; 2+ successes → `/client/bookings` list

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
| Enquire blocked before modal | `useLaunchingSoonBookingGuard` / `BOOKINGS_LAUNCHING_SOON` |
| “Packages no longer available” | Vendor edited packages; client had stale IDs |
| “Event date cannot be in the past” | `CreateBookingRequestBody` validator |
| Calendar rejected | `calendar.py` — blocked dates / weekdays / capacity |
| Calendar blocked in modal only | `VendorBookingModal` `calendarConflict` (soft) vs server hard reject |
| “No valid price” | Quote-only packages with no TBC flag — `BOOKING_NO_VALID_PRICE` |
| Price looks wrong on UI but right on booking | UI estimate vs server `build_pricing_breakdown` |
| Notes missing in chat | `ensure_client_booking_notes_in_chat` in `create.py` |
| Vendor not notified | `dispatch_booking_notification` / email config |
| Multi-vendor partial send | `MultiVendorEnquireModal` failures array + toast |

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
- **client_search_context** — remembers browse filters for product analytics and alternative-vendor nudges.
- **Celebration events** — every enquire links to a `client_events` row (existing or newly created).
- **Two calendar layers** — modal soft warning + server hard reject.

---

## TL;DR

- **Enquire** = `POST /api/v1/client/booking-requests` from `VendorBookingModal` or `MultiVendorEnquireModal`.
- **Only clients** with a valid session; guests must sign in.
- **Form** collects event details; packages are fixed from profile selection.
- **Browser** sends `selected_option_ids` + event fields — never prices.
- **Server** copies package prices into `line_items`; inserts `pending` / `unpaid` row.
- **Success** = modal confirmation → View booking → toast + redirect.
- **Next:** Slice 3b — client booking detail page (`/client/bookings/[id]`).

---

## Related lessons

- Slice 1: `slice-1-auth-me.md`
- Slice 2: `slice-2-client-browse.md`, `slice-2-browse-flow-walkthrough.md`
- Slice 3b: `slice-3b-client-booking-detail.md`
