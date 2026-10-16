# Piece 18 — web: "Send quote" from a vendor's chat thread (MONEY: vendor sets a price)

First read `.qwen/next20/rules-web.md` and follow it in full. There are no dependencies.

## Facts
- Endpoint: `POST /api/v1/vendor/booking-requests/vendor-quote`, body `CreateVendorQuoteBody` and response `BookingRequestCreated`. It's already in `schema.d.ts`; `grep -n "vendor-quote" web/src/foundation/platform-client/schema.d.ts`. It has 15 error codes; read them from the `responses` in `api/openapi.json` for that path.
- Web thread view: `web/src/domains/messages/ConversationThreadView.tsx`, `ConversationThreadView({ portal, conversationId, basePath })` (:55).
  - It already renders quote cards: `MessageBubble` links to `quoteBookingPath(portal, quote.bookingRequestId)` (:246).
  - `conversation.peer_user_id` and `conversation.kind` are available (:170).
- The vendor profile fetch: grep `fetchVendorProfile` or the vendor-profile api in `web/src/domains/vendor-profile/api.ts`. It's needed for the prefill (packages and prices).

## Baseline reference
- Button: `frontend/features/chat/ChatThreadView.tsx:184-205`.
  - Shown only when `portal === "vendor" && conv && !isSupport` (not a support thread).
  - Props passed to the modal: `conversationId`, `clientUserId` (the peer) and `quotePrefill`. Read where `quotePrefill` comes from.
- Modal: `frontend/features/vendor/quotes/VendorQuoteFormModal.tsx` (301 lines). Port it **field by field**:
  - labels, placeholders, defaults, min/max, date handling;
  - validation messages, exactly;
  - the submit payload keys, exactly;
  - error text: detail, or "Could not send quote.";
  - what happens on success: close, then the quote message appears in the thread (does the baseline refetch the thread, or rely on SSE? do the same);
  - it uses `postVendorQuote` and `fetchVendorProfile`.

## What to build
- A new domain, `web/src/domains/vendor-quotes/` (vendor-only, so it gets the `vendor-` prefix):
  - `api.ts`: `postVendorQuote(body)`.
  - `quoteForm.ts` (+ `quoteForm.test.ts`), pure:
    - `validateQuoteForm(values) -> Record<field, message>` with the baseline messages;
    - `buildQuotePayload(values, { conversationId, clientUserId }) -> CreateVendorQuoteBody`.
    - The price is entered by the vendor in pounds; convert exactly as the baseline does (check whether the body wants pence or pounds; `schema.d.ts` says).
  - `VendorQuoteFormModal.tsx`: the dialog. There's no Modal in foundation; build it on the `ConfirmDialog` pattern (focus trap, Esc, `role="dialog"`, `aria-modal`). Keep it in this domain file, not in foundation.
- Hooking it into the thread without breaking tiers: `domains/messages` must not import `domains/vendor-quotes`.
  - Add an optional `threadActions?: ReactNode` prop (or a render prop receiving `{conversationId, peerUserId, kind}`) to `ConversationThreadView`, rendered where the baseline puts the button.
  - The vendor message thread **page** in `web/src/app/vendor/(portal)/messages/[conversationId]/page.tsx` composes the two: it passes a `SendQuoteButton` from `vendor-quotes`, shown only when the conversation isn't a support thread (mirror the baseline's `!isSupport` check with the field web has, `conversation.kind`).
  - If the page doesn't have the conversation yet, pass a render prop so the thread view hands over what it loaded.

## Tests
`quoteForm.test.ts`:
- each validation message, literal;
- the payload's key set is exactly the baseline's;
- pounds to the body's unit, e.g. "150.50" → 15050 if it's pence;
- a missing optional field is left out or null, exactly as the baseline does.

## Allowed paths
- `web/src/domains/vendor-quotes/**`
- `web/src/domains/messages/ConversationThreadView.tsx` (the slot prop only)
- `web/src/app/vendor/(portal)/messages/**`

## Browser check
As a local vendor with a client conversation (:3001 → :8001):
1. Send a quote. The quote card appears in the thread, and the client sees it in `/client/messages/<id>`.
2. Try a support thread: there's no button.

## Commit
`web: vendor send quote from chat (ws14)`
