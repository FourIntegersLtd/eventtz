# Terms of Service remediation plan

Written 2026-10-17 after an audit of `web/components/compliances/content/*.tsx`
against Add to Event, Poptop, Peerspace, Bark and Togather, and against the UK
Platform-to-Business Regulation (retained EU 2019/1150), the Consumer Contracts
Regulations 2013 and the DMCC Act 2024. The audit findings are summarised in the
chat that produced this file; this document is the work plan.

Principles for every phase:

- The Terms describe what the product does. Where the product and the Terms
  disagree, change one of them in the same PR; never leave a promise the code
  does not keep.
- Every rule that is a number (hours, days, percentages) comes from one Python
  constant or setting, is exposed through the API or a shared TS constant, and is
  rendered into the Terms the way `getBookingServiceFeePercent()` already is.
  No hand-typed numbers in the legal copy.
- Vendors are business users. Anything that changes their terms needs 15 days'
  notice (P2B Art. 3). Consumers need "reasonable notice". So the copy ships in
  one go, the effective date is set 15 days after the vendor email, and the old
  text stays live until then (see Phase 0).
- Help Center articles that describe the same rule change in the same migration.

## Balance: protect Eventtz without pushing vendors away

The protection Eventtz needs comes almost entirely from clauses that cost a
good vendor nothing: the liability cap, the vendor indemnity, chargeback
set-off, the review rules and the held-funds model. The vendor-facing bite sits
in four places, and the plan deliberately takes the gentle option on each:

| Topic | Harsh option (not chosen) | What we do instead |
|---|---|---|
| Vendor cancellations | Fines from held funds, automatic suspension (Peerspace, Poptop) | Private cancellation record, staff review at 2 in 180 days, warning before any action, exceptional circumstances never count. Fines only reconsidered in Phase 3 if the data shows a problem. |
| Circumvention | 12-month ban, loss of held share | 6 months from introduction, mutual with clients, first breach is a warning. Contact details are only revealed after payment anyway, so the code does the real enforcing. |
| Insurance and credentials | Mandatory public liability cover for every vendor, evidence at onboarding | Vendors must hold what the law and their venue require; we recommend public liability cover and show a badge when they upload it; evidence only on request after a complaint. Food registration and hygiene certificate stay required for catering and baking because the law requires them. |
| Payouts | Longer holds for everyone | 48h stays the default. The photography split (Phase 3.1) is set by the vendor inside a range, not imposed. |

Vendor-friendly rules the Terms should say out loud, because they are already
true and worth advertising: no commission; the service fee refund on cancellation
is Eventtz's cost, never the vendor's; a client no-show pays the vendor in full;
an unpaid acceptance stops blocking the vendor's date (Phase 2.1); a vendor who
refuses unsafe conditions is not treated as cancelling; termination comes with
reasons, notice and a chance to fix; and a vendor can answer any review.

Owner key: **S** = Sonnet with a file-by-file prompt, **O** = Opus (design, money,
auth), **L** = solicitor.

---

## Phase 0: versioning and acceptance (prerequisite)

Nothing else can ship fairly until vendors can be told and the acceptance can be
proved. Today no acceptance is recorded at signup and no change-notice mechanism
exists.

| # | Change | Where | Owner |
|---|---|---|---|
| 0.1 | `TERMS_VERSION` constant (date string) in `api/app/core/settings.py`, surfaced on `/me`. | core/settings, identity slice | S |
| 0.2 | `users.terms_accepted_version` + `terms_accepted_at`; written at signup and by a new `POST /api/v1/user/terms/accept`. Alembic revision. | identity slice, alembic | S |
| 0.3 | Web: signup checkbox stores the version; a portal banner asks existing users to accept a newer version. Vendors are blocked from Accept-booking until they accept; clients are blocked at checkout. | web/features/auth, PortalShell | S |
| 0.4 | "Changes to these Terms" clause: consumers get reasonable notice by email; vendors get at least 15 days, may close their account before the effective date, and the previous version stays available at `/compliances/terms-of-service/<version>`. | TermsOfServiceContent | S |

Acceptance check: a new vendor signs up, `terms_accepted_version` equals
`TERMS_VERSION`; bump the constant, the banner appears, accepting clears it.

---

## Phase 1: copy-only fixes (no product change needed)

Everything here describes behaviour the code already has, or is a pure legal
clause. One PR, one reviewer pass by **O** on the money paragraphs.

### 1A. Cancellations and refunds (section 4)

- Replace "before the vendor is paid" with "before the vendor has been paid out
  after the event". Add a plain sentence: "You pay Eventtz at checkout; the
  vendor is paid out after the event."
- Add the date the cancellation presets went live in place of "before this
  policy was introduced".
- Render the tier tables from `domain_cancellation.POLICY_TIERS`,
  `COOLING_OFF_HOURS` and `COOLING_OFF_MIN_DAYS_BEFORE_EVENT` through the API
  (`GET /api/v1/public/policy-constants`, new, cached) instead of typing them.
- New bullet, vendor no-show: "If the vendor does not turn up or does not
  provide the service, report it from the booking. If we agree the vendor did
  not deliver, you get a full refund including the service fee, whatever their
  cancellation policy."
- New bullet, exceptional circumstances: list death or serious illness of a
  party or immediate family, serious injury, severe weather where the authority
  has declared an emergency, government restrictions announced after booking.
  Either side may ask; Eventtz may require evidence; outcome is a full refund
  including the fee and no payout to the vendor. (Mirror: Peerspace "Excused
  Cancellations".)
- New bullet, date changes: "To move the date, agree it with the vendor in
  Messages. The vendor sends a new quote for the new date and cancels the old
  booking, which refunds you in full. If you cancel the old booking yourself,
  your cancellation policy applies." (Replaced by Phase 3.3 when rescheduling
  exists.)
- Repeat the 48-hour reporting window in section 10 and link to it from
  section 4.

### 1B. New section: Reviews (DMCC Act 2024)

Only clients with a completed booking may review, once per booking (true in
`reviews/`). No incentivised, fabricated or vendor-written reviews. Vendors may
not retaliate, offer inducements or contract out of reviews. One factual vendor
response (product exists? if not, say "may be offered"). Eventtz may hide
reviews that are unlawful, abusive, fabricated or off-topic and will not
otherwise remove them on request. Reviews are the client's opinion, not ours.

### 1C. New section: Fees, taxes and receipts

- Clients pay the service fee shown on the vendor card and before payment. State
  whether the fee is VAT-inclusive (**L** to confirm; default: "includes VAT
  where applicable").
- Vendors pay no commission today; Stripe processing fees are borne by Eventtz;
  Stripe Connect payout fees are borne by the vendor (confirm against the Stripe
  account settings; **O**).
- Eventtz issues a payment receipt on the vendor's behalf; the vendor is
  responsible for any VAT invoice and for their own tax.
- Referral discounts: move the fixed £10/£15 tiers out of the Terms and into the
  Referral Policy, rendered from `vendor_referrals/tiers.py`; the Terms link to
  it. Add no-self-referral and abuse clauses to the Referral Policy.

### 1D. New section: Chargebacks and set-off

The code already holds and settles chargebacks
(`payments/service.py` `charge.dispute.*`, `service_payments.hold_for_chargeback`).
State: a card chargeback pauses or reverses the vendor's payout; where the
chargeback relates to the vendor's service, the vendor bears it; Eventtz may
set the amount off against future payouts or invoice it; Eventtz may recover a
refund it has made from the party responsible.

### 1E. Vendor terms (P2B)

Add a "Vendor terms" section or a separate `/compliances/vendor-terms` page
linked from the footer (`web/lib/footerLinks.ts`):

- Grounds for restriction, suspension and termination, in plain language
  (fraud, lapsed credentials, repeated cancellations, safety, legal requirement,
  breach).
- Listing restrictions (the admin `listing_override = hidden`) come with a
  statement of reasons sent to the vendor (Phase 2.2 makes this true).
- Termination by Eventtz: 30 days' notice with reasons, except where law or
  fraud prevention requires immediate action; remediable breaches get a chance
  to fix first.
- Ranking: describe the main parameters of Explore. Today: the client's query
  parsed by a language model into service types and needs, then relevance, with
  optional sort by price or rating; approval and payout verification gate
  listing; no paid placement. Keep this paragraph next to
  `marketplace/domain_search.py` in a comment so both move together.
- Complaints: a vendor can complain by email; we acknowledge within 5 working
  days and reply within 30 days. (Art. 11 exempts small enterprises; adopt it
  anyway, Add to Event does.) Name two mediators only if **L** says we exceed
  the small-enterprise thresholds.
- Data: what vendor data we hold and share with clients (contact details after
  payment, as in the bookings README).
- Subcontracting: the vendor may not substitute another provider without the
  client's consent in Messages and remains liable.
- Circumvention, mutual: define "originated on the Platform", 6 months from
  introduction, applies to clients too; first breach is a written warning,
  repeat is suspension.
- Insurance and credentials: vendors hold whatever the law and their venue
  require; public liability cover is recommended and shown as a badge when
  uploaded; food business registration and the hygiene certificate already
  captured in onboarding stay required for catering and baking; allergen
  information must be accurate; evidence only on request after a complaint;
  lapsed legally-required credentials are grounds for suspension after a chance
  to fix.

### 1F. Client obligations on the day

Access, power, a safe working environment, accurate guest numbers and dietary
information, venue permission for music and catering, parking. A vendor who
refuses unsafe conditions is not treated as cancelling. Extras agreed on the
day must go through a price adjustment before payment or are at the parties'
own risk.

### 1G. General clauses

- Eligibility: 18 or over.
- Consumer cancellation rights: state that date-specific catering and leisure
  bookings fall under regulation 28(1)(h) and the vendor policy applies, plus the
  24-hour cooling-off.
- Liability: cap at the greater of the fees paid to Eventtz in the preceding
  12 months or £100 (**L** to confirm figure); carve out death or personal
  injury by negligence, fraud and anything that cannot be excluded; vendor
  indemnity for their services; 24-month claims limit.
- Damage: client is responsible for damage to vendor equipment by their guests;
  vendor is responsible for damage they cause to the client's property or venue.
- Messages: staff may read booking conversations to resolve disputes and for
  safety (also add to the Privacy Policy section 4).
- Held funds: a vendor share held because Stripe setup is unfinished is paid
  when setup completes; after 12 months of no setup we contact the vendor and
  may refund the client (**L**).

### 1H. Legal Disclaimer and Referral Policy

Bring their "Last updated" dates in line, remove the duplicate liability clause
from the Disclaimer (one place only, in the Terms), and link the Referral Policy
to the new fee section.

Acceptance check for Phase 1: every number in the four compliance pages is
rendered from code; `npm run build` passes; a read-through by **O** against the
bookings, payments, reviews and disputes READMEs finds no promise the code does
not keep.

---

## Phase 2: small product changes the Terms expose

| # | Change | Where | Owner |
|---|---|---|---|
| 2.1 | **Payment deadline on accepted bookings.** New setting `booking_payment_deadline_hours` (default 72 after acceptance, never later than 48 hours before the event). Hourly job expires unpaid accepted bookings to `declined` with `failure_reason = payment_deadline`, freeing capacity, and notifies both sides. Pay-to-confirm reminder already exists at 24h. Terms section 3 states it. | bookings jobs, settings, notifications | O (design), S (build) |
| 2.2 | **Reasons to the vendor on listing restriction.** `set_vendor_listing_override` already stores `listing_override_reason`; send it as a notification + email when state becomes `hidden`, and on `banned`. | vendors/service_moderation, notifications | S |
| 2.3 | **Vendor cancellation record.** Count vendor-initiated cancellations of paid bookings per vendor over 180 days (`cancelled_by`, `cancelled_at`); show on the admin vendor row; auto-flag at 2 for staff review; record is private to staff. Terms: "repeated cancellations without good reason may lead to a warning and then suspension". No automatic fines, no public cancellation rate. | bookings repository_admin, staff slice | S |
| 2.4 | **Vendor no-show dispute outcome.** Add `resolution_action = vendor_no_show` to the disputes money branch: full refund including the service fee, no payout, cancellation record incremented. Golden test for the pence split. | disputes/service_admin, bookings/service_payments | O |
| 2.5 | **Exceptional-circumstances cancel.** Staff-only action on a paid booking: full refund including fee, reason code `exceptional`, no cancellation-record penalty to the vendor. Reuses the staff-cancel path. | bookings/service_admin | S |
| 2.6 | **Drip pricing check.** Confirm the browse card and vendor profile show "plus 5% service fee" before the enquiry; if not, add it from `getBookingServiceFeePercent()`. | web/features/marketplace | S |
| 2.7 | **Help Center.** One migration updating the cancellation, payments, reviews and vendor-account articles to match Phase 1 copy. | api/alembic | S |

---

## Phase 3: larger changes needing design (ADR each)

| # | Change | Why | Owner |
|---|---|---|---|
| 3.1 | **Delivery step for photography and video.** For categories with post-event deliverables, split the payout: a percentage (vendor-set between 50 and 80) released on event completion, the rest released when the client confirms delivery or after `delivery_deadline_days` (vendor-set, max 60) with no dispute. Needs a new payment status, a second Transfer with its own idempotency key, and Terms copy. | Today the photographer is paid 48h after the event, before any photos exist. | O |
| 3.2 | **Longer reporting window by category.** Make `booking_payout_auto_release_hours_after_event` overridable per category (rentals and decor need collection time; weddings need 72h). | 48h is short for the categories that collect equipment afterwards. | O |
| 3.3 | **Rescheduling.** A date-change request on an accepted or paid booking, accepted by the other side, keeps the payment and policy snapshot and moves the date; capacity re-checked by the trigger. Replaces the Phase 1A interim wording. | No product path today; cancel-and-rebook costs the client under Strict. | O |
| 3.4 | **Vendor cancellation consequences.** Only if 2.3 data shows a real problem after six months: prefer a short listing pause over fines; revisit fines only with solicitor input. | Full refund alone does not protect a client 3 days out, but fines would drive good vendors off. | O + L |
| 3.5 | **Damage deposits for rentals and decor.** Optional vendor-set deposit held as a separate PaymentIntent with manual capture, released 7 days after collection unless the vendor claims with evidence. | Rentals have no damage mechanism at all. | O |

---

## Questions for the solicitor (block the "legal" wording only)

1. Is the 5% service fee VAT-inclusive, and is Eventtz the supplier of that fee
   for VAT purposes?
2. Does regulation 28(1)(h) cover photography, makeup, hair, decor and rentals
   booked for a fixed date, or do those need a 14-day cancellation right beyond
   our 24-hour cooling-off?
3. Is a 0% refund inside 30 days (Strict) defensible under the Consumer Rights
   Act 2015 unfair-terms rules, or should it carry a "further refund if the date
   is rebooked" obligation?
4. Are we a "small enterprise" for P2B Articles 11 and 12 (complaints system
   and named mediators)?
5. Liability cap figure and wording; claims time limit.
6. Treatment of held vendor shares never claimed.

---

## Execution order and prompts

1. **Phase 0** first, as one Sonnet task (0.1 to 0.5). Prompt scope: identity
   slice, one Alembic revision, web signup and banner, notifications template.
2. **Phase 1** copy in one PR, written by Sonnet from this file, reviewed by Opus
   with the `reviewer` agent against the four slice READMEs. Set the effective
   date 15 days after the vendor email goes out.
3. **Phase 2** items 2.2, 2.5, 2.6, 2.7 as Sonnet tasks; 2.1 and 2.4 designed by
   Opus first, then built.
4. **Phase 3** one ADR per item under `docs/adr/`, starting with 3.1.

Done means: every rule in the Terms is read from code, a vendor and a client
have accepted the new version in the running app, and a vendor no-show, an
exceptional-circumstances cancel and a payment-deadline expiry have each been
run end to end on the compose database.
