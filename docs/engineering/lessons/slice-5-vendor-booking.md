# Slice 5 — Vendor booking lifecycle

**Walkthrough:** `slice-5-vendor-booking-walkthrough.md` — traces vendor accept on a client enquiry + quote-from-chat path.

### User story

A **signed-in vendor** manages booking requests in `/vendor/bookings`: accepts or declines client enquiries, suggests price adjustments, sends custom quotes from chat, and withdraws their own quotes. **Accept** requires Stripe Connect payout setup (`useVendorPayoutsReady`). After accept, the client can pay (Slice 4).

**Initiator flips who acts while `pending`:** client enquiries (`initiator: client`) → vendor accepts/declines/adjusts; vendor quotes (`initiator: vendor`) → client accepts/declines (Slice 3b).

---

## What changed (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Payout gate on accept | `requestAccept` in controller only | Also inside `VendorBookingResponseFlow` (`payoutsLoading`, `payoutsReady`, `onPayoutSetupRequired`) |
| Response flow pricing | Inline "Their estimate: £…" copy | Removed — pricing lives in `BookingPricingBreakdown` on detail panel |
| Adjustment preview | `previewClientTotalLabel` only | `previewClientFeeBreakdown`, `previewTotalDeltaGbp`, `adjustmentPreviewDeltaExplanation` (referral-aware) |
| List sort order | Implicit / `created_at` | `bookingListOrder.ts` + `list_order.py` — `updated_at` then `created_at` |
| Booking reference | Full UUID in UI | `shortId` + `CopyToClipboardButton` on list rows and detail header |
| Dispute entry | Inline section | `BookingDisputeSection` with `presentation="header"` in portal header actions |
| Event grouping | Always grouped | `bookingEventGroupsForList` — headers only when multiple bookings share an event |

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
| `VendorBookingResponseFlow` | Accept / decline / suggest price — payout gate on accept |
| `VendorBookingResponseAdjustments` | Adjustment form + `previewClientFeeBreakdown` / delta copy |
| `vendorBookingResponseHelpers` | Draft rows, fee previews, `adjustmentPreviewDeltaExplanation` |
| `bookingListOrder.ts` | Frontend sort by `updated_at` (mirrors backend) |
| `list_order.py` | `sort_booking_rows_recent_first` for API lists |
| `BookingDisputeSection` | Dispute CTA — `presentation="header"` in detail header |
| `groupBookingsByEvent` | Event sections via `bookingEventGroupsForList` (deduped) |
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
2. Vendor opens `/vendor/bookings/br-v-001` — pricing in `BookingPricingBreakdown` (incl. referral fee rows when applicable).
3. `VendorBookingResponseFlow` shows accept / suggest price / decline actions (no duplicate total copy).
4. Vendor clicks **Accept booking** → payout gate in flow (if Connect not ready, `onPayoutSetupRequired`) → unread chat gate (if messages) → confirm dialog.
5. If payouts ready: `PATCH .../status` `{ booking_status: "accepted" }`.
6. `update_booking_request_status_for_vendor` updates row, notifies client.
7. Client detail shows payment due banner (Slice 4).

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
11. `frontend/features/bookings/useParticipantBookingsScaffold.ts` — shared list/detail loading + `sortBookingListItemsRecentFirst`
12. `frontend/features/bookings/bookingListOrder.ts` — `updated_at` sort (mirrors backend)
13. `frontend/features/bookings/groupBookingsByEvent.ts` — `bookingEventGroupsForList` dedupe
14. `frontend/features/bookings/BookingListPanel.tsx` — list + `CopyToClipboardButton` / `shortId`
15. `frontend/features/bookings/BookingDetailPanel.tsx` — detail + ref copy + `BookingPricingBreakdown`
16. `frontend/features/bookings/BookingDisputeSection.tsx` — dispute CTA (`presentation="header"`)
17. `frontend/lib/shortId.ts` — compact booking ref display
18. `frontend/features/vendor/payments/useVendorPayoutsReady.ts` — payout gate
19. `frontend/features/vendor/payments/PayoutSetupRequiredModal.tsx` — blocked accept UX
20. `frontend/features/vendor/bookings/useVendorPayoutAcceptResume.ts` — resume accept after Connect onboarding
21. `frontend/lib/vendorBookingsApi.ts` — vendor booking HTTP

### Vendor quote from chat

22. `frontend/features/chat/ChatThreadView.tsx` — "Send quote" button
23. `frontend/features/vendor/quotes/VendorQuoteFormModal.tsx` — quote drawer form

### Backend

24. `backend/app/features/bookings/http/vendor.py` — vendor routes
25. `backend/app/contracts/booking.py` — quote body, status patch, adjustments
26. `backend/app/features/bookings/create.py` — `create_vendor_quote_booking_request`
27. `backend/app/features/bookings/status_vendor.py` — `update_booking_request_status_for_vendor`
28. `backend/app/features/bookings/adjustments.py` — `put_vendor_booking_adjustments`
29. `backend/app/features/bookings/list_order.py` — `sort_booking_rows_recent_first`
30. `backend/app/features/bookings/pricing_confirmation.py` — `client_price_confirmation_required`

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
- `BookingDisputeSection` in detail header (`presentation="header"`)

```22:23:frontend/features/vendor/bookings/VendorBookingsView.tsx
export function VendorBookingsView({ selectedBookingId }: VendorBookingsViewProps) {
  const controller = useVendorBookingsController({ selectedBookingId });
```

**List sort** — `useParticipantBookingsScaffold` sorts by latest activity (`updated_at`, then `created_at`):

```46:46:frontend/features/bookings/useParticipantBookingsScaffold.ts
      setList(sortBookingListItemsRecentFirst(await fetchList(tab)));
```

```7:10:frontend/features/bookings/bookingListOrder.ts
export function bookingListActivityTimestamp(
  item: BookingListActivityFields | null | undefined,
): string {
  return item?.updated_at?.trim() || item?.created_at?.trim() || "";
```

Backend mirror — `queries.py` and list endpoints use `sort_booking_rows_recent_first`:

```8:15:backend/app/features/bookings/list_order.py
def sort_booking_rows_recent_first(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort booking rows by latest activity, then creation time, then id."""

    def key(row: dict[str, Any]) -> tuple[str, str, str]:
        activity = str(row.get("updated_at") or row.get("created_at") or "")
        return (activity, str(row.get("created_at") or ""), str(row.get("id") or ""))

    return sorted(rows, key=key, reverse=True)
```

**Event groups** — only when multiple bookings share an event (active tab):

```143:146:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const eventGroups = useMemo(
    () => bookingEventGroupsForList(rows, listItemsById, "client", tab === "active"),
    [tab, rows, listItemsById],
  );
```

```94:103:frontend/features/bookings/groupBookingsByEvent.ts
export function bookingEventGroupsForList(
  rows: BookingListRowViewModel[],
  itemsById: Map<string, BookingEventGroupingItem>,
  counterpartyNoun: BookingEventGroupCounterparty,
  enabled: boolean,
): BookingEventGroup[] | null {
  if (!enabled || rows.length === 0) return null;
  const groups = groupBookingsByEvent(rows, itemsById, counterpartyNoun);
  return groups.some((group) => group.bookingCount > 1) ? groups : null;
}
```

**Booking ref copy** — list rows and detail header:

```92:96:frontend/features/bookings/BookingListPanel.tsx
              <CopyToClipboardButton
                text={row.id}
                ariaLabel={`Copy booking reference ${shortId(row.id) ?? ""}`}
                onCopied={copyBookingRef}
              />
```

```117:122:frontend/features/bookings/BookingDetailPanel.tsx
            <span className="inline-flex items-center gap-0.5 font-mono text-neutral-400">
              <span title={booking.id}>Ref {shortId(booking.id)}</span>
              <CopyToClipboardButton
                text={booking.id}
                ariaLabel="Copy booking reference"
              />
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

Payout readiness is checked in **two places**: the controller's `requestAccept` (header re-accept path) and **`VendorBookingResponseFlow`** (primary accept button).

**File:** `useVendorPayoutsReady.ts`

```12:14:frontend/features/vendor/payments/useVendorPayoutsReady.ts
export function isVendorPayoutsReady(status: VendorPaymentsStatus | null | undefined): boolean {
  return Boolean(status?.charges_enabled && status?.payouts_enabled);
}
```

**File:** `VendorBookingResponseFlow.tsx` — accept button checks payouts before confirm dialog:

```141:148:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
  const requestAcceptDecision = async () => {
    if (actionBusy || adjustmentSaving || checkingDecision || payoutsLoading) return;
    if (!payoutsReady) {
      onPayoutSetupRequired();
      return;
    }
    await requestDecision("accept");
  };
```

Wired from `VendorBookingsView`:

```121:123:frontend/features/vendor/bookings/VendorBookingsView.tsx
                      payoutsLoading={controller.payoutsLoading}
                      payoutsReady={controller.payoutsReady}
                      onPayoutSetupRequired={() => controller.setPayoutModalOpen(true)}
```

**File:** `useVendorBookingsController.ts` — `requestAccept` (header re-accept path):

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

Shown when `pending` + `initiator !== "vendor"`. Pricing is in `BookingPricingBreakdown` on the detail panel — the flow only renders action buttons (no duplicate "Their estimate" line).

```215:216:frontend/features/vendor/bookings/useVendorBookingsController.ts
  const showClientResponseFlow =
    detail?.booking_status === "pending" && detail.initiator !== "vendor";
```

**Review step** — accept, suggest price, or decline:

```150:171:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjustmentSaving || !!checkingDecision || payoutsLoading}
            loading={checkingDecision === "accept"}
            onClick={() => void requestAcceptDecision()}
          >
            Accept booking
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjustmentSaving || !!checkingDecision}
            onClick={() => openAdjust([])}
          >
            Suggest a different price
          </Button>
        </div>
```

**Unread gate** — forces vendor to read chat before accept/decline:

```69:90:frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx
  const requestDecision = async (kind: PendingDecision) => {
    if (actionBusy || adjustmentSaving || checkingDecision) return;
    setCheckingDecision(kind);
    try {
      const conversationId = detail.conversation_id?.trim();
      if (conversationId) {
        try {
          const conv = await fetchConversation(conversationId);
          if ((conv.unread_count ?? 0) > 0) {
            setPendingDecision(kind);
            setUnreadGateOpen(true);
            return;
          }
        } catch {
          // Non-fatal: if unread check fails, proceed to the normal confirm dialog.
        }
      } else if ((detail.notes ?? "").trim()) {
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

**File:** `VendorBookingResponseAdjustments.tsx` — cost/discount lines with live preview via `previewClientFeeBreakdown` (referral-aware) and delta copy:

```63:68:frontend/features/vendor/bookings/VendorBookingResponseAdjustments.tsx
  const previewBreakdown = previewClientFeeBreakdown(pricing, adjustDrafts);
  const previewDelta = previewTotalDeltaGbp(pricing, adjustDrafts);
  const previewDeltaExplanation =
    previewDelta != null
      ? adjustmentPreviewDeltaExplanation(pricing, adjustDrafts, previewDelta)
      : null;
```

**File:** `vendorBookingResponseHelpers.ts` — fee preview helpers:

```48:60:frontend/features/vendor/bookings/vendorBookingResponseHelpers.ts
export function previewClientFeeBreakdown(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
): ClientFeeBreakdown | null {
  if (!pricing || pricing.has_pricing_tbc) return null;
  const vendorPortion = vendorPortionFromDrafts(pricing, drafts);
  if (vendorPortion == null) return null;
  const referralDiscount = referralDiscountForBookingPreview(pricing, vendorPortion);
  return computeClientFeeBreakdown({
    vendorPortionGbp: vendorPortion,
    feePercent: pricing.service_fee_percent,
    referralFeeDiscountGbp: referralDiscount,
  });
}
```

```71:80:frontend/features/vendor/bookings/vendorBookingResponseHelpers.ts
export function previewTotalDeltaGbp(
  pricing: BookingPricing | null | undefined,
  drafts: AdjustmentDraftRow[],
): number | null {
  const breakdown = previewClientFeeBreakdown(pricing, drafts);
  const currentTotal = pricing?.client_total_gbp;
  if (!breakdown || currentTotal == null || !Number.isFinite(currentTotal)) return null;
  const delta = Math.round((breakdown.totalGbp - currentTotal) * 100) / 100;
  if (delta === 0) return null;
  return delta;
}
```

Draft model — `applyDraftLine`:

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

**Dispute CTA** — compact header slot (not inline in scroll body):

```140:146:frontend/features/vendor/bookings/VendorBookingsView.tsx
                  disputeSection: controller.detail ? (
                    <BookingDisputeSection
                      bookingId={controller.detail.booking_request_id}
                      role="vendor"
                      bookingStatus={controller.detail.booking_status}
                      presentation="header"
                    />
```

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
- **Payout gate** — `VendorBookingResponseFlow` + `useVendorPayoutsReady` + backend `COMPLETE_PAYOUT_SETUP`.
- **List ordering** — `updated_at` first via `bookingListOrder.ts` / `list_order.py`.
- **Event groups** — `bookingEventGroupsForList` shows headers only when an event has 2+ bookings.
- **Booking ref** — `shortId` + `CopyToClipboardButton` on list and detail.
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
