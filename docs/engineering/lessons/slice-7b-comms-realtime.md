# Slice 7b — Comms + realtime

### User story

A **signed-in client or vendor** receives live UI updates without refreshing the page: new chat messages bump unread badges, booking status changes refresh the dashboard, and notification rows appear in the bell dropdown. They open **Messages** under the Help hub to DM vendors/clients (or Eventtz support), submit a **contact form** for async team help, and receive **transactional emails** (booking updates, receipts) dispatched server-side — not a user-facing inbox.

**Prerequisites:** Slice 1 (auth + `AuthProvider`), Slice 7a (dashboard subscribes to refresh events).

---

## What comms + realtime does

```typescript
// AuthProvider opens one SSE stream per signed-in user
useRealtimeSse(user?.id);

// SSE event → in-app bus → debounced refetch
es.addEventListener("booking_changed", () => realtimeBus.emit("bookings:refresh"));
useRealtimeRefresh(["bookings:refresh"], () => void load(), [load]);
```

| Piece | Role |
|--------|------|
| `useRealtimeSse` | Browser `EventSource` on `/api/realtime/stream` |
| `realtimeSseProxy.ts` | Next.js proxy — forwards session cookies to FastAPI |
| `realtime/sse.py` | In-process broadcaster; `notify_user` from backend mutations |
| `realtimeBus` | Frontend pub/sub — decouples SSE from feature hooks |
| `useRealtimeRefresh` | Debounced refetch on bus events |
| `NotificationBell` | Top-bar dropdown; opening marks booking notifications read |
| `NotificationsPageView` | Full history at `/client/notifications` or `/vendor/notifications` |
| `ChatPortalView` | Master-detail inbox under Help → Messages |
| `chatApi.ts` | Conversations, messages, unread count |
| `ContactFormView` | Signed-in contact form → admin email |
| `email/dispatch.py` | In-app notification + Resend email for booking lifecycle |

Plain English: the backend never pushes full rows over SSE — it sends **tiny event names** (`booking_changed`, `chat_unread_changed`). The frontend hears them and **refetches** via existing signed-in APIs. Email is a **parallel channel** for participants who are offline.

---

## What happens at a glance

```
App boot → AuthProvider → useRealtimeSse(userId)
    → EventSource("/api/realtime/stream")
        → Next.js route proxies to FastAPI GET /api/v1/realtime/stream
            → require_user → register per-user asyncio.Queue
            → yield "connected" + keepalive comments every 15s

Backend mutation (e.g. booking accepted)
    → insert_booking_notification + notify_user(client_id, "booking_notifications_changed")
    → notify_user(vendor_id, "booking_changed")
    → SSE queue receives RealtimeEvent
    → Browser EventSource fires custom event
    → useRealtimeSse maps to realtimeBus.emit("bookings:refresh")
    → useClientDashboard debounced reload

Chat message sent
    → postMessage → handlers.post_message
    → notify_user(peer, "chat_unread_changed")
    → ChatPortalView / ChatThreadView refetch via useRealtimeRefresh

Contact form submitted
    → submit_contact_message → DB row + send_admin_contact_submitted_email
    → (optional) Cursor automation webhook for classified topics

Booking lifecycle email
    → dispatch_booking_notification(kind=...)
        → upsert_booking_notification (in-app)
        → get_email_service().send_booking_notification (Resend)
```

---

## Example: vendor accepts → client sees it live

1. Client has dashboard open; SSE connected via `AuthProvider`.
2. Vendor accepts booking on `/vendor/bookings/{id}`.
3. Backend `dispatch_booking_notification` inserts notification + emails client.
4. `notify_user(client_id, "booking_notifications_changed")` + `notify_user(..., "booking_changed")`.
5. Client browser SSE receives events → bus emits refresh.
6. `useClientDashboard` reloads — attention feed may drop "awaiting vendor" and show new state.
7. Bell badge increments; opening dropdown fetches feed and marks notifications read.

---

## Complete route — realtime SSE

### Frontend

1. `frontend/components/auth/AuthProvider.tsx` — calls `useRealtimeSse(user?.id)` once per session
2. `frontend/lib/useRealtimeSse.ts` — `EventSource` + event listener mapping
3. `frontend/lib/realtimeBus.ts` — `chat:unread_refresh`, `bookings:refresh`, etc.
4. `frontend/lib/realtimeHooks.ts` — `useRealtimeSubscription`, `useRealtimeRefresh`
5. `frontend/app/api/realtime/stream/route.ts` — Next.js GET handler
6. `frontend/lib/realtimeSseProxy.ts` — cookie-forwarding proxy to backend

### Backend

7. `backend/app/features/realtime/http/routes.py` — `GET /realtime/stream`
8. `backend/app/features/realtime/sse.py` — `notify_user`, queue registry, `format_sse`
9. Call sites (non-exhaustive):
   - `backend/app/features/bookings/notifications.py` — `booking_changed`
   - `backend/app/features/notifications/service.py` — `booking_notifications_changed`
   - `backend/app/features/chat/http/handlers.py` — `chat_unread_changed`
   - `backend/app/features/bookings/disputes.py` — `dispute_changed`

---

## Complete route — notifications

### Frontend

1. `frontend/features/notifications/NotificationBell.tsx` — portal shell top bar
2. `frontend/features/notifications/NotificationsPageView.tsx` — full feed page
3. `frontend/lib/notificationsFeedApi.ts` — unified feed fetch
4. `frontend/lib/clientNotificationsApi.ts` — client mark-read + unread count
5. `frontend/lib/vendorNotificationsApi.ts` — vendor equivalents
6. `frontend/app/client/(portal)/notifications/page.tsx`
7. `frontend/app/vendor/(portal)/notifications/page.tsx`

### Backend

8. `backend/app/features/notifications/service.py` — `upsert_booking_notification`, kinds enum
9. `backend/app/features/notifications/feed.py` — assembles feed rows (booking + dispute + chat summary)
10. `backend/app/features/notifications/copy.py` — headline/body per kind + portal
11. `backend/app/features/email/dispatch.py` — `dispatch_booking_notification` (in-app + email)

---

## Complete route — chat

### Frontend

1. `frontend/app/client/(portal)/help/messages/page.tsx` — client inbox index
2. `frontend/app/client/(portal)/help/messages/[conversationId]/page.tsx` — thread
3. `frontend/app/vendor/(portal)/help/messages/page.tsx` — vendor inbox
4. `frontend/app/vendor/(portal)/help/messages/[conversationId]/page.tsx`
5. `frontend/features/chat/ChatPortalView.tsx` — master-detail layout
6. `frontend/features/chat/ChatThreadView.tsx` — messages + composer + quote cards
7. `frontend/features/chat/ChatDrawer.tsx` — booking-detail slide-over thread
8. `frontend/features/chat/MessageComposer.tsx` — send box
9. `frontend/lib/chatApi.ts` — all chat HTTP

### Backend

10. `backend/app/features/chat/http/routes.py` — `/api/v1/chat/*`
11. `backend/app/features/chat/http/handlers.py` — list/create/read/send
12. `backend/app/features/chat/dm.py` — conversation + message persistence
13. `backend/app/features/chat/support_admin.py` — Eventtz support threads

---

## Complete route — contact forms

### Frontend

1. `frontend/features/contact/ContactFormView.tsx` — shared client/vendor form
2. `frontend/lib/contactApi.ts` — `submitClientContact`, `submitVendorContact`
3. `frontend/lib/validation/contactFormSchema.ts` — Zod validation
4. Help hub tabs — `frontend/lib/helpHub.ts` routes Messages + Contact

### Backend

5. `backend/app/features/contact/http/routes.py` — `POST /client/contact`, `/vendor/contact`
6. `backend/app/features/contact/service.py` — persist + classify + notify
7. `backend/app/features/contact/classification.py` — auto subject from message text
8. `backend/app/features/contact/cursor_webhook.py` — optional Cursor automation

---

## Step 1 — SSE connection (frontend)

**File:** `useRealtimeSse.ts` — one stream per **user id** (reconnects on account switch):

```11:25:frontend/lib/useRealtimeSse.ts
export function useRealtimeSse(userId: string | null | undefined) {
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) {
      if (ref.current) {
        ref.current.close();
        ref.current = null;
      }
      return;
    }
    if (typeof window === "undefined") return;

    const es = new EventSource("/api/realtime/stream");
    ref.current = es;
```

SSE event → bus mapping:

```27:44:frontend/lib/useRealtimeSse.ts
    const onChatUnread = () => {
      realtimeBus.emit("chat:unread_refresh");
      realtimeBus.emit("chat:data_refresh");
    };
    const onBookingNotifs = () => {
      realtimeBus.emit("booking_notifications:refresh");
    };
    const onBookingChanged = () => {
      realtimeBus.emit("bookings:refresh");
    };
    const onDisputeChanged = () => {
      realtimeBus.emit("disputes:refresh");
    };

    es.addEventListener("chat_unread_changed", onChatUnread as EventListener);
    es.addEventListener("booking_notifications_changed", onBookingNotifs as EventListener);
    es.addEventListener("booking_changed", onBookingChanged as EventListener);
    es.addEventListener("dispute_changed", onDisputeChanged as EventListener);
```

**Mounted in AuthProvider** — every authenticated portal page gets SSE:

```85:85:frontend/components/auth/AuthProvider.tsx
  useRealtimeSse(user?.id);
```

---

## Step 2 — Next.js proxy (cookies)

Browser `EventSource` cannot set custom headers; auth relies on **session cookies**. The frontend hits same-origin `/api/realtime/stream`; Next.js forwards cookies to FastAPI:

```4:15:frontend/lib/realtimeSseProxy.ts
/** Same-origin SSE proxy so auth cookies reach FastAPI (see `app/api/realtime/stream/route.ts`). */
export async function proxyRealtimeSse(request: Request): Promise<Response> {
  const backendBase = getBackendBaseUrl();
  const cookie = request.headers.get("cookie") ?? "";

  const upstream = await fetch(`${backendBase}/api/v1/realtime/stream`, {
    headers: {
      Accept: "text/event-stream",
      Cookie: cookie,
    },
    cache: "no-store",
  });
```

Route wrapper:

```1:7:frontend/app/api/realtime/stream/route.ts
import { proxyRealtimeSse } from "@/lib/realtimeSseProxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyRealtimeSse(request);
}
```

---

## Step 3 — Backend SSE stream

**File:** `realtime/http/routes.py` — per-user queue, keepalive, cleanup:

```26:52:backend/app/features/realtime/http/routes.py
@router.get("/stream")
async def realtime_stream(request: Request, response: Response) -> StreamingResponse:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    loop = asyncio.get_running_loop()
    register_loop(loop)

    q: asyncio.Queue[RealtimeEvent] = asyncio.Queue(maxsize=50)
    register_user_queue(uid, q)

    async def gen() -> AsyncIterator[str]:
        try:
            # Initial ping so the client knows we're connected.
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Keepalive comment (doesn't trigger an event handler).
                    yield ": keepalive\n\n"
                    continue
                yield format_sse(evt)
        finally:
            unregister_user_queue(uid, q)
```

**Broadcaster** — thread-safe push from sync booking/chat code:

```45:61:backend/app/features/realtime/sse.py
def notify_user(user_id: str, event: str, data: dict | None = None) -> None:
    """Thread-safe push to all connected live-update clients for a user."""
    qs = _queues_by_user.get(user_id)
    if not qs:
        return
    payload = RealtimeEvent(event=event, data=data or {})
    loop = _loop
    if loop is None:
        return

    for q in list(qs):
        try:
            loop.call_soon_threadsafe(q.put_nowait, payload)
        except Exception:
            continue
```

Design note (module docstring): **no row streaming** — only event names; frontend refetches.

---

## Step 4 — Debounced refresh hooks

**File:** `realtimeHooks.ts` — coalesce burst SSE events (200ms default):

```22:44:frontend/lib/realtimeHooks.ts
export function useRealtimeRefresh(
  events: RealtimeBusEvent | RealtimeBusEvent[],
  refresh: () => void,
  deps: unknown[],
  opts?: { debounceMs?: number },
) {
  const debounceMs = opts?.debounceMs ?? 200;
  ...
  useRealtimeSubscription(
    events,
    () => {
      ...
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        refresh();
      }, debounceMs);
    },
    deps,
  );
```

**Consumers include:**
- `useClientDashboard` — `bookings:refresh`, `chat:unread_refresh`, `booking_notifications:refresh`, `disputes:refresh`
- `ChatPortalView` / `ChatThreadView` — `chat:data_refresh`
- `NotificationsPageView` — `booking_notifications:refresh`
- `BookingDisputeSection` — `disputes:refresh` (with 50s poll fallback)

---

## Step 5 — Notification bell + feed

**Bell behaviour** — opening dropdown is the explicit **mark-as-read** action (replaces silent auto-read on page visit):

```33:37:frontend/features/notifications/NotificationBell.tsx
/**
 * Top-bar bell + dropdown. Opening the dropdown is the explicit, visible
 * "mark as read" action for booking notifications - replacing the previous
 * silent auto-mark-read-on-page-visit side effect.
 */
```

On open: fetch feed → `markAllClientBookingNotificationsRead` / vendor equivalent → `onMarkedRead()` refreshes portal shell badge.

**Feed kinds** (`NotificationFeedItem`):

| Kind | Icon | Typical source |
|------|------|----------------|
| `booking_update` | Calendar | `booking_notifications` table |
| `dispute_update` | Shield | Dispute status change |
| `chat_unread_summary` | Message | Aggregated unread (not duplicated in dashboard attention) |

**Full page** — `NotificationsPageView` mirrors dropdown behaviour on mount (fetch + mark all read) and subscribes to `booking_notifications:refresh`.

**Backend insert** — every upsert triggers SSE:

```python
# notifications/service.py (pattern)
notify_user(user_id, "booking_notifications_changed")
```

---

## Step 6 — Chat inbox + thread

**API surface** (`chatApi.ts`):

```38:84:frontend/lib/chatApi.ts
export async function fetchChatUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread_count: number }>(
    `${chatPrefix()}/unread-count`,
  );
  return data.unread_count ?? 0;
}
...
export async function postMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data } = await api.post<{ message: ChatMessage }>(
    `${chatPrefix()}/conversations/${conversationId}/messages`,
    { body },
  );
  return data.message;
}

export async function postConversationRead(conversationId: string): Promise<void> {
  await api.post(`${chatPrefix()}/conversations/${conversationId}/read`);
}
```

**Routes** — shared client + vendor router:

```24:34:backend/app/features/chat/http/routes.py
@router.get("/unread-count", response_model=ChatUnreadCountResponse)
def get_chat_unread_count(request: Request, response: Response) -> ChatUnreadCountResponse:
    user = require_user(request, response)
    return h.chat_unread_count(str(user.get("id") or ""))

@router.get("/conversations", response_model=ConversationsListResponse)
def list_conversations(request: Request, response: Response) -> ConversationsListResponse:
    user = require_user(request, response)
    return h.list_conversations(user)
```

**ChatPortalView** — master-detail; mobile shows one pane via `MasterDetailLayout`. Empty inbox links to Contact tab.

**ChatThreadView** — loads conversation + messages; marks read on mount; `useRealtimeRefresh(["chat:data_refresh"], load)`. Vendor portal can open `VendorQuoteFormModal` to send a quote card (`metadata.kind === "quote"`).

**ChatDrawer** — embedded in booking detail (Slice 3b/5) with `variant="drawer"`.

**Conversation creation** — `postConversation(peerUserId)` ensures DM thread between client/vendor pair. Bookings may store `conversation_id` when quote originated in chat.

**Support threads** — `kind: "support"` conversations with Eventtz staff; admin replies via `/admin/messages` (Slice 7c).

---

## Step 7 — Contact form

**Frontend submit:**

```33:60:frontend/features/contact/ContactFormView.tsx
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    ...
    const body = {
      message: parsed.data.message,
      booking_id: booking,
    };
    if (role === "client") {
      await submitClientContact(body);
    } else {
      await submitVendorContact(body);
    }
    track(MixpanelEvents.contact_form_submitted, { role });
    ...
    showToast({
      tone: "success",
      title: "Message sent",
      description: "We'll get back to you by email as soon as we can.",
    });
```

**Backend** — validate, classify subject, persist, email admins:

```23:40:backend/app/features/contact/service.py
def submit_contact_message(
    *,
    user_id: str,
    portal: str,
    message: str,
    booking_id: str | None = None,
    subject: str | None = None,
) -> dict[str, Any]:
    body = message.strip()
    if len(body) < 10:
        raise ValueError(contact_messages.MESSAGE_TOO_SHORT)
    ...
    else:
        subj = classify_contact_message(portal=portal, message=body)
```

Optional `booking_id` validated against `booking_requests` party membership. Admin bug reports use fixed subject via `POST /admin/contact`.

Contact is **async** — distinct from real-time chat. Users should use Messages for vendor/client DMs and Contact for Eventtz team escalations.

---

## Step 8 — Email dispatch trace

**Entry point** — `dispatch_booking_notification` (in-app + email):

```68:92:backend/app/features/email/dispatch.py
def dispatch_booking_notification(
    *,
    user_id: str,
    booking_id: str,
    kind: BookingNotifyKind,
    body: str | None = None,
    mode: NotifyMode = "upsert",
    portal: Portal | None = None,
    event_name: str | None = None,
    send_email: bool = True,
) -> None:
    """Create the in-app notification and send the participant email when email is configured."""
    if mode == "insert_if_absent":
        insert_booking_notification_if_absent(...)
    else:
        upsert_booking_notification(
            user_id=user_id,
            booking_id=booking_id,
            kind=kind,
            body=body,
        )
```

Email path (after in-app row):

1. `_load_booking_parties(booking_id)` — client + vendor ids
2. `_portal_for_user` — resolve client vs vendor portal for CTA link
3. `user_emails_by_id` — skip if no address
4. `format_booking_notification(kind, portal, event_name)` — headline + body from `notifications/copy.py`
5. `get_email_service().send_booking_notification(...)` — Resend template with `action_url` to booking detail

**Receipt emails** — `dispatch_receipt_email` after payment (Slice 4); maps `document_type` → template kind.

**Admin emails:**
- `send_admin_contact_submitted_email` — contact form
- `send_admin_dispute_opened_email` — new dispute case

**Important:** Email failure does not roll back in-app notifications. Both channels are best-effort; SSE delivers the in-app path in real time.

### Dispatch call graph (simplified)

```
booking accept/decline/pay/complete/cancel
    → bookings/*.py handler
    → dispatch_booking_notification(kind="booking_accepted", ...)
        → upsert_booking_notification → notify_user(..., "booking_notifications_changed")
        → Resend send_booking_notification

payment finalize (Slice 4)
    → dispatch_payment_receipts_after_checkout
        → dispatch_receipt_email per party

dispute opened
    → send_admin_dispute_opened_email
    → notify_user(parties, "dispute_changed")
```

---

## SSE event map

| SSE event name | Bus event(s) | Typical subscriber |
|----------------|--------------|-------------------|
| `connected` | (none) | Connection handshake |
| `chat_unread_changed` | `chat:unread_refresh`, `chat:data_refresh` | Inbox, thread, dashboard |
| `booking_notifications_changed` | `booking_notifications:refresh` | Bell, notifications page |
| `booking_changed` | `bookings:refresh` | Dashboard, booking lists |
| `dispute_changed` | `disputes:refresh` | Dispute section, admin |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| SSE stream | `require_user` — any signed-in role |
| Chat APIs | `require_user` — participant check in handlers |
| Contact | `require_client` / `require_vendor` |
| Notification feed | Portal-specific client/vendor routes |
| Email | Server-side only — no user-triggered send except contact |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `contact_form_submitted` | Contact form success |
| Chat send | (no toast by convention — implicit OK) |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Dashboard never auto-refreshes | `AuthProvider` — is `useRealtimeSse` running? Network tab: `/api/realtime/stream` |
| SSE 502 | `realtimeSseProxy.ts` — backend down or `getBackendBaseUrl()` wrong |
| SSE connects but no events | Backend mutation missing `notify_user` call |
| Events after account switch | `useRealtimeSse` must key on `userId`, not boolean |
| Bell badge stuck | Portal shell unread vs dropdown mark-read; `onMarkedRead` callback |
| Chat not live-updating | `ChatThreadView` — `useRealtimeRefresh` on `chat:data_refresh` |
| Messages empty | `fetchConversations` — user may have no DMs yet; start from booking or browse |
| Contact 400 | Message &lt; 10 chars or invalid `booking_id` UUID |
| Email not received | `SENTRY_DSN`-style: empty Resend config skips send; check backend logs |
| Duplicate notification rows | `insert_booking_notification_if_absent` vs `upsert` mode |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| SSE → bus → debounced refetch | **Leave it alone** — avoids pushing stale row shapes |
| Next.js cookie proxy for SSE | **Leave it alone** — required for session auth |
| Mark-read on bell open (not page visit) | **Leave it alone** — explicit user intent |
| In-app + email dual dispatch | **Leave it alone** — offline users need email |
| 15s SSE keepalive comments | **Leave it alone** — prevents proxy timeouts |

---

## Key concepts from this slice

- **Notify, don't stream** — SSE carries event names; clients refetch via REST.
- **Cookie proxy** — `/api/realtime/stream` forwards auth to FastAPI.
- **`realtimeBus`** — decouples one SSE connection from many feature hooks.
- **Debounced refresh** — burst events coalesce to one refetch.
- **Bell mark-read** — opening dropdown clears unread (visible action).
- **Chat ≠ contact** — DMs are realtime; contact form is async team ticket.
- **Email dispatch** — server-side Resend; parallel to in-app notifications.

---

## Out of scope (footnotes)

- **Help center** content pages — static/MDX help articles, not covered here.
- **Vendor copilot** (`VendorListingOptimizerPanel`) — AI listing suggestions; separate from client planner.

---

## TL;DR

- **SSE** = `useRealtimeSse` → `/api/realtime/stream` proxy → `GET /api/v1/realtime/stream`.
- **Refresh** = `notify_user` → browser event → `realtimeBus` → `useRealtimeRefresh`.
- **Notifications** = bell dropdown + `/client/notifications`; mark-read on open.
- **Chat** = Help → Messages; `chatApi` + `ChatPortalView` / `ChatThreadView`.
- **Contact** = async form → `submit_contact_message` → admin email.
- **Email** = `dispatch_booking_notification` → in-app row + Resend.
- **Next:** Slice 7c — trust, onboarding, admin console.

---

## Related lessons

- Slice 1: `slice-1-auth-me.md` (`AuthProvider`, session cookies)
- Slice 7a: `slice-7a-client-workspace.md` (dashboard SSE consumer)
- Slice 4: `slice-4-client-payment.md` (`dispatch_receipt_email`)
- Slice 7c: `slice-7c-trust-and-admin.md` (admin messages, disputes)
