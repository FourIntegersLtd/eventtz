# Slice 7b — Comms + realtime (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 7b](../FEATURE_TRACK.md#slice-7b--comms--realtime)

### User story

Clients and vendors message each other, receive in-app notifications (and transactional emails), contact support, and see live updates via SSE.

### Complete route

1. `frontend/lib/useRealtimeSse.ts` + `realtimeHooks.ts`
2. `backend/app/features/realtime/sse.py`
3. `frontend/features/notifications/NotificationBell.tsx` + `NotificationsPageView.tsx`
4. `backend/app/features/notifications/`
5. `frontend/app/client/(portal)/messages/page.tsx` + `[conversationId]/page.tsx`
6. `frontend/features/chat/ChatPortalView.tsx`, `ChatThreadView.tsx`, `ChatDrawer.tsx`
7. `backend/app/features/chat/http/routes.py` + `service.py`
8. `frontend/features/contact/ContactFormView.tsx`
9. `backend/app/features/contact/http/routes.py`
10. `backend/app/features/email/dispatch.py`

### Key concepts

- SSE drives refresh without full page reload
- Chat tied to `conversation_id` on bookings
- Email is server-dispatched, not a user inbox
