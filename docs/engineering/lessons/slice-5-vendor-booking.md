# Slice 5 — Vendor booking lifecycle

**Walkthrough:** `slice-5-vendor-booking-walkthrough.md` — traces vendor accept on a client enquiry + quote-from-chat path.

### User story

A **signed-in vendor** manages booking requests in `/vendor/bookings`: accepts or declines client enquiries, suggests price adjustments, sends custom quotes from chat, and withdraws their own quotes. **Accept** requires Stripe Connect payout setup (`useVendorPayoutsReady`). After accept, the client can pay (Slice 4).

**Initiator flips who acts while `pending`:** client enquiries (`initiator: client`) → vendor accepts/declines/adjusts; vendor quotes (`initiator: vendor`) → client accepts/declines (Slice 3b).

---

## What vendor booking management does

```typescript
await patchVendorBookingStatus(bookingId, "accepted");
```

| Piece | Role |
|--------|------|
| `VendorBookingsView` | Master-detail portal UI |
| `useVendorBookingsController` | List/detail state, payout gate, action wiring |
| `vendorBookingViewModel` | Maps API rows → shared `BookingDetailViewModel` |
| `VendorBookingResponseFlow` | Accept / decline / suggest price for client enquiries |
| `VendorBookingResponseAdjustments` | Adjustment form UI |
| `vendorBookingResponseHelpers` | Draft rows, preview totals, validation helpers |
| `useVendorBookingActions` | PATCH status, PUT adjustments, withdraw, cancel |
| `useVendorPayoutsReady` | Connect readiness gate before accept |
| `VendorQuoteFormModal` | Send quote from chat thread |
| `create_vendor_quote_booking_request` | Backend insert for vendor-initiated quotes |
| `update_booking_request_status_for_vendor` | Vendor status transitions (`status_vendor.py`) |
| `put_vendor_booking_adjustments` | Vendor price updates while pending |

Plain English: the vendor opens their bookings inbox, picks a request, and either accepts at the listed price, declines, or sends an updated price. Accept is blocked until Stripe payouts are configured. Quotes sent from chat create a new `pending` row with `initiator: vendor`.

---

## What happens at a glance

```
Vendor opens /vendor/bookings or /vendor/bookings/{id}
    → useVendorBookingsController
        → useParticipantBookingsScaffold (list + detail fetch)
        → useVendorPayoutsReady (Connect status)
    → Client enquiry (initiator=client, pending)
        → VendorBookingResponseFlow
            → Accept → payout gate → PATCH status=accepted
            → Decline → PATCH status=declined
            → Suggest price → PUT adjustments → client confirms (Slice 3b)
    → Vendor quote (initiator=vendor, pending)
        → header: Withdraw quote → PATCH status=cancelled
        → client Accept/Decline on their portal (Slice 3b)
    → From chat: Send quote
        → VendorQuoteFormModal → POST /vendor/booking-requests/vendor-quote
            → create_vendor_quote_booking_request()
                → insert pending, initiator=vendor, line_items from quote
                → notify client + chat quote message
```

---

## Example: vendor accepts client enquiry

1. Client sent enquiry in Slice 3a — booking `br-v-001` is `pending` / `unpaid`, `initiator: client`.
2. Vendor opens `/vendor/bookings/br-v-001`.
3. `VendorBookingResponseFlow` shows "Their estimate: £450".
4. Vendor clicks **Accept booking** → unread chat gate (if messages) → confirm dialog.
5. `useVendorPayoutsReady` — if not ready, `PayoutSetupRequiredModal` opens instead of PATCH.
6. If ready: `PATCH .../status` `{ booking_status: "accepted" }`.
7. `update_booking_request_status_for_vendor` updates row, notifies client.
8. Client detail shows payment due banner (Slice 4).

---

## Complete route — vendor bookings portal

### Frontend

1. `frontend/app/vendor/(portal)/bookings/page.tsx` — list
2. `frontend/app/vendor/(portal)/bookings/[bookingId]/page.tsx` — detail deep link
3. `frontend/features/vendor/bookings/VendorBookingsView.tsx` — main view
4. `frontend/features/vendor/bookings/useVendorBookingsController.ts` — controller hook
5. `frontend/features/vendor/bookings/vendorBookingViewModel.ts` — row/detail view models
6. `frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx` — pending client enquiry UI
7. `frontend/features/vendor/bookings/VendorBookingResponseAdjustments.tsx` — adjustment editor
8. `frontend/features/vendor/bookings/vendorBookingResponseHelpers.ts` — pricing preview helpers
9. `frontend/features/vendor/bookings/useVendorBookingActions.ts` — mutations
10. `frontend/features/vendor/bookings/VendorBookingDetailExtras.tsx` — completion banners
11. `frontend/features/bookings/useParticipantBookingsScaffold.ts` — shared list/detail loading
12. `frontend/features/vendor/payments/useVendorPayoutsReady.ts` — payout gate
13. `frontend/features/vendor/payments/PayoutSetupRequiredModal.tsx` — blocked accept UX
14. `frontend/features/vendor/bookings/useVendorPayoutAcceptResume.ts` — resume accept after Connect onboarding
15. `frontend/lib/vendorBookingsApi.ts` — vendor booking HTTP

### Vendor quote from chat

16. `frontend/features/chat/ChatThreadView.tsx` — "Send quote" button
17. `frontend/features/vendor/quotes/VendorQuoteFormModal.tsx` — quote drawer form

### Backend

18. `backend/app/features/bookings/http/vendor.py` — vendor routes
19. `backend/app/contracts/booking.py` — quote body, status patch, adjustments
20. `backend/app/features/bookings/create.py` — `create_vendor_quote_booking_request`
21. `backend/app/features/bookings/status_vendor.py` — `update_booking_request_status_for_vendor`
22. `backend/app/features/bookings/adjustments.py` — `put_vendor_booking_adjustments`
23. `backend/app/features/bookings/pricing_confirmation.py` — `client_price_confirmation_required`

---

## `initiator` and who can act

| `initiator` | `status` | Vendor can | Client can (Slice 3b) |
|-------------|----------|------------|------------------------|
| `client` | `pending` | Accept, decline, adjust price | Cancel enquiry |
| `client` | `pending` + adjustments | Wait (flow shows "waiting for client") | Accept/decline new price |
| `client` | `accepted` | Cancel booking (refund rules apply) | Pay (Slice 4) |
| `vendor` | `pending` | Withdraw quote (`cancelled`) | Accept/decline quote |
| `vendor` | `accepted` | Cancel, confirm completion | Pay, confirm completion |

Backend enforces initiator rules in `status_vendor.py` — e.g. vendor cannot `accept` their own quote:

```125:127:backend/app/features/bookings/status_vendor.py
    if new_status == "accepted":
        if initiator == "vendor":
            raise ValueError(booking_messages.CLIENT_MUST_ACCEPT_QUOTE)
```

---

## Step 1 — Portal shell and list

**File:** `VendorBookingsView.tsx`

Composes:
- `PayoutSetupRequiredModal`
- `ConfirmDialog` for withdraw / cancel / complete
- `ChatDrawer` for messaging
- `MasterDetailLayout` with `BookingListPanel` + `BookingDetailPanel`

```22:23:frontend/features/vendor/bookings/VendorBookingsView.tsx
export function VendorBookingsView({ selectedBookingId }: VendorBookingsViewProps) {
  const controller = useVendorBookingsController({ selectedBookingId });
```

**File:** `useVendorBookingsController.ts` — scaffold + payouts:

```43:63:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const {
    tab,
    setTab,
    list,
    ...
  } = useParticipantBookingsScaffold({
    selectedBookingId,
    fetchList,
    fetchDetail,
    getDetailStatus,
  });
```

```78:86:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const {
    payoutsReady,
    loading: payoutsLoading,
    connecting: connectingPayouts,
    error: payoutConnectError,
    ...
    connectPayouts,
  } = useVendorPayoutsReady(true);
```

List rows get a warning badge when payouts not ready:

```128:136:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const rows = useMemo(() => {
    const mapped = list.map(toVendorBookingRowViewModel);
    if (payoutsReady || payoutsLoading) return mapped;
    return mapped.map((row) =>
      row.status === "pending"
        ? { ...row, warningBadge: "Payout setup required before accepting bookings." }
        : row,
    );
  }, [list, payoutsReady, payoutsLoading]);
```

---

## Step 2 — View model mapping

**File:** `vendorBookingViewModel.ts` — thin adapter over shared booking view models:

```11:19:frontend/features/vendor/bookings/vendorBookingViewModel.ts
export function toVendorBookingRowViewModel(row: VendorBookingListItem): BookingListRowViewModel {
  return toBookingListRowViewModel(row, {
    counterpartyLine: row.client_display_name ?? row.client_email ?? "Client",
    initiatorBadgeLabel: row.initiator === "vendor" ? "Your quote" : null,
    reviewLine: row.review
      ? `${row.review.rating}/5 - ${row.review.reviewer_display}`
      : null,
    portal: "vendor",
  });
}
```

```22:32:frontend/features/vendor/bookings/vendorBookingViewModel.ts
export function toVendorBookingDetailViewModel(
  detail: VendorBookingDetail,
  onOpenChat: () => void,
): BookingDetailViewModel {
  return toBookingDetailViewModel(detail, {
    role: "vendor",
    counterpartyRoleLabel: "Client",
    counterpartyName: detail.client_display_name ?? detail.client_email ?? "Client",
    notesLabel: "Notes from client",
    onOpenChat,
  });
}
```

---

## Step 3 — Payout gate before accept

**File:** `useVendorPayoutsReady.ts`

```12:14:frontend/features/vendor/payments/useVendorPayoutsReady.ts
export function isVendorPayoutsReady(status: VendorPaymentsStatus | null | undefined): boolean {
  return Boolean(status?.charges_enabled && status?.payouts_enabled);
}
```

**File:** `useVendorBookingsController.ts` — `requestAccept`:

```105:113:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const requestAccept = useCallback(() => {
    if (!detail?.booking_request_id) return;
    if (payoutsLoading) return;
    if (!payoutsReady) {
      setPayoutModalOpen(true);
      return;
    }
    void updateVendorBookingStatus("accepted");
  }, [detail?.booking_request_id, payoutsLoading, payoutsReady, updateVendorBookingStatus]);
```

If blocked, vendor completes Connect onboarding:

```115:119:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const onCompletePayoutSetup = useCallback(() => {
    if (!detail?.booking_request_id) return;
    setPendingAcceptBookingId(detail.booking_request_id);
    void connectPayouts(`/vendor/bookings/${detail.booking_request_id}`);
  }, [detail?.booking_request_id, connectPayouts]);
```

`useVendorPayoutAcceptResume` auto-retries accept when returning from Stripe onboarding.

Backend mirror — accept rejected without Connect:

```128:129:backend/app/features/bookings/status_vendor.py
        if not vendor_connect_can_receive_payouts(vendor_user_id):
            raise ValueError(booking_messages.COMPLETE_PAYOUT_SETUP)
```

---

## Step 4 — `VendorBookingResponseFlow` (client enquiry)

Shown when `pending` + `initiator !== "vendor"`:

```215:216:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const showClientResponseFlow =
    detail?.booking_status === "pending" && detail.initiator !== "vendor";
```

**Review step** — accept, suggest price, or decline:

```137:171:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Their estimate:{" "}
          <span className="font-semibold text-neutral-900">{friendlyTotal}</span>
          <span className="text-neutral-500"> (incl. Eventtz fee)</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button ... onClick={() => void requestDecision("accept")}>
            Accept booking
          </Button>
          <Button ... onClick={() => openAdjust([])}>
            Suggest a different price
          </Button>
        </div>
        ...
          <button ... onClick={() => void requestDecision("decline")}>
            Can&apos;t take this one
          </button>
```

**Unread gate** — forces vendor to read chat before accept/decline:

```63:84:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
  const requestDecision = async (kind: PendingDecision) => {
    ...
      const conversationId = detail.conversation_id?.trim();
      if (conversationId) {
        const conv = await fetchConversation(conversationId);
        if ((conv.unread_count ?? 0) > 0) {
          setPendingDecision(kind);
          setUnreadGateOpen(true);
          return;
        }
      } else if ((detail.notes ?? "").trim()) {
        setPendingDecision(kind);
        setUnreadGateOpen(true);
        return;
      }
```

**Waiting for client** — after adjustments saved:

```91:108:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
  if (waitingForClient && step !== "adjust") {
    ...
        <p className="text-sm text-neutral-600">
          Waiting for them to accept your new price ({currentTotal}).
        </p>
        <button ... onClick={() => openAdjust(draftsFromDetail(detail))}>
          Edit price
        </button>
```

---

## Step 5 — Price adjustments

**File:** `VendorBookingResponseAdjustments.tsx` — cost/discount lines with live preview via `previewClientTotalLabel`.

**File:** `vendorBookingResponseHelpers.ts` — draft model:

```63:81:frontend/features/vendor/bookings/vendorBookingResponseHelpers.ts
export function applyDraftLine(
  lines: AdjustmentDraftRow[],
  kind: AdjustmentKind,
  rawAmount: string,
  reason: string,
): AdjustmentDraftRow[] {
  const tag = kind === "discount" ? "discount" : "other";
  const without = lines.filter((l) => adjustmentLineKey(l) !== `${kind}:${tag}`);
  const numeric = Number.parseFloat(rawAmount.replace(/^-/, "").trim());
  if (!rawAmount.trim() || !Number.isFinite(numeric) || numeric <= 0) return without;
  return [
    ...without,
    {
      kind,
      tag,
      label: kind === "discount" ? "Discount" : reason.trim() || "",
      amount: String(numeric),
    },
  ];
}
```

**File:** `useVendorBookingActions.ts` — `saveVendorPriceAdjustments`:

```229:241:frontend/features/vendor/bookings/useVendorBookingActions.ts
          const next = await putVendorBookingAdjustments(detail.booking_request_id, parsed);
          track(MixpanelEvents.vendor_booking_price_updated, {
            booking_id: detail.booking_request_id,
            line_count: parsed.length,
          });
          return next;
        ...
    if (updated) setDetail(updated);
```

**Backend** — `adjustments.py`:

```58:81:backend/app/features/bookings/adjustments.py
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

Caps enforced via `booking_max_adjustment_gbp` and `booking_max_adjustment_pct_of_subtotal`. Client must confirm new price before vendor can accept (`client_price_confirmation_required` in `status_vendor.py`).

---

## Step 6 — Vendor status transitions (`status_vendor.py`)

**Note:** Vendor status logic lives in **`status_vendor.py`**, not `status.py` (client transitions).

**Accept** client enquiry (`pending` → `accepted`):

```130:159:backend/app/features/bookings/status_vendor.py
        if current == "pending":
            if client_price_confirmation_required(row0):
                raise ValueError(
                    booking_messages.CLIENT_MUST_CONFIRM_PRICE,
                )
            upd = (
                client.table("booking_requests")
                .update(apply_accept_update(booking_id, created_at=row0.get("created_at")))
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            ...
            return {"id": booking_id, "status": "accepted"}
```

**Decline** (`pending` → `declined`):

```179:217:backend/app/features/bookings/status_vendor.py
    if new_status == "declined":
        if initiator == "vendor":
            raise ValueError(booking_messages.WITHDRAW_QUOTE_USE_CANCEL)
        if current != "pending":
            raise ValueError(booking_messages.ONLY_PENDING_CAN_DECLINE)
        upd = (
            client.table("booking_requests")
            .update(apply_decline_update(booking_id, created_at=row0.get("created_at")))
            ...
```

**Withdraw vendor quote** (`pending` + `initiator=vendor` → `cancelled`):

```98:120:backend/app/features/bookings/status_vendor.py
        if current == "pending" and initiator == "vendor":
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled", **cancel_audit_fields("vendor")})
                ...
            if client_uid:
                dispatch_booking_notification(
                    user_id=client_uid,
                    booking_id=booking_id,
                    kind="vendor_quote_withdrawn",
                    ...
                )
```

**Cancel accepted booking** — refunds if paid, expires checkout if pending payment:

```59:67:backend/app/features/bookings/status_vendor.py
    if new_status == "cancelled":
        if current == "accepted":
            assert_booking_may_be_cancelled(booking_id, status=current, payment_status=payment_status)
            expire_pending_checkout_session(payment_status, row0.get("stripe_checkout_session_id"))
            refunded = refund_paid_booking_before_cancel(
                booking_id,
                payment_status,
                cancelled_by="vendor",
            )
```

---

## Step 7 — Vendor quote from chat

**File:** `ChatThreadView.tsx` — vendor-only button:

```272:293:frontend/features/chat/ChatThreadView.tsx
        {portal === "vendor" && conv && !isSupport ? (
          <Button ... onClick={() => setQuoteOpen(true)}>
            Send quote
          </Button>
        ) : null}
      ...
        <VendorQuoteFormModal
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          conversationId={conversationId}
          clientUserId={conv.client_user_id}
          quotePrefill={quotePrefill ?? undefined}
        />
```

**File:** `VendorQuoteFormModal.tsx` — submit builds one line item:

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

Success → `router.push(/vendor/bookings/{id})`.

**Backend** — `create_vendor_quote_booking_request` in `create.py`:

```387:401:backend/app/features/bookings/create.py
    row_out: dict[str, Any] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": event_name.strip(),
        ...
        "status": "pending",
        "selected_option_ids": [],
        "line_items": line_items,
        "total_label": persisted_booking_total_label(pb),
        "initial_client_total_label": str(pb.get("client_total_label") or persisted_booking_total_label(pb)),
        "vendor_adjustments": [],
        "initiator": "vendor",
        ...
    }
```

After insert: client notification `vendor_quote_received` + `send_quote_message` in chat.

HTTP route:

```57:58:backend/app/features/bookings/http/vendor.py
@router.post("/booking-requests/vendor-quote", response_model=BookingRequestCreated)
def post_vendor_quote(
```

---

## Step 8 — Header/footer actions

**Withdraw quote** — vendor-initiated pending:

```143:152:frontend/features/vendor/bookings/useVendorBookingsController.ts
  if (detail?.booking_status === "pending" && detail.initiator === "vendor") {
    headerActions.push({
      key: "withdraw",
      label: "Withdraw quote",
      ...
      onClick: () => setConfirmAction("withdraw"),
    });
```

**Re-accept declined client enquiry** (edge case):

```153:163:frontend/features/vendor/bookings/useVendorBookingsController.ts
  } else if (detail?.booking_status === "declined" && detail.initiator !== "vendor") {
    headerActions.push({
      key: "accept",
      label: "Accept booking",
      ...
      onClick: () => requestAccept(),
    });
```

**Cancel accepted booking:**

```169:178:frontend/features/vendor/bookings/useVendorBookingsController.ts
  if (detail?.booking_status === "accepted" && !cancelBlocked) {
    footerActions.push({
      key: "vendor_cancel",
      label: "Cancel booking",
      ...
      onClick: () => setConfirmAction("vendor_cancel"),
    });
```

Cancel copy varies by `payment_status` (`paid`, `pending`, unpaid).

---

## Parameter map — vendor actions

| UI action | Frontend API | Backend handler | Result `status` |
|-----------|--------------|-----------------|-----------------|
| Accept booking | `PATCH .../status` `{ accepted }` | `update_booking_request_status_for_vendor` | `accepted` |
| Decline | `PATCH .../status` `{ declined }` | same | `declined` |
| Withdraw quote | `PATCH .../status` `{ cancelled }` | same (vendor quote branch) | `cancelled` |
| Cancel accepted | `PATCH .../status` `{ cancelled }` | same (accepted branch + refund) | `cancelled` |
| Suggest price | `PUT .../adjustments` | `put_vendor_booking_adjustments` | `pending` (price updated) |
| Send quote (chat) | `POST .../vendor-quote` | `create_vendor_quote_booking_request` | new row `pending` |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Vendor portal | `require_vendor` on all `/vendor/booking-requests/*` routes |
| Quote from chat | Vendor session + conversation pair validation in `create_vendor_quote_booking_request` |
| Accept | Payout Connect ready (frontend + `vendor_connect_can_receive_payouts`) |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `vendor_booking_accepted` | Accept PATCH succeeds |
| `vendor_booking_declined` | Decline PATCH succeeds |
| `vendor_booking_price_updated` | Adjustments PUT succeeds |
| `vendor_quote_sent` | Chat quote POST succeeds |
| `vendor_quote_withdrawn` | Withdraw PATCH succeeds |
| `vendor_payout_setup_started` | Connect onboarding from bookings |
| `vendor_accepted_booking` | Backend analytics on accept |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Accept does nothing | `useVendorPayoutsReady` / `PayoutSetupRequiredModal` |
| "Complete payout setup" API error | `status_vendor.py` + Connect status |
| "Client must confirm price" | Pending adjustments — client Slice 3b banner |
| Cannot adjust vendor quote | `ADJUSTMENTS_NOT_ON_VENDOR_QUOTE` in `adjustments.py` |
| Withdraw not shown | Check `initiator === "vendor"` + `pending` |
| Response flow missing | `showClientResponseFlow` — need client initiator |
| Quote not in chat | `send_quote_message` in `create.py` |
| Decline on own quote | Use withdraw (`WITHDRAW_QUOTE_USE_CANCEL`) |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Payout gate on accept (not on decline) | **Leave it alone** — client pay needs payout path |
| Unread chat gate before respond | **Leave it alone** — reduces blind accepts |
| `status_vendor.py` split from client status | **Leave it alone** — clearer transition rules |
| Adjustments only on client enquiries | **Leave it alone** — quotes are already custom priced |

---

## Key concepts from this slice

- **`initiator`** — `client` vs `vendor` determines who accepts while `pending`.
- **Payout gate** — `useVendorPayoutsReady` + backend `COMPLETE_PAYOUT_SETUP`.
- **Adjustments** — vendor edits `vendor_adjustments`; client confirms in Slice 3b before vendor accept.
- **Vendor quote path** — `create_vendor_quote_booking_request`, not `create_booking_request`.
- **`status_vendor.py`** — all vendor-driven `status` transitions (not `status.py`).
- **Withdraw vs decline** — vendor quotes use `cancelled` (withdraw), client enquiries use `declined`.

---

## TL;DR

- **Vendor inbox** = `VendorBookingsView` + `useVendorBookingsController`.
- **Client enquiry** → `VendorBookingResponseFlow` (accept / adjust / decline).
- **Accept** → payout ready → `PATCH status=accepted` → client can pay (Slice 4).
- **Adjust price** → `PUT adjustments` → client confirms → then vendor accept.
- **Chat quote** → `VendorQuoteFormModal` → `POST vendor-quote` → `initiator: vendor`.
- **Withdraw** → `PATCH cancelled` on vendor quotes only.

---

## Related lessons

- Slice 3a: `slice-3a-client-booking-enquire.md` (client enquiry creates row)
- Slice 3b: `slice-3b-client-booking-detail.md` (client accept quote / confirm price)
- Slice 4: `slice-4-client-payment.md` (pay after vendor accept)
- Walkthrough: `slice-5-vendor-booking-walkthrough.md`
