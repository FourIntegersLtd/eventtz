---
paths:
  - "api/app/features/{marketplace,planner}/**"
  - "api/tests/**/test_planner_*.py"
  - "api/tests/golden/test_marketplace_goldens.py"
  - "acceptance/test_{marketplace_,planner}*.py"
  - "web/app/client/(portal)/{browse,dashboard,favorites,planner}/**"
  - "web/features/marketplace/**"
  - "web/features/client/{browse,dashboard,onboarding,planner}/**"
  - "web/features/admin/marketplace/**"
  - "web/lib/{clientExploreApi,clientFavoritesApi,clientEventsApi,clientOnboardingApi,clientPlannerApi,planner-messages,marketplaceVendorMatch,marketplaceSearchParams,photonLocationAutocomplete}*"
---
# Marketplace and planner: what to know

Owner: `marketplace-owner`. Proof: `verify-marketplace`. Review: `quality-reviewer` always.

- **Public vendors only through the visibility helper** `vendors.service_listing`; never a hand-written `approval_status` filter (AGENTS.md, marketplace README). QA vendors show only to the QA clients configured for them.
- **List prices come from `vendors.payload`**, never from anything the client typed. Planner and explore both obey this.
- **Only GB is an enabled market**: any other `country` quietly becomes GB, an unknown `sort` falls back to `relevance`. Read market config, never hardcode `GB`, `£` or "UK" in new code (`docs/domain-rules.md` Markets).
- **Search parsing degrades, never 500s**: the model's reading is sanitised, and any failure falls back to the query's words (`mode=simple`). Every language-model call goes through `core.ports.LanguageModel` with a deterministic fallback; tests use the fake from `tests/support/fakes.py`.
- **Do not pass every vendor id into one query.** The baseline did (`in.(...)` returned 414 at a few hundred vendors); read the pool in one SQL query.
- **Funnel events never break the request** that records them. An enquiry is a `booking_requests` row with `initiator='client'`. `celebration_plan_*` events are not recorded (the table CHECK rejects them).
- **Baseline quirks are pinned on purpose** (explore rows carry the vendor email, address lookup is off and resolve is always 404, public reviews answer for any vendor id). Change one only with its `acceptance/` test.
- **Favorites**: `PUT` idempotent, unknown id returns 200 `{"success": false}`, `DELETE` of a never-saved id succeeds, `merge` caps at 500 ids.
- **Planner ownership**: someone else's plan id reads as not-found, never forbidden. Archived plans cannot become events or have an item replaced; archived detail stays readable.
- **Planner echoes stored text** (`why_selected`, `summary`, `cost_assumption`); only replace-item recomputes, and it excludes the item's current vendor. Budget bands are recomputed from the plan's own needs.
- **`ensure-event` is idempotent**: repeat calls return the same `client_events.id`; archived plans are `PLAN_ARCHIVED`.
- **Analytics money stays in pounds as stored**; vendor analytics counts only client-initiated bookings, `days` 7 to 365.
- **Web**: screens change only to fix them; `marketplaceSearchParams` keeps `country` out of the URL when GB; use `formatMoney(amount, currency)`, not raw `£`. Mutations need toast feedback (`web/UI-CONVENTIONS.md`).
- **Guards that apply**: `test_slices_call_services_only`, `test_sql_lives_in_repositories`, `test_tests_use_fakes` (no `patch("app.…")`), `test_copy_has_no_em_dash`, `test_routes_match_baseline`.

## What a failure looks like here
- A vendor visible to the public that is not listed (hand filter, or QA vendor leaking to a normal client).
- A price, budget or total taken from client input or the plan instead of the vendor's `payload`.
- A search or plan route that returns 500 or an empty page when OpenAI is off, instead of the simple-mode fallback.
- Someone else's plan, event or favourite readable or editable (403 where the contract is 404, or no ownership check).
- A list built from one giant id filter, or filtered in the browser instead of the API.
- A planner read that silently recomputes stored text, so a saved plan changes on reload.
