Task: ws14 client portal, piece 8 (messages).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/messages and /client/messages/[conversationId]
Baseline: frontend/app/client/(portal)/messages/ (layout.tsx, page.tsx,
[conversationId]/page.tsx) → frontend/features/chat/ (ChatPortalView.tsx, ChatThreadView.tsx,
MessageComposer.tsx); frontend/lib/chatApi.ts. The baseline uses the SAME chat view for
vendors and clients.
API: GET/POST /api/v1/chat/conversations, GET /api/v1/chat/conversations/{conversation_id},
GET/POST .../{conversation_id}/messages, POST .../{conversation_id}/read,
GET /api/v1/chat/unread-count.
Share it: move web/src/domains/vendor-messages to web/src/domains/messages with a portal
prop (for links such as /vendor/messages/… vs /client/messages/…), point
web/src/app/vendor/(portal)/messages/** at it, add the client routes, delete the vendor
copy. Keep its realtime-stream wiring as it is. Keep messageFormatting.test.ts passing
and add cases for anything portal-specific.

## Allowed paths
web/src/app/client/(portal)/messages/**, web/src/app/vendor/(portal)/messages/**,
web/src/domains/vendor-messages/** (deleted), web/src/domains/messages/**,
and any other file that imported vendor-messages (update the import only).
Commit: "web: shared messages for client and vendor portals (ws14)"
