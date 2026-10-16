Task: ws14 client portal, piece 4 (dashboard).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/dashboard
Baseline: frontend/app/client/(portal)/dashboard/page.tsx → frontend/features/client/dashboard/
(ClientDashboardView.tsx, useClientDashboard.ts, ClientBookingsCalendarCard.tsx); the
data comes from frontend/lib/clientBookingsApi.ts, chatApi.ts, clientNotificationsApi.ts,
notificationsFeedApi.ts, dateFormat.ts.
API (all in schema.d.ts): GET /api/v1/client/booking-requests, GET /api/v1/chat/unread-count,
GET /api/v1/client/notifications/bookings/unread-count, GET /api/v1/client/notifications/feed.
Pattern: web/src/domains/vendor-dashboard (same kind of page for vendors).
New domain: web/src/domains/client-dashboard. Pure logic to test: the calendar grouping
(bookings by day/month) and any summary counts or status labels the view shows.
Every card, link and empty state the baseline dashboard shows must be there; links may
point at client pages later pieces build (they 404 until then, which is fine).

## Allowed paths
web/src/app/client/(portal)/dashboard/**, web/src/domains/client-dashboard/**,
web/src/domains/client-shell/** (only if the nav needs it).
Commit: "web: client dashboard (ws14)"
