Task: ws14 client portal, piece 13 (planner).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/planner and /client/planner/[planId]
Baseline: frontend/app/client/(portal)/planner/ (page.tsx, [planId]/page.tsx) →
frontend/features/client/planner/ (AiPlannerView.tsx, PlannerPromptHero.tsx,
BudgetBreakdown.tsx, CelebrationSummary.tsx, ConfidenceBadge.tsx, PlannerBookNowButton.tsx,
PlannerNextSteps.tsx, RecommendationSection.tsx, plannerCopy.ts, plannerModel.ts,
plannerModel.test.ts, useGeneratePlan.ts), frontend/lib/clientPlannerApi.ts,
planner-messages.ts, clientEventsApi.ts.
API: GET/POST /api/v1/client/planner/plans, GET /api/v1/client/planner/plans/{plan_id},
POST .../{plan_id}/archive, POST .../{plan_id}/ensure-event,
POST .../{plan_id}/items/{need_id}/replace, GET /api/v1/client/events(/{event_id}).
Plan generation calls the language model and can take a while: match the baseline's
loading and error states, and don't send the request twice on a double click.
New domain: web/src/domains/client-planner. Port plannerModel.test.ts cases; test the
budget maths (integer pence) and copy selection. "Book now" links into
/client/browse with the baseline's query parameters (piece 11 parses them).

## Allowed paths
web/src/app/client/(portal)/planner/**, web/src/domains/client-planner/**.
Commit: "web: client AI planner (ws14)"
