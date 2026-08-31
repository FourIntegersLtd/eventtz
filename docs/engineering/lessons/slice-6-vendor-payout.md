# Slice 6 — Payout, completion, refunds

**Walkthrough:** traces one paid booking from post-event → dual completion → Stripe Transfer → `payout_released`, plus Connect onboarding and cancel/refund paths.

### User story

After the **event day ends**, the **client** and **vendor** each confirm the booking completed successfully (or Eventtz **auto-releases** after the grace period). Eventtz then sends the vendor's share via a **Stripe Connect Transfer** from the held platform balance. The vendor must have finished **Stripe Connect payout setup** before money can land — if both parties confirmed but Connect is incomplete, the payout is **held** and the vendor gets a `payout_held_connect_incomplete` notification (migration `078`).

If a **paid** booking is **cancelled** before payout, the client is **refunded first**, then status moves to `cancelled`. You cannot cancel after `payout_released`.

**Prerequisites:** Slice 4 (client paid → `payment_status = paid`, funds on platform balance) and Slice 5 (vendor accepted). Slice 6 completes the money lifecycle.

---

## What changed since last lesson (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Payout readiness hook | `charges_enabled && payouts_enabled` only | `isVendorPayoutsReady` prefers `can_accept_bookings` from `GET /vendor/payments/status` |
| Status API contract | Stripe flags only | `VendorPaymentsStatusResponse` adds `can_accept_bookings`, `payout_gate_waived` |
| Backend status builder | `_connect_status_from_row` | `get_vendor_connect_status_response` calls `vendor_connect_can_receive_payouts` + `payout_gate_waived` |

Plain English: the frontend no longer re-implements the accept gate — it reads the same boolean the backend uses when a vendor tries to accept a booking (Stripe Connect ready **or** admin listing waiver).

---

## What payout and completion do

```typescript
// Client or vendor on booking detail, after event day:
await postClientConfirmCompletion(bookingId); // or postVendorConfirmCompletion
// When both timestamps exist → backend Stripe Transfer → payout_released + completed
```

| Piece | Role |
|--------|------|
| `VendorPaymentsView` | `/vendor/payments` — Connect onboarding + payout history tabs |
| `VendorPayoutAccountPanel` | Connect CTA, setup progress, manage-on-Stripe |
| `vendorPaymentsApi.ts` | `POST connect-account`, `GET status`, `GET history` |
| `useVendorPayoutsReady` | `can_accept_bookings` from status API (mirrors `vendor_connect_can_receive_payouts`; Stripe-flag fallback) |
| `BookingCompletionBanner` | Post-event nudge — who still needs to confirm |
| `BookingPayoutPendingBanner` | Both confirmed but Transfer not done — vendor retry |
| `payment_completion.py` | Record confirmations, `release_vendor_payout_and_complete_booking` |
| `completion_rules.py` | `event_day_over`, `completion_waiting_on`, auto-release time |
| `payment_maintenance.py` | Reminders, auto-release job, stuck-payout retry |
| `payment_refunds.py` | Full/partial Stripe refunds on cancel or admin |
| `stripe.py` | Connect onboarding, `create_transfer`, `create_refund` |

Plain English: money sits on Eventtz until the event is over. Both sides confirm (or the 48h timer fires), then Eventtz transfers the vendor share to their Connect account. Connect setup is separate from filling out the vendor profile — you need both to appear in search and receive payouts.

---

## What happens at a glance

```
Paid booking, event day ends
    → BookingCompletionBanner on client + vendor detail
        → POST .../confirm-completion (client or vendor)
            → record_party_completion_confirmation()
                → sets client_completion_confirmed_at or vendor_completion_confirmed_at
                → notifies waiting party
                → run_post_event_payout_and_reminder_for_booking (reminder + retry if stuck)
    → When BOTH timestamps set:
        → release_vendor_payout_and_complete_booking()
            → vendor stripe_payouts_enabled? 
                NO → payout_held_connect_incomplete notification, stay paid
                YES → stripe create_transfer (source_transaction = charge id)
                    → status=completed, payment_status=payout_released
                    → vendor_payout_statement snapshot + email
    → (parallel) Hourly job run_booking_maintenance
        → send_completion_reminders (one nudge per booking)
        → process_due_payout_auto_releases (48h after event end)
    → (parallel) Stripe webhook account.updated
        → sync_connect_account_status → may unblock held payouts on next confirm/retry

Cancel paid booking (before payout_released):
    → refund_paid_booking_before_cancel()
        → stripe create_refund (full)
        → payment_status = refunded
    → then status = cancelled
```

---

## Example: event completes, vendor gets paid

1. Booking `br-abc` is `accepted` / `paid` after Slice 4.
2. Event was Saturday; Sunday 00:00 UTC the event day is "over" (`event_day_over`).
3. Client opens detail — sees **How did your event go?** banner.
4. Client taps **Confirm event complete** → `POST .../confirm-completion`.
5. Vendor sees **Waiting for the client** → then confirms on their side.
6. Backend calls `create_transfer` for `vendor_amount_gbp` → `payout_released`.
7. Vendor gets in-app `vendor_payout_released` + payout statement PDF.
8. Row appears as **Paid out** on `/vendor/payments` history tab.

If vendor had incomplete Connect at step 6: payout stays `paid`, notification `payout_held_connect_incomplete`; after finishing Connect, vendor taps **Release my payout** (re-POST confirm-completion).

---

## Complete route — Connect onboarding

### Frontend

1. `frontend/app/vendor/(portal)/payments/page.tsx` — thin route shell
2. `frontend/features/vendor/payments/VendorPaymentsView.tsx` — tabs, Stripe return handling
3. `frontend/features/vendor/payments/VendorPayoutAccountPanel.tsx` — account panel UI
4. `frontend/features/vendor/payments/VendorPayoutCard.tsx` — status card + steps
5. `frontend/features/vendor/payments/VendorPaymentHistory.tsx` — ledger tab
6. `frontend/features/vendor/payments/useVendorPayoutsReady.ts` — shared readiness hook
7. `frontend/features/vendor/dashboard/VendorPayoutSetupBanner.tsx` — dashboard nudge
8. `frontend/features/vendor/bookings/useVendorPayoutAcceptResume.ts` — accept-after-Connect return
9. `frontend/lib/vendorPaymentsApi.ts` — Connect + history API calls

### Backend

10. `backend/app/features/payments/http/vendor.py` — `/vendor/payments/*` routes
11. `backend/app/features/payments/stripe.py` — Connect + Transfer + Refund
12. `backend/app/features/payments/http/webhooks.py` — `account.updated` sync
13. `backend/app/contracts/payments.py` — response contracts

---

## Complete route — dual completion → payout

### Frontend

14. `frontend/features/bookings/BookingCompletionBanner.tsx` — post-event confirm UI
15. `frontend/features/bookings/BookingPayoutPendingBanner.tsx` — stuck payout retry
16. `frontend/features/bookings/bookingConfirmCopy.ts` — copy + `isPayoutReleasePending`
17. `frontend/features/client/bookings/ClientBookingDetailExtras.tsx` — client banners
18. `frontend/features/vendor/bookings/VendorBookingDetailExtras.tsx` — vendor banners
19. `frontend/features/client/bookings/useClientBookingActions.ts` — client confirm handler
20. `frontend/features/vendor/bookings/useVendorBookingActions.ts` — vendor confirm + retry
21. `frontend/lib/clientBookingsApi.ts` — `postClientConfirmCompletion`
22. `frontend/lib/vendorBookingsApi.ts` — `postVendorConfirmCompletion`

### Backend

23. `backend/app/features/bookings/http/client.py` — client confirm + detail auto-release
24. `backend/app/features/bookings/http/vendor.py` — vendor confirm + detail auto-release
25. `backend/app/features/bookings/payment_completion.py` — confirmation + release
26. `backend/app/features/bookings/completion_rules.py` — pure date/waiting rules
27. `backend/app/features/bookings/queries.py` — `completion_waiting_on` on detail rows
28. `backend/app/features/bookings/receipts.py` — payout statement snapshot

---

## Complete route — maintenance, refunds, cancel

29. `backend/app/features/bookings/payment_maintenance.py` — reminders + auto-release
30. `backend/app/jobs/run_booking_maintenance.py` — CLI + scheduler entry
31. `backend/app/features/bookings/payment_refunds.py` — Stripe refund helpers
32. `backend/app/features/bookings/status_shared.py` — cancel guards + refund-before-cancel
33. `backend/app/features/bookings/status_client.py` — client cancel path
34. `backend/app/features/bookings/status_vendor.py` — vendor cancel + accept Connect gate
35. `backend/sql/078_payout_held_connect_incomplete.sql` — notification kind

---

## `payment_status` after pay (Slice 6 extensions)

| Status | Meaning | Typical trigger |
|--------|---------|-----------------|
| `paid` | Client charged; vendor share held on platform | Slice 4 webhook/sync |
| `paid` (held) | Both confirmed but Connect incomplete | `release_vendor_payout` early return |
| `payout_released` | Transfer succeeded; booking `completed` | Dual completion or auto-release |
| `refunded` | Full refund before vendor paid | Cancel while `paid` |
| `partially_refunded` | Admin partial refund | Admin problem-report resolution |

Booking `status` moves `accepted` → `completed` only when payout releases (or admin release). Cancellation sets `status = cancelled` without completing.

Frontend stuck-payout detector:

```307:314:frontend/features/bookings/bookingConfirmCopy.ts
export function isPayoutReleasePending(detail: CompletionTimestamps): boolean {
  return (
    detail.booking_status === "accepted" &&
    detail.payment_status === "paid" &&
    Boolean(detail.client_completion_confirmed_at) &&
    Boolean(detail.vendor_completion_confirmed_at)
  );
}
```

---

## Connect ≠ vendor profile onboarding

| | **Profile onboarding** (`/vendor/profile`) | **Stripe Connect** (`/vendor/payments`) |
|--|--|--|
| Purpose | Listing copy, photos, service areas | Bank account + Stripe verification |
| Blocks search? | Incomplete profile fields | `stripe_charges_enabled` + `stripe_payouts_enabled` false |
| UI | `VendorOnboarding` on profile page | `VendorPaymentsView`, `VendorPayoutSetupBanner` |
| API | Vendor profile endpoints | `POST /vendor/payments/connect-account` |

A vendor can finish their profile but still be hidden until Connect is ready (`VendorPayoutSetupBanner`: *"Your profile is hidden from clients"*). Accepting bookings also requires Connect (`vendor_connect_can_receive_payouts` in `status_shared.py`). Checkout (Slice 4) only needs charges-ready or admin waiver — money is held until completion anyway.

---

## Step 1 — Vendor opens payout setup

**File:** `VendorPaymentsView.tsx` — portal nav entry, Stripe return cleanup:

```52:72:frontend/features/vendor/payments/VendorPaymentsView.tsx
  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    if (stripeReturnHandled.current) return;
    stripeReturnHandled.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("stripe");
    if (!params.get("tab")) {
      params.set("tab", "account");
    }
    const next = params.toString();
    router.replace(next ? `/vendor/payments?${next}` : "/vendor/payments?tab=account");
    void (async () => {
      const res = await refresh();
      if (stripeParam === "return" && isVendorPayoutsReady(res)) {
        track(MixpanelEvents.vendor_payouts_ready, { source: "payments" });
        showToast({ title: "Payout account connected", tone: "success" });
      }
    })();
  }, [searchParams, router, refresh, showToast]);
```

**Readiness check** — prefers backend accept gate; falls back to raw Stripe flags when `can_accept_bookings` is absent:

```12:17:frontend/features/vendor/payments/useVendorPayoutsReady.ts
export function isVendorPayoutsReady(status: VendorPaymentsStatus | null | undefined): boolean {
  if (typeof status?.can_accept_bookings === "boolean") {
    return status.can_accept_bookings;
  }
  return Boolean(status?.charges_enabled && status?.payouts_enabled);
}
```

**Status type** — mirrors `VendorPaymentsStatusResponse`:

```4:12:frontend/lib/vendorPaymentsApi.ts
export type VendorPaymentsStatus = {
  success: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  /** Mirrors backend accept gate (Stripe ready or admin listing waiver). */
  can_accept_bookings?: boolean;
  payout_gate_waived?: boolean;
};
```

**Start Connect** — redirects to Stripe hosted onboarding:

```47:61:frontend/features/vendor/payments/useVendorPayoutsReady.ts
  const connectPayouts = useCallback(async (returnPath: string) => {
    setConnecting(true);
    setError(null);
    try {
      track(MixpanelEvents.vendor_payout_setup_started, {
        source: returnPath.includes("/bookings") ? "bookings" : "payments",
        return_path: returnPath,
      });
      const { onboarding_url } = await postConnectStripeAccount(returnPath);
      window.location.href = onboarding_url;
    } catch (err) {
      setError(getApiErrorDetail(err) ?? "We couldn't start payout setup. Please try again.");
      setConnecting(false);
    }
  }, []);
```

**API layer:**

```33:47:frontend/lib/vendorPaymentsApi.ts
export async function postConnectStripeAccount(
  returnPath?: string,
): Promise<{ onboarding_url: string }> {
  const { data } = await api.post<{ success: boolean; onboarding_url: string }>(
    "/api/v1/vendor/payments/connect-account",
    null,
    returnPath ? { params: { return_path: returnPath } } : undefined,
  );
  return data;
}

export async function fetchVendorStripeConnectStatus(): Promise<VendorPaymentsStatus> {
  const { data } = await api.get<VendorPaymentsStatus>("/api/v1/vendor/payments/status");
  return data;
}
```

---

## Step 2 — Backend: Connect onboarding link

**File:** `payments/http/vendor.py` — thin routes; status returns `VendorPaymentsStatusResponse`:

```24:41:backend/app/features/payments/http/vendor.py
@router.post("/connect-account", response_model=VendorPaymentsConnectResponse)
def post_connect_account(
    request: Request,
    response: Response,
    return_path: str = "/vendor/payments",
) -> VendorPaymentsConnectResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    onboarding_url = create_connect_onboarding_link(uid, return_path=return_path)
    return VendorPaymentsConnectResponse(onboarding_url=onboarding_url)

@router.get("/status", response_model=VendorPaymentsStatusResponse)
def get_vendor_stripe_connect_status(request: Request, response: Response) -> VendorPaymentsStatusResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    data = get_vendor_connect_status_response(uid)
    return VendorPaymentsStatusResponse(**data)
```

**Contract** — accept gate fields on the status payload:

```14:21:backend/app/contracts/payments.py
class VendorPaymentsStatusResponse(BaseModel):
    success: bool = True
    stripe_account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    #: Same rule as vendor accept on client-initiated bookings (includes admin listing waiver).
    can_accept_bookings: bool = False
    payout_gate_waived: bool = False
```

**File:** `stripe.py` — status builder aligns with `vendor_connect_can_receive_payouts`:

```508:531:backend/app/features/payments/stripe.py
def get_vendor_connect_status_response(vendor_user_id: str) -> dict[str, Any]:
    """Vendor-facing Connect status: read DB first; sync from Stripe only while onboarding."""
    ...
    stripe_gate_row = _get_vendor_stripe_fields(vendor_user_id)
    return {
        **status,
        "can_accept_bookings": vendor_connect_can_receive_payouts(vendor_user_id),
        "payout_gate_waived": payout_gate_waived(stripe_gate_row),
    }
```

**Accept gate** (same rule as Slice 5 accept):

```63:79:backend/app/features/bookings/status_shared.py
def vendor_connect_can_receive_payouts(vendor_user_id: str) -> bool:
    """True when Stripe Connect can charge and pay out (required before accept)."""
    row = _get_vendor_stripe_fields(vendor_user_id)
    if row is None:
        return False
    if payout_gate_waived(row):
        return True
    return bool(
        row.get("stripe_account_id")
        and row.get("stripe_charges_enabled")
        and row.get("stripe_payouts_enabled")
    )
```

**File:** `stripe.py` — create Express account + AccountLink:

```352:356:backend/app/features/payments/stripe.py
def create_connect_onboarding_link(vendor_user_id: str, return_path: str = "/vendor/payments") -> str:
    """Create a Stripe Express account for this vendor if needed, then return an onboarding URL.

    `return_path` is where the vendor lands after Stripe (Payments page or a booking detail).
    """
```

Return URLs embed `?stripe=return` or `?stripe=refresh` for the frontend handlers. **`account.updated` webhook** keeps `stripe_charges_enabled` / `stripe_payouts_enabled` in sync after Stripe verifies the vendor — no admin step.

```419:425:backend/app/features/bookings/payment_finalize.py
def handle_account_updated(event_id: str, account: dict[str, Any]) -> None:
    if not _mark_webhook_event_processed(event_id, "account.updated"):
        return
    account_id = str(account.get("id") or "")
    if not account_id:
        return
    stripe_service.sync_connect_account_status_by_account_id(account_id)
```

**Accept-from-booking flow:** vendor tries to accept without Connect → redirected to Stripe with `return_path=/vendor/bookings/{id}` → `useVendorPayoutAcceptResume` auto-accepts when they return ready.

---

## Step 3 — Post-event completion banner

**File:** `BookingCompletionBanner.tsx` — only after event day over, paid, someone still waiting:

```39:44:frontend/features/bookings/BookingCompletionBanner.tsx
  if (status !== "accepted" || paymentStatus !== "paid" || !waitingOn) return null;
  if (!eventDayOver(eventDate, eventEndDate)) return null;

  const copy = completionWaitingCopy(waitingOn, viewer);
  const viewerNeedsToConfirm = waitingOn === "both" || waitingOn === viewer;
```

**Who is waiting** — computed server-side:

```49:61:backend/app/features/bookings/completion_rules.py
def completion_waiting_on(row: dict[str, Any]) -> str | None:
    """Who still needs to confirm completion: 'client' | 'vendor' | 'both' | None."""
    if str(row.get("status") or "") != "accepted":
        return None
    if str(row.get("payment_status") or "") != "paid":
        return None
    client_done = bool(row.get("client_completion_confirmed_at"))
    vendor_done = bool(row.get("vendor_completion_confirmed_at"))
    if client_done and vendor_done:
        return None
    if not client_done and not vendor_done:
        return "both"
    return "client" if not client_done else "vendor"
```

**Event day over** — start of day after `event_end_date` (or `event_date`):

```42:47:backend/app/features/bookings/completion_rules.py
def event_day_over(row: dict[str, Any], now: datetime | None = None) -> bool:
    day_end = _event_day_end_utc(row)
    if day_end is None:
        return False
    return (now or datetime.now(timezone.utc)) >= day_end
```

**Auto-release timestamp** — event end + `BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT` (default 48h):

```29:39:backend/app/features/bookings/completion_rules.py
def compute_payout_auto_release_at(row: dict[str, Any]) -> datetime | None:
    """When the held payment auto-releases to the vendor, or None if not applicable."""
    if str(row.get("status") or "") != "accepted":
        return None
    if str(row.get("payment_status") or "") != "paid":
        return None
    day_end = _event_day_end_utc(row)
    if day_end is None:
        return None
    hours = get_settings().booking_payout_auto_release_hours_after_event
    return day_end + timedelta(hours=hours)
```

Wired on client detail:

```99:109:frontend/features/client/bookings/ClientBookingDetailExtras.tsx
      <BookingCompletionBanner
        viewer="client"
        status={detail.booking_status}
        paymentStatus={detail.payment_status}
        eventDate={detail.event_date}
        eventEndDate={detail.event_end_date}
        waitingOn={detail.completion_waiting_on}
        autoReleaseAt={detail.payout_auto_release_at}
        confirmDisabled={actionBusy || confirmingCompletion}
        onConfirm={onConfirmComplete}
      />
```

---

## Step 4 — Confirm completion API

**Client route:**

```423:444:backend/app/features/bookings/http/client.py
@router.post(
    "/booking-requests/{booking_id}/confirm-completion",
    response_model=ConfirmCompletionResponse,
)
def post_client_confirm_completion(
    request: Request,
    response: Response,
    booking_id: str,
) -> ConfirmCompletionResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    parse_booking_id(booking_id)

    try:
        result = confirm_completion_for_client(client_id, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not result:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return ConfirmCompletionResponse(**result)
```

**Core logic** — stamp timestamp, notify other party, maybe finalize:

```218:269:backend/app/features/bookings/payment_completion.py
    ts_col = "client_completion_confirmed_at" if actor == "client" else "vendor_completion_confirmed_at"
    other_ts_col = "vendor_completion_confirmed_at" if actor == "client" else "client_completion_confirmed_at"

    if row.get(ts_col):
        if both_parties_confirmed_awaiting_payout(row):
            return _finalize_completion(row)
        return _serialize_completion_state(row)

    if not event_day_over(row):
        raise ValueError(booking_messages.EVENT_DAY_NOT_OVER)

    upd = (
        db.table("booking_requests")
        .update({ts_col: _now_iso()})
        .eq("id", booking_id)
        .eq(id_col, user_id)
        .is_(ts_col, "null")
        .execute()
    )
    ...
    if not row.get(other_ts_col):
        ...
        run_post_event_payout_and_reminder_for_booking(row)
        return _serialize_completion_state(row)

    return _finalize_completion(row)
```

Re-POSTing confirm when both already confirmed **retries** a stuck Transfer (vendor **Release my payout** button uses the same endpoint).

---

## Step 5 — Stripe Transfer + complete booking

**File:** `payment_completion.py` — `release_vendor_payout_and_complete_booking`:

```54:74:backend/app/features/bookings/payment_completion.py
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    if not vendor_stripe.get("stripe_account_id") or not vendor_stripe.get("stripe_payouts_enabled"):
        logger.warning(
            "Cannot release payout booking=%s vendor=%s: Stripe payouts not enabled",
            booking_id,
            vendor_id,
        )
        if vendor_id:
            dispatch_booking_notification(
                user_id=vendor_id,
                booking_id=booking_id,
                kind="payout_held_connect_incomplete",
                mode="insert_if_absent",
                body=(
                    "Both of you confirmed the event is complete. We are holding your payout "
                    "until you finish Stripe payout setup.\n\n"
                    "Open Payouts to complete verification so we can send your funds."
                ),
            )
        _notify_pair(client_id, vendor_id)
        return _serialize_completion_state(row)
```

Migration `078` added the `payout_held_connect_incomplete` notification kind to the DB constraint.

**Transfer** — funds from Checkout charge via `source_transaction`:

```105:113:backend/app/features/bookings/payment_completion.py
        transfer_id = stripe_service.create_transfer(
            destination_account_id=str(vendor_stripe["stripe_account_id"]),
            amount_gbp=amount_gbp,
            booking_id=booking_id,
            source_transaction=source_charge,
        )
```

```847:859:backend/app/features/payments/stripe.py
def create_transfer(
    *,
    destination_account_id: str,
    amount_gbp: float,
    booking_id: str,
    source_transaction: str | None = None,
) -> str:
    """Pay the vendor from the client's Checkout charge into their Connect account.

    When ``source_transaction`` is set (the booking's ``stripe_charge_id``), Stripe
    funds the transfer from that charge even if the platform balance is empty because
    automatic payouts already swept it. Without it, the transfer needs available
    platform balance and can fail with "insufficient funds".
```

**Row update** — conditional to prevent double payout:

```123:137:backend/app/features/bookings/payment_completion.py
    upd = (
        db.table("booking_requests")
        .update(
            {
                "status": "completed",
                "payment_status": "payout_released",
                "stripe_transfer_id": transfer_id,
                "payout_released_at": _now_iso(),
                "completed_at": _now_iso(),
            },
        )
        .eq("id", booking_id)
        .eq("status", "accepted")
        .eq("payment_status", "paid")
        .execute()
    )
```

---

## Step 6 — Stuck payout banner (vendor retry)

When `isPayoutReleasePending(detail)` — both timestamps, still `paid`:

```47:54:frontend/features/vendor/bookings/VendorBookingDetailExtras.tsx
      {isPayoutReleasePending(detail) ? (
        <BookingPayoutPendingBanner
          viewer="vendor"
          onRetryRelease={onRetryPayout}
          retryDisabled={actionBusy}
          retryLoading={actionBusy}
        />
      ) : null}
```

```14:17:frontend/features/bookings/BookingPayoutPendingBanner.tsx
/**
 * Both parties confirmed completion but Stripe has not marked the payout released yet.
 * Usually means a transfer failed once and needs a retry after a backend fix.
 */
```

Client sees informational banner only (no retry button).

---

## Step 7 — Maintenance jobs and detail-page safety net

**Hourly job** (`run_booking_maintenance.py`):

```48:53:backend/app/jobs/run_booking_maintenance.py
    reminders_sent = _run_step("completion_reminders", send_completion_reminders, 0)
    payouts_released = _run_step(
        "payout_auto_releases", process_due_payout_auto_releases, 0,
    )
```

**Auto-release** — skips open disputes and `support_hold`:

```159:188:backend/app/features/bookings/payment_maintenance.py
def auto_release_payout_if_grace_period_elapsed(row: dict[str, Any]) -> bool:
    ...
    if has_active_dispute_for_booking(booking_id):
        return False
    if row.get("support_hold"):
        return False
    result = _finalize_completion(row)
    if str((result or {}).get("payment_status") or "") != "payout_released":
        # e.g. vendor Stripe account not ready - leave for a later run.
        return False
    get_db().table("booking_requests").update(
        {"payout_auto_released_at": _now_iso()},
    ).eq("id", booking_id).execute()
```

**Detail GET** also triggers maintenance between hourly runs:

```120:121:backend/app/features/bookings/http/client.py
    # Safety net between hourly runs: pay the vendor if the automatic payout date has passed.
    maybe_auto_release_payout_for_booking(booking_id)
```

List endpoints only send **reminders** (cap 10) — not payouts — to avoid refresh loops.

---

## Step 8 — Refunds on cancel

**Order matters:** refund Stripe first, then change booking status. If refund fails, cancel aborts.

```45:53:backend/app/features/bookings/status_shared.py
def refund_paid_booking_before_cancel(booking_id: str, payment_status: str, *, cancelled_by: str) -> bool:
    """Full refund before cancelling a paid booking. Returns True if a refund was issued."""
    if payment_status != "paid":
        return False
    from app.features.bookings.payments import refund_booking_on_cancel

    refund_booking_on_cancel(booking_id, cancelled_by=cancelled_by)
    return True
```

**Refund implementation:**

```41:60:backend/app/features/bookings/payment_refunds.py
    try:
        stripe_service.create_refund(
            payment_intent_id=str(pi_id),
            booking_id=booking_id,
            amount_gbp=amount_gbp,
            idempotency_suffix=idempotency_suffix,
        )
    except Exception as e:
        ...
        raise ValueError(booking_messages.REFUND_FAILED) from e

    new_status = "partially_refunded" if amount_gbp is not None else "refunded"
    upd = (
        get_db()
        .table("booking_requests")
        .update({"payment_status": new_status})
        .eq("id", booking_id)
        .eq("payment_status", "paid")
        .execute()
    )
```

**Cancel guards** — cannot cancel after payout or with open dispute:

```20:42:backend/app/features/bookings/status_shared.py
def assert_booking_may_be_cancelled(booking_id: str, *, status: str, payment_status: str) -> None:
    """Shared checks before cancel: not after payout, not while a problem report is open."""
    if status == "completed":
        raise ValueError(
            booking_messages.CANCEL_COMPLETE_INSTEAD,
        )
    if payment_status == "payout_released":
        raise ValueError(
            booking_messages.CANCEL_AFTER_PAYOUT,
        )
    ...
    if has_active_dispute_for_booking(booking_id):
        raise ValueError(
            booking_messages.CANCEL_OPEN_DISPUTE,
        )
```

**Client cancel path** — refund then `cancelled`:

```57:59:backend/app/features/bookings/status_client.py
    assert_booking_may_be_cancelled(booking_id, status=current, payment_status=payment_status)
    expire_pending_checkout_session(payment_status, row0.get("stripe_checkout_session_id"))
    refunded = refund_paid_booking_before_cancel(booking_id, payment_status, cancelled_by="client")
```

UI shows refunded message in `ClientBookingDetailExtras` / `VendorBookingDetailExtras` when `cancelled` + `refunded`.

---

## Parameter map — completion → payout

| Step | Client/vendor state | API | DB columns touched |
|------|---------------------|-----|-------------------|
| Event ends | `completion_waiting_on` set | GET detail (auto-release check) | maybe `payout_auto_released_at` |
| Client confirms | banner CTA | `POST .../confirm-completion` | `client_completion_confirmed_at` |
| Vendor confirms | banner CTA | `POST .../confirm-completion` | `vendor_completion_confirmed_at` |
| Transfer OK | `payout_released` | (internal) | `status=completed`, `stripe_transfer_id`, `payout_released_at`, `completed_at` |
| Connect held | `paid` + both confirmed | — | notification `payout_held_connect_incomplete` |
| Auto-release | timer elapsed | hourly job / GET detail | same as Transfer OK + `payout_auto_released_at` |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Connect / status / history | `require_vendor` |
| Confirm completion | `require_client` or `require_vendor` — must own booking |
| Cancel + refund | Same party guards + `assert_booking_may_be_cancelled` |
| Webhook `account.updated` | Stripe signature — no session |
| Admin retry payout / refund | Platform admin routes |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `vendor_payout_setup_started` | Before Stripe Connect redirect |
| `vendor_payouts_ready` | Connect return + `isVendorPayoutsReady` true (`can_accept_bookings`) |
| `vendor_booking_completed` | Vendor confirms completion |
| `booking_completed` | Backend marketplace event on payout release |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Hidden from search | `VendorPayoutSetupBanner` — Connect not ready |
| Cannot accept booking | `status_vendor.py` — `vendor_connect_can_receive_payouts` |
| Completion banner missing | `event_day_over` — event day not over yet |
| "Event day not over" on confirm | `completion_rules.event_day_over` + booking dates |
| Both confirmed, still `paid` | `payment_completion.py` — Connect `payouts_enabled` false |
| Payout held notification | Migration `078` kind; finish Connect, retry confirm |
| Transfer insufficient funds | `stripe.create_transfer` — missing `source_transaction` / charge id |
| Stuck after Stripe fix | Vendor **Release my payout** → re-POST confirm-completion |
| Auto-release did not fire | `payment_maintenance` — dispute, `support_hold`, or Connect incomplete |
| Cancel failed after pay | `payment_refunds` — refund failed; booking stays `paid` |
| Cancel after vendor paid | `assert_booking_may_be_cancelled` — `CANCEL_AFTER_PAYOUT` |
| Reminder spam | `mark_completion_reminder_sent_if_unset` — atomic claim |
| Connect flags stale | `account.updated` webhook + `sync_connect_account_status` |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Held funds until dual completion / auto-release | **Leave it alone** — dispute window + mutual confirm |
| `source_transaction` on Transfer | **Leave it alone** — survives platform balance sweeps |
| Refund-before-cancel ordering | **Leave it alone** — never cancel without money back |
| Detail GET auto-release safety net | **Leave it alone** — complements hourly job |
| Connect gate on accept, not checkout | **Leave it alone** — client can pay while vendor finishes Connect |
| Re-confirm retries stuck payout | **Leave it alone** — simple vendor self-service |

---

## Key concepts from this slice

- **Stripe Connect** — Express accounts; `can_accept_bookings` on status API = `vendor_connect_can_receive_payouts` (Stripe ready or admin `payout_gate_waived`).
- **Connect ≠ profile** — bank verification is separate from listing copy/photos.
- **Dual completion** — both `*_completion_confirmed_at` timestamps before Transfer (unless auto-release).
- **Auto-release** — `BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT` (48h) after event end; skipped if dispute/support hold.
- **Transfer not Charge** — Checkout already charged client; completion moves vendor share via `Transfer.create`.
- **Payout held** — both confirmed but Connect incomplete; `payout_held_connect_incomplete` (migration `078`).
- **Refund-first cancel** — only `paid` bookings refunded; not after `payout_released`.
- **Maintenance split** — lists send reminders only; payouts on detail GET + hourly job.

---

## TL;DR

- **Connect** = `/vendor/payments` → `POST /api/v1/vendor/payments/connect-account` → Stripe onboarding → `account.updated` syncs flags.
- **Complete** = after event day, each party `POST .../confirm-completion` → when both done → `create_transfer` → `payout_released` + `completed`.
- **Held payout** = Connect incomplete after both confirmed → finish Connect → vendor **Release my payout** (re-confirm).
- **Auto-release** = 48h after event end if nobody confirms (no open dispute).
- **Cancel paid** = Stripe refund first → `refunded` → `cancelled`; never after payout.
- **Jobs** = `run_booking_maintenance` hourly; detail GET also runs auto-release check.

---

## Related lessons

- Slice 4: `slice-4-client-payment.md` (client pay → held funds on platform)
- Slice 5: `slice-5-vendor-booking.md` (accept requires Connect; resume after onboarding)
- Slice 3b: `slice-3b-client-booking-detail.md` (detail shell hosting banners)
