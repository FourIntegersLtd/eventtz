Task: ws14 client portal, piece 9 (help).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/help and /client/help/messages/[conversationId]
Baseline: frontend/app/client/(portal)/help/ (layout.tsx, page.tsx,
messages/[conversationId]/page.tsx) → frontend/features/help/ (HelpHubView.tsx,
HelpCenterView.tsx, HelpCategoryView.tsx, HelpArticleView.tsx, HelpArticleBody.tsx,
HelpAssistantThread.tsx, helpContent.ts, helpContent.test.ts), frontend/lib/helpHub.ts,
helpApi.ts. The baseline's HelpHubView takes `portal: "client" | "vendor"`.
API: GET /api/v1/help/categories, GET /api/v1/help/articles, GET /api/v1/help/articles/{slug},
POST /api/v1/help/ask, and the chat conversation endpoints for support threads.
Share it: move web/src/domains/vendor-help to web/src/domains/help with a portal prop,
point web/src/app/vendor/(portal)/help/** at it, add the client routes, delete the vendor
copy. Tabs, their URLs and query parameters must match the baseline for both portals.
Keep helpFormatting.test.ts passing; port helpContent.test.ts cases not yet covered.
HelpWidget.tsx (the floating widget) is out of scope.

## Allowed paths
web/src/app/client/(portal)/help/**, web/src/app/vendor/(portal)/help/**,
web/src/domains/vendor-help/** (deleted), web/src/domains/help/**,
and files that imported vendor-help (update the import only).
Commit: "web: shared help hub for client and vendor portals (ws14)"
