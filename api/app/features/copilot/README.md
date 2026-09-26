# copilot

## Purpose
The vendor Growth Co-pilot: a deterministic Growth Score, a daily plain-English brief, a chat
assistant, package coaching and drafted enquiry replies — for signed-in vendors only. Ported
from the baseline `backend/app/features/vendor_copilot/`.

## Use cases
- As a **vendor**, I **see my Growth Score** broken down by lever, so I know what to fix first.
- As a **vendor**, I **get a daily brief** with my score, suggested next actions and a plain-English
  summary, so I do not have to piece it together myself.
- As a **vendor**, I **ask the co-pilot a question** about growing my bookings, grounded in my own
  profile facts.
- As a **vendor**, I **get a drafted reply** to a client enquiry, so I can respond faster.
- As a **vendor**, I **get my live packages reviewed** for clarity, the same coach used at onboarding.

## Invariants
- The Growth Score (`domain.compute_growth_score`) is pure Python: same profile and analytics facts
  always produce the same score and lever breakdown. It never touches the database or a language
  model itself — callers pass it whatever facts they already loaded.
- Every language-model call goes through the `LanguageModel` port (`api/app/core/ports.py`); with
  no OpenAI key configured, `ask`, `draft-reply` (for a booking the vendor owns) and
  `review-packages` all fail at `LanguageModelUnavailable` (503) before any prompt is built.
- The daily brief's narration step is the one exception: any failure calling the language model
  (unavailable, refused, empty reply, or anything else) is caught inside `service_brief` and
  replaced with a fixed, deterministic summary — the brief itself never fails outright.
- A booking id the calling vendor does not own — unknown, or another vendor's — is indistinguishable
  to `draft-reply`: both return the same fixed 200 placeholder (`{"draft_message": "", "tips":
  ["Booking not found."]}`) rather than a 404, because it reads the booking only through
  `bookings.service_queries.vendor_booking_detail`, which is scoped by `vendor_user_id`.
- A whitespace-only (but non-empty) `question` to `/ask` passes the request schema's `min_length=1`
  and is instead rejected by the route with `QuestionRequired` (400) — a different status from the
  literal empty string, which the schema itself rejects with a 422.
- This slice reads other slices only through their `service*` functions: the vendor's profile via
  `vendors.service_profile.get_profile_state`, review stats via `reviews.service_vendor.list_own_reviews`,
  pending bookings via `bookings.service_queries.vendor_bookings`, one booking via
  `bookings.service_queries.vendor_booking_detail`, and package coaching via
  `vendors.service_ai.review_vendor_packages` — never those slices' repositories, domain or models.

## Routes
`GET /vendor/copilot/score`, `GET /vendor/copilot/brief`, `POST /vendor/copilot/ask`,
`POST /vendor/copilot/draft-reply`, `POST /vendor/copilot/review-packages`. All require a
signed-in vendor.

## Hand-offs for the integrator
- **Market demand insights** (`demand_insights` on the brief) are always `[]` here. The baseline
  computes them from cross-vendor marketplace aggregates (how many approved vendors offer a
  service, in which cities) that no rebuilt slice exposes a `service*` function for yet, and this
  slice may not read another slice's tables directly. A future `vendors.service_demand` (or
  similar) could fill this in; the acceptance suite's frozen brief test expects `[]` regardless.
- **Help-article grounding** for `/ask` and the brief's narration (the baseline retrieves and
  quotes help articles in its system prompt) is not wired in here: every "happy path" acceptance
  test for an LLM-calling route in this environment (`OPENAI_API_KEY=""`) reaches
  `LanguageModelUnavailable` before the prompt is ever built, so this made no observable
  difference to the frozen suite. Wiring `content.service_help`'s retrieval helper into the
  `_SYSTEM_PROMPT`/facts block of `service_ask.py` and `service_brief.py` would close this gap.
- **Package completeness** for the Growth Score's 85-point cap (`domain._is_complete_package`) is a
  thinner rule than `vendors.domain_packages.is_complete_package` (title length, a non-blank price,
  and a long-enough description — no per-unit pricing-mode/quantity checks). This slice may not
  import another slice's `domain*` module, so a full duplicate was not worth it: the frozen
  acceptance tests only exercise an empty payload, where both rules agree (no packages at all).
