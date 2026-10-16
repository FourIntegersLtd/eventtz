# Piece 19 — web: chat drawer, vendor booking confirm dialogs, onboarding error message

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on pieces 01 and 02 (the vendor profile page and booking modal exist), because the drawer opens from there. Three parts, three commits.

## Part A — ChatDrawer ("Message vendor" / "Message client" without leaving the page)
### Baseline
- `frontend/features/chat/ChatDrawer.tsx`.
  - Props: `isOpen`, `onClose`, `portal`, `counterpartyName`, `conversationId`, `counterpartyUserId`, `onConversationCreated` and `initialDraft`.
  - It uses a Drawer **package** (not allowed here) plus `postConversation` / `postMessage`.
- Used by:
  - `ClientBookingsView` ("Message vendor" on a booking);
  - `ClientVendorBrowseDetailView` ("Message" on a vendor profile);
  - `VendorBookingsView` ("Message client").

  Read each call site for its `initialDraft` text and when `conversationId` is null (the first contact creates it).

### Build
- `web/src/domains/messages/ChatDrawer.tsx`: a hand-built side drawer.
  - Fixed right panel; full-width at ≤640px.
  - Backdrop click and Esc close it; focus trap; `role="dialog"` with `aria-modal` and `aria-labelledby`.
  - Body scroll is locked while open.
  - Motion follows `frontend/UI-CONVENTIONS.md` (respect `prefers-reduced-motion`).
  - Inside: reuse `MessageComposer` and the thread list pieces of `domains/messages` rather than rewriting them.
- The first message with no conversation calls the create-conversation endpoint, then posts. Reuse the functions in `domains/messages/api.ts`; add `createConversation` there if it's missing. Then it calls `onConversationCreated(id)`.
- Pure logic, `chatDrawer.ts` (+ test): `drawerTitle(portal, counterpartyName)` and `initialDraftFor(...)` if the baseline builds drafts.
- Wiring: `domains/messages` is shared, so each call-site domain can't import it directly. Pass it in from app/ pages through a slot, as piece 01's `bookingModal` does:
  - the client booking detail page and the client vendor profile page (`/client/browse/[userId]`);
  - the vendor booking detail page.

  Show the trigger buttons exactly where the baseline does, with its labels.

## Part B — confirm dialogs on vendor booking actions
### Facts
- `web/src/domains/vendor-bookings/BookingStatusActions.tsx` has buttons for `onAccept`, `onDecline`, `onWithdraw`, `onCancel` and `onConfirmCompletion`, which call their handlers directly with no confirmation.
- `web/src/domains/client-bookings/` already uses `ConfirmDialog`. Copy its usage pattern.
- Baseline:
  - `frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx:71-117`: an **unread gate** (the vendor must open the enquiry/messages before accepting? read it), plus the accept and decline dialogs;
  - `VendorBookingsView.tsx`: `confirmCopy[confirmAction]`, the title, body and confirm label per action.
### Build
- `web/src/domains/vendor-bookings/confirmCopy.ts` (+ test): `VENDOR_CONFIRM_COPY: Record<action, {title, body, confirmLabel}>` with the baseline strings exactly, and the unread-gate predicate as a pure function.
- `BookingStatusActions` (or its parent `BookingDetailView`) opens `ConfirmDialog` with that copy before calling the handler. Match the baseline: if it doesn't confirm an action (e.g. withdraw), don't add a dialog for it.

## Part C — onboarding completion failure message
### Facts
`web/src/domains/client-onboarding/ClientOnboardingProvider.tsx:76-91`: `complete()` swallows errors (`void cause`), with a comment saying there's no toast. The baseline shows the toast "Could not finish onboarding" on error and "Onboarding complete" on success.
### Build
- Add `error: string | null` to the provider's context value. Set it to "Could not finish onboarding" on failure, and clear it on retry or dismiss. Keep the modal open on failure; don't `dismiss()`.
- `ClientWelcomeOnboardingModal.tsx`: render the error inline near the finish button, with `role="alert"`.
- Success: the baseline toasts "Onboarding complete". With no toast system, skip it and say so in the report. Don't build a toast system.

## Tests
- `chatDrawer.test.ts` and `confirmCopy.test.ts` with literal strings.
- Onboarding: if the error mapping is pure, test it; otherwise no test, and say so.

## Allowed paths
- `web/src/domains/messages/**` and `web/src/domains/vendor-bookings/**`
- `web/src/domains/client-bookings/**` and `web/src/domains/marketplace/**` (slot props only)
- `web/src/domains/client-onboarding/**`
- `web/src/app/client/(portal)/bookings/**`, `web/src/app/client/(portal)/browse/**` and `web/src/app/vendor/(portal)/bookings/**`

## Browser check
- Open the drawer from a vendor profile as a client, send the first message, then check `/client/messages` shows the new conversation.
- As a vendor, accept a booking: a dialog appears first.
- Break onboarding completion: stop api, click finish, and the inline error shows.

## Commits
1. `web: chat drawer on bookings and vendor profile (ws14)`
2. `web: confirm dialogs on vendor booking actions (ws15)`
3. `web: show onboarding completion failure (ws14)`
