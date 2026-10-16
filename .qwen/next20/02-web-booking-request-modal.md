# Piece 02 — web: booking request modal and submit (MONEY: a reviewer checks this one)

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 01, which must be committed: it built `VendorProfileView` with a `bookingModal` slot.

## Goal
A signed-in client on `/client/browse/[userId]` presses "Request booking" and fills the baseline form. It posts `POST /api/v1/client/booking-requests`; on success the client lands on `/client/bookings/{bookingId}`.

## Money rule (the reason this piece is reviewed)
The request body carries **no price, total, fee or amount**. It is exactly `CreateBookingRequestBody` from schema.d.ts:
```
vendor_user_id        <- the page's vendorUserId
event_name            <- form, trimmed
event_date            <- form, ISO yyyy-mm-dd
event_end_date        <- form or null
event_postcode        <- always null (not collected here, same as the baseline)
event_address         <- venue address trimmed, or null
notes                 <- trimmed, or null
selected_option_ids   <- [...selectedIds]  (package/rate ids from the vendor payload)
quantities            <- bookingQuantitiesPayload(selectedIds, pricingOptions, quantities):
                         ONLY per_unit options, clamped to each option's minQuantity; undefined/null if none
client_search_context <- marketplace state from the URL (as the baseline builds it, incl. source: "browse")
event_id              <- linked client event id if the URL/planner supplied one, else null
vendor_referral_code  <- normalizeVendorReferralCode(input) or null
```
The api reprices the booking from `selected_option_ids` and `quantities`. "Estimated total" and the fee breakdown in the modal are display only.

## Baseline files (read once)
- `frontend/features/client/browse/VendorBookingModal.tsx` (616 lines)
- `frontend/features/client/browse/useVendorBookingSubmit.ts` (111) and its test `useVendorBookingSubmit.test.ts`
- `frontend/lib/bookingEnquireSubmit.ts`: `buildBookingRequestPayload`, lines 4-29
- `frontend/lib/clientBookingsApi.ts`: lines 26-41, the payload type
- `frontend/lib/validation/bookings.ts`, lines 26-36: `clientBookingRequestSchema`
- `frontend/lib/validation/common.ts`, from line 54: `eventDatesSchema`
- `frontend/lib/eventDateValidation.ts`
- `frontend/lib/vendorAvailability.ts` (ported in piece 01)
- `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx`: the success handler
- The event picker `useEnquireEventFormState`: find it with grep in frontend/. Port only what the modal needs to pick or link a client event. If that needs the planner or client-events endpoints, check that they exist in schema.d.ts.

## Validation: exact messages
- `eventName`: trim, at least 1 character, "Enter an event name."; at most 500.
- `notes`: at most 4000 (`CLIENT_BOOKING_NOTES_MAX_LENGTH`).
- `venueAddress`: at most 500.
- `selectedOptionIds`: at least 1, "Choose at least one package."
- `quantities`: integers from 1 to 100000.
- `eventDate`:
  - missing: "Choose an event date."
  - can't be parsed: "Choose a valid event date."
  - before today: "Event date cannot be in the past."
- `eventEndDate`, optional:
  - in the past: "End date cannot be in the past."
  - before the start: "End date must be on or after the event date."
- Before validation, if the dates conflict with the vendor's availability (`isoDatesInEventRange` + `vendorPayloadAllowsEventDates`), submit is blocked with: "These dates don't match this vendor's availability. Adjust the dates or message them to confirm."

Zod is available (it's in `web/package.json`): check that before using it. If it's missing, write plain validation functions with the same messages.

## Errors and success
- API error: show `PlatformError` detail text if present, otherwise "Request failed. Try again." The baseline doesn't branch on code here, so neither do you.
- Success: the modal shows the baseline success state, "Your booking request was sent to {vendorDisplayName}…" (copy it exactly), with a "View booking" button that does `router.push("/client/bookings/{bookingId}")`.
- The baseline also shows a toast, "Request sent" with "{businessName} will be notified. {usualReplyExpectation}". foundation/ui has no toast, so skip it and say so in your report.
- Double submit: the submit button is disabled and shows loading while the request is in flight.

## Where things go
- `web/src/domains/marketplace/bookingRequestValidation.ts` (+ test): the schema or plain validators with the messages above.
- `web/src/domains/marketplace/bookingRequestPayload.ts` (+ test): the pure `buildBookingRequestPayload(form, options)`. Name its argument type so it has no price fields.
- `web/src/domains/marketplace/api.ts`: add `createClientBookingRequest(body)`.
- `web/src/domains/marketplace/useVendorBookingSubmit.ts`: the hook.
- `web/src/domains/marketplace/VendorBookingModal.tsx`: build it on the existing foundation/ui primitives. If there is no Modal in foundation/ui, reuse the dialog markup pattern from `foundation/ui/ConfirmDialog`: a fixed overlay, `role="dialog"`, `aria-modal`, Escape closes, focus moves to the first field. Keep it in the domain; don't add a foundation Modal in this piece.
- `web/src/app/client/(portal)/browse/[userId]/page.tsx`: fill the `bookingModal` slot. Show it only for a signed-in client; guests see the register/login CTA from piece 01.

## Tests
Port the cases of `useVendorBookingSubmit.test.ts` (describe "client booking enquiry validation"), with these names:
- "blocks submit when calendar conflicts"
- "returns validation errors from zod"
- "builds a create payload when validation passes"

Add these, with literal expected objects:
- The payload has exactly the 12 keys above: assert `Object.keys(payload).sort()`.
- A fixed-price option sends no `quantities` entry.
- A per-unit option below its minimum is clamped to the minimum.
- Each date message above appears for its input. For "before today", use a fixed "today" parameter so the test doesn't depend on the clock.

## Allowed paths
- `web/src/domains/marketplace/**`
- `web/src/app/client/(portal)/browse/**`

## Browser check
If the servers are up:
1. As an @example.com client, submit a request to a local test vendor.
2. Check that it lands on the booking detail page.
3. In DevTools, confirm that the request body has no price fields.

## Commit
`web: client booking request modal (ws14 piece 12b)`
