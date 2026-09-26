# planner

## Purpose
A client's events (celebrations such as a wedding or a birthday), the AI-assisted
celebration plans that recommend vendors for one, and the bookings that hang off
either. Client events live in this slice (not a separate one) because a plan's
whole job is to become an event: keeping them together let `ensure-event` and
the plan detail's `client_event_id` stay a single-slice concern, with no
cross-slice service call needed to link the two.

## Use cases
- As a **client**, I **describe a celebration in a few words** and get back a plan:
  a budget-costed shortlist of vendors, one per need (catering, photography, …).
- As a **client**, I **list my plans** and open one to see its full detail.
- As a **client**, when a vendor pick doesn't suit me, I **ask for the next
  alternative** for that one need.
- As a **client**, I **turn a plan into a real event** once I'm happy with it,
  so I can start sending booking requests against it.
- As a **client**, I **archive a plan** I've abandoned; it stays readable but
  drops off my list.
- As a **client**, when I **send a booking request**, it is filed under the
  event I picked, or under a new event made from the request's name, dates and
  venue (`service_bookings.resolve_event_for_booking`, used by `bookings`).
- As a **client**, I **list and open my events** to see their bookings' counts.

## Invariants
- A client can only see, archive or turn into an event their own plans; a plan
  id that exists but belongs to someone else reads as not-found, never forbidden
  (so a guess reveals nothing).
- `GET`/list never recompute a plan's `why_selected` or `summary` - they echo the
  stored columns. The one exception is a need's `cost_assumption`, which is
  stored inside that item's `score_breakdown` at creation/replace time so a later
  read can also just echo it; only a plan written before that field existed
  falls back to a fresh `estimate_need_cost` call. The budget line's *amounts*
  are always the stored `estimated_cost_gbp` values, but the *breakdown* (total,
  remaining, allocated shares) is always recomputed from only the needs present
  on the plan - never a stale total from creation time.
- A plan's confidence score/reasons are stored at creation and echoed verbatim,
  unless a recommended vendor has since become unlisted (`unavailable: true`),
  in which case confidence is recomputed so it never overstates a plan that has
  gone stale.
- A prompt that is blank is `describe_celebration`; one with no letters at all is
  `invalid_prompt`; one that reads as a single vendor search (not a multi-vendor
  celebration) is `simple_intent` - the classification is delegated to
  `marketplace.service_search.parse_query` (a cross-slice `service` call) so a
  plain "photographers in Bristol" is redirected the same way a marketplace
  search would read it, rather than this slice inventing its own classifier.
- Vendor prices always come from the vendor's own listing (`payload`), never
  from anything the client typed, matching the marketplace-wide rule.
- A plan/event's `status` is `active` or `archived` (the migration's CHECK); an
  archived plan cannot be turned into an event or have an item replaced.

## Simplifications from the baseline (documented, not hidden)
- **No `VendorRankingEngine`.** The baseline scores the whole vendor pool on
  reviews, completed bookings, response time and conversion rate, all of which
  default to a neutral signal for a vendor with no history. This slice's
  `domain.rank_candidates` keeps only the two signals a fresh vendor actually
  has: location fit and budget fit, plus a small keyword bonus - the same
  simplification `explore_vendor_adapter.filter_candidates_for_need` already
  made once no acceptance test exercised the fuller engine's scoring
  (Laziness protocol: no layer without a second real caller).
- **Every language-model call goes through `core.ports.LanguageModel`,** with a
  deterministic template/regex fallback for every one of them (brief
  extraction, "why this vendor"), so the feature degrades to something
  sensible - never a 500 - when no model is configured. Intent classification
  reuses `marketplace.service_search.parse_query`'s own model call instead of
  making a second one, since that call already answers "is this a plan or a
  simple search" for marketplace search.
- **No double-submit dedupe.** The baseline kept an in-memory guard against a
  client double-clicking "create plan"; nothing in this rebuild's acceptance
  suite exercises it, and a duplicate plan costs the client nothing but has to
  be spotted and archived, so it was dropped rather than carried over unused.
- **Money stays GBP floats, not integer pence**, in `celebration_plans`/
  `celebration_plan_items` (matching the baseline schema verbatim) - the
  `AGENTS.md` integer-pence rule is a `domain.py` rule for slices that mint new
  money columns; this slice's schema, and its numbers, are a byte-exact port of
  what the baseline already stored.

## Testing note (api-level, not acceptance)
`acceptance/test_planner.py` cannot exercise a successful `POST /plans` or a
successful item replace: the acceptance harness has no way to inject a fake
language model into the api process it starts, and without a reachable OpenAI
client the token-only classifier always answers `mode="simple"`, so every
prompt there is rejected before a plan is ever built (see that file's module
docstring). The happy paths - a full plan generation and an item replace - are
instead covered by `api/tests/http/test_planner_generation.py`, which injects
`tests.support.fakes.FakeLanguageModel` through `app.dependency_overrides`,
never `patch("app.…")`.

## Routes
- `POST /client/planner/plans` - describe a celebration, get a plan back.
- `GET /client/planner/plans` - the client's own active plans.
- `GET /client/planner/plans/{plan_id}` - one plan in full.
- `POST /client/planner/plans/{plan_id}/archive` - archive a plan.
- `POST /client/planner/plans/{plan_id}/ensure-event` - turn a plan into a client event.
- `POST /client/planner/plans/{plan_id}/items/{need_id}/replace` - try the next vendor for one need.
- `GET /client/events` - the client's own events, filterable by status.
- `GET /client/events/{event_id}` - one event in full.
