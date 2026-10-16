Task: ws14 client portal, piece 10 (disputes).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/disputes and /client/disputes/[disputeId]
Baseline: frontend/app/client/(portal)/disputes/ (page.tsx, [disputeId]/page.tsx) →
frontend/features/disputes/ (DisputesPortalPage.tsx, ParticipantDisputesPortalView.tsx,
ParticipantDisputeDetailPanel.tsx), frontend/lib/bookingDisputesApi.ts. The baseline
component takes `role: PortalRole` and serves both portals.
API: GET /api/v1/client/disputes, GET /api/v1/client/disputes/{dispute_id}, and
POST /api/v1/client/booking-requests/{booking_id}/disputes if the baseline opens a
dispute from this page. If the baseline opens it from the booking detail instead, wire
that button in web/src/domains/client-bookings with its own api.ts call (it may not
import domains/disputes).
Share it: move web/src/domains/vendor-disputes to web/src/domains/disputes with a role
prop that picks the client or vendor endpoints and links, point the vendor routes at it,
add the client routes, delete the vendor copy. Keep format.test.ts passing; add tests
for role-specific logic (which endpoint, which actions each side may take).

## Allowed paths
web/src/app/client/(portal)/disputes/**, web/src/app/vendor/(portal)/disputes/**,
web/src/domains/vendor-disputes/** (deleted), web/src/domains/disputes/**,
web/src/domains/client-bookings/** (only the open-dispute button, if needed),
and files that imported vendor-disputes (update the import only).
Commit: "web: shared disputes for client and vendor portals (ws14)"
