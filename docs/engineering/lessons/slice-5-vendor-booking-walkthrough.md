# Slice 5 — Vendor booking walkthrough (thorough)

Trace **vendor accept on a client enquiry** and a **quote-from-chat** path. Read this when `slice-5-vendor-booking.md` feels too high-level.

**Status PATCH:** `PATCH /api/v1/vendor/booking-requests/{id}/status`  
**Adjustments PUT:** `PUT /api/v1/vendor/booking-requests/{id}/adjustments`  
**Vendor quote POST:** `POST /api/v1/vendor/booking-requests/vendor-quote`  
**Orchestrators:** `update_booking_request_status_for_vendor` (`status_vendor.py`), `put_vendor_booking_adjustments`, `create_vendor_quote_booking_request`

---

## 0. Mental model

```
┌──────────────────────────────────────────────────────────────┐
│  Path A — client enquiry (initiator=client, pending)         │
│  VendorBookingsView → VendorBookingResponseFlow              │
│  accept / decline / PUT adjustments                          │
└────────────────────────────┬─────────────────────────────────┘
                             │ PATCH status or PUT adjustments
┌────────────────────────────▼─────────────────────────────────┐
│  status_vendor.py / adjustments.py                           │
│  payout gate on accept · notify client · SSE                 │
└────────────────────────────┬─────────────────────────────────┘
                             │ accepted → client pays (Slice 4)

┌──────────────────────────────────────────────────────────────┐
│  Path B — vendor quote from chat (initiator=vendor)          │
│  ChatThreadView → VendorQuoteFormModal → POST vendor-quote   │
└────────────────────────────┬─────────────────────────────────┘
                             │ create_vendor_quote_booking_request
┌────────────────────────────▼─────────────────────────────────┐
│  pending row · client accepts in Slice 3b                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Path A — Vendor accepts client enquiry

### Scenario

- Booking `br-enq-99` created in Slice 3a
- `status: pending`, `payment_status: unpaid`, `initiator: client`
- Line items snapshot £400 vendor portion → ~£450 client total with fee
- Vendor has Stripe Connect complete

---

### Step 1 — Open vendor bookings

**URL:** `/vendor/bookings/br-enq-99`

**File:** `VendorBookingsView.tsx`

```97:104:frontend/features/vendor/bookings/VendorBookingsView.tsx
              <BookingDetailPanel
                booking={controller.viewModel}
                loading={controller.detailLoading || (controller.listLoading && !selectedBookingId)}
                error={controller.detailError}
                actionError={controller.actionError}
                headerActions={controller.headerActions}
                footerActions={controller.footerActions}
```

`useVendorBookingsController` fetches detail via `fetchVendorBookingDetail(id)`.

---

### Step 2 — Response flow visible

Condition:

```215:216:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const showClientResponseFlow =
    detail?.booking_status === "pending" && detail.initiator !== "vendor";
```

`VendorBookingResponseFlow` mounted in `footerSection` slot:

```114:125:frontend/features/vendor/bookings/VendorBookingsView.tsx
                  footerSection: controller.showClientResponseFlow && controller.detail ? (
                    <VendorBookingResponseFlow
                      key={`${controller.detail.booking_request_id}-${controller.detail.vendor_adjustments.length}`}
                      detail={controller.detail}
                      actionBusy={controller.actionBusy}
                      adjustmentSaving={controller.adjustmentSaving}
                      onAcceptAtListedPrice={() => controller.requestAccept()}
                      onDecline={() => void controller.applyBookingStatus("declined")}
                      onSendUpdatedPrice={(rows) => void controller.sendUpdatedPrice(rows)}
```

Shows: "Their estimate: £450 (incl. Eventtz fee)".

---

### Step 3 — Payout check on accept click

Vendor clicks **Accept booking** → `requestDecision("accept")` → confirm dialog → `onAcceptAtListedPrice()` → `requestAccept()`.

```105:113:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const requestAccept = () => {
    if (payoutsLoading) return;
    if (!payoutsReady) {
      setPayoutModalOpen(true);
      return;
    }
    void updateVendorBookingStatus("accepted");
  };
```

If `useVendorPayoutsReady` returns `charges_enabled && payouts_enabled` → proceed.

Otherwise `PayoutSetupRequiredModal` → `connectPayouts('/vendor/bookings/br-enq-99')` → Stripe onboarding → `useVendorPayoutAcceptResume` retries accept.

---

### Step 4 — PATCH accept

**File:** `useVendorBookingActions.ts`

```77:78:frontend/features/vendor/bookings/useVendorBookingActions.ts
            await patchVendorBookingStatus(id, next);
            clearPendingAcceptBookingId();
```

### HTTP

```http
PATCH /api/v1/vendor/booking-requests/br-enq-99/status
Cookie: eventtz_access_token=...

{ "booking_status": "accepted" }
```

**File:** `vendor.py` → `update_booking_request_status_for_vendor`

Checks (in order):
1. Row exists for this vendor
2. `new_status === "accepted"`
3. `initiator !== "vendor"` (client enquiry)
4. `vendor_connect_can_receive_payouts(vendor_user_id)`
5. `current === "pending"`
6. `!client_price_confirmation_required(row)` — no unconfirmed adjustments
7. Conditional update `status: pending` → `accepted` via `apply_accept_update`

```145:159:backend/app/features/bookings/status_vendor.py
            if client_uid:
                _notify_client_booking_accepted(client_uid, booking_id)
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            ...
            return {"id": booking_id, "status": "accepted"}
```

### DB after accept

| Column | Value |
|--------|-------|
| `status` | `accepted` |
| `payment_status` | `unpaid` |
| `accepted_at` | set by `apply_accept_update` |

Client receives `booking_accepted` notification. Client detail shows payment due (Slice 4).

---

### Step 5 — Decline branch (alternative)

If vendor clicks **Can't take this one**:

```http
PATCH /api/v1/vendor/booking-requests/br-enq-99/status
{ "booking_status": "declined" }
```

`status_vendor.py` — only `pending` client enquiries; `apply_decline_update`; notify `booking_declined_by_vendor`.

---

### Step 6 — Suggest different price (alternative)

Vendor clicks **Suggest a different price** → `VendorBookingResponseAdjustments`.

Example: +£50 travel surcharge.

Vendor enters amount `50`, reason `Travel to venue`.

`saveVendorPriceAdjustments` →:

```http
PUT /api/v1/vendor/booking-requests/br-enq-99/adjustments
{
  "adjustments": [
    {
      "adjustment_category": "other",
      "label": "Travel to venue",
      "amount_gbp": 50
    }
  ]
}
```

**File:** `adjustments.py`

1. Reject if `initiator === "vendor"`
2. Validate caps (`booking_max_adjustment_gbp`, percent of subtotal)
3. Rebuild pricing → update `vendor_adjustments`, `total_label`
4. Notify client `booking_pricing_updated`

UI returns to **Waiting for them to accept your new price**.

Vendor **cannot** accept until client confirms (Slice 3b `BookingPriceUpdateBanner`). Backend:

```131:134:backend/app/features/bookings/status_vendor.py
            if client_price_confirmation_required(row0):
                raise ValueError(
                    booking_messages.CLIENT_MUST_CONFIRM_PRICE,
                )
```

After client accepts price → vendor can **Accept booking** (Steps 3–4).

---

## Path B — Vendor quote from chat

### Scenario

- Vendor chatting with client in `/vendor/chat/{conversationId}`
- No booking row yet for this quote
- Vendor sends custom £1,200 package

---

### Step 1 — Open quote drawer

**File:** `ChatThreadView.tsx`

```272:281:frontend/features/chat/ChatThreadView.tsx
        {portal === "vendor" && conv && !isSupport ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText className="h-4 w-4" aria-hidden />}
            onClick={() => setQuoteOpen(true)}
            className="w-full shrink-0 sm:w-auto"
          >
            Send quote
          </Button>
        ) : null}
```

---

### Step 2 — Fill `VendorQuoteFormModal`

Fields:
- Event name, dates
- Package picker from onboarding profile OR custom heading + price
- Optional notes

Validation: `vendorQuoteSchema` (Zod).

---

### Step 3 — POST vendor quote

```165:179:frontend/features/vendor/quotes/VendorQuoteFormModal.tsx
          const posted = await postVendorQuote({
            client_user_id: clientUserId,
            conversation_id: conversationId,
            event_name: name,
            event_date: ed.slice(0, 10),
            event_end_date: end?.trim() ? end.slice(0, 10) : null,
            notes: noteText || null,
            line_items: [
              {
                id,
                heading: packageName,
                unit_price_gbp: p,
              },
            ],
          });
```

### HTTP

```http
POST /api/v1/vendor/booking-requests/vendor-quote
Cookie: eventtz_access_token=...

{
  "client_user_id": "client-uuid",
  "conversation_id": "conv-uuid",
  "event_name": "Sarah & James - wedding",
  "event_date": "2026-10-15",
  "event_end_date": null,
  "notes": "8 hours coverage",
  "line_items": [
    { "id": "li-...", "heading": "Gold wedding package", "unit_price_gbp": 1200 }
  ]
}
```

---

### Step 4 — `create_vendor_quote_booking_request`

**File:** `create.py`

Guards:
- Not self-quote
- Vendor approved for explore
- Client exists, not suspended
- Conversation matches pair (if provided)
- Calendar + capacity
- `validate_quote_line_items` — priced lines, total > 0

Insert:

```387:401:backend/app/features/bookings/create.py
    row_out: dict[str, Any] = {
        ...
        "status": "pending",
        "selected_option_ids": [],
        "line_items": line_items,
        "initiator": "vendor",
        ...
    }
```

Side effects:
- `dispatch_booking_notification` → `vendor_quote_received`
- `send_quote_message` in chat thread
- `_notify_booking_changed`

Response:

```json
{
  "success": true,
  "booking_request_id": "br-quote-new",
  "booking_status": "pending"
}
```

Modal closes → `router.push(/vendor/bookings/br-quote-new)`.

---

### Step 5 — Vendor sees "Your quote" row

List row badge from view model:

```14:14:frontend/features/vendor/bookings/vendorBookingViewModel.ts
    initiatorBadgeLabel: row.initiator === "vendor" ? "Your quote" : null,
```

**No** `VendorBookingResponseFlow` (vendor does not accept own quote).

Header action **Withdraw quote**:

```143:152:frontend/features/vendor/bookings/useVendorBookingsController.ts
  if (detail?.booking_status === "pending" && detail.initiator === "vendor") {
    headerActions.push({
      key: "withdraw",
      label: "Withdraw quote",
      ...
    });
```

Withdraw → `PATCH { booking_status: "cancelled" }` → `vendor_quote_withdrawn` notification.

---

### Step 6 — Client accepts quote (Slice 3b)

On client portal: **Accept quote** / **Decline** header actions when `initiator === "vendor"` && `pending`.

Client `PATCH accepted` → same `accepted` row state → Slice 4 payment.

Vendor cannot `PATCH accepted` on own quote — `CLIENT_MUST_ACCEPT_QUOTE`.

---

## Withdraw vs cancel vs decline

| Action | UI label | API | When |
|--------|----------|-----|------|
| Decline | Can't take this one | `declined` | Client enquiry, pending |
| Withdraw | Withdraw quote | `cancelled` | Vendor quote, pending |
| Cancel booking | Cancel booking | `cancelled` | Accepted (refund rules) |

Backend enforces:

```180:181:backend/app/features/bookings/status_vendor.py
        if initiator == "vendor":
            raise ValueError(booking_messages.WITHDRAW_QUOTE_USE_CANCEL)
```

for decline on vendor quotes.

---

## Function call order — accept enquiry

```
Vendor opens /vendor/bookings/{id}
  useVendorBookingsController
    useParticipantBookingsScaffold → fetchVendorBookingDetail
    useVendorPayoutsReady → GET /vendor/payments/status
  VendorBookingResponseFlow
    Accept click → requestDecision → ConfirmDialog
    onAcceptAtListedPrice → requestAccept
      [if !payoutsReady] PayoutSetupRequiredModal
      updateVendorBookingStatus("accepted")
        patchVendorBookingStatus
          PATCH /vendor/booking-requests/{id}/status
            update_booking_request_status_for_vendor (status_vendor.py)
              vendor_connect_can_receive_payouts
              apply_accept_update
              notify client booking_accepted
              SSE _notify_booking_changed
    reloadBookingDetail
```

---

## Function call order — chat quote

```
ChatThreadView Send quote
  VendorQuoteFormModal.submit
    postVendorQuote
      POST /vendor/booking-requests/vendor-quote
        create_vendor_quote_booking_request (create.py)
          validate_quote_line_items
          booking_requests.insert (initiator=vendor)
          notify + send_quote_message
    router.push(/vendor/bookings/{newId})
```

---

## Debugging

| Symptom | Check |
|---------|--------|
| No response flow | `initiator` must be `client`, `status` `pending` |
| Accept opens payout modal | `useVendorPayoutsReady` — finish Connect onboarding |
| Accept 400 "confirm price" | Client has not accepted `vendor_adjustments` |
| PUT adjustments 400 | Vendor quote row — adjustments only on client enquiries |
| Quote 400 calendar | `create.py` `_enforce_vendor_calendar` |
| Withdraw missing | `initiator === "vendor"` required |
| Client can't see quote | Notification + chat `send_quote_message` |

---

## Related

- `slice-5-vendor-booking.md` — full route list + concepts
- Slice 3b — client accept quote / confirm adjusted price
- Slice 4 — payment after `accepted`
