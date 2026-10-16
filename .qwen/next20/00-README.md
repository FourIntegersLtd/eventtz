# next20: the next 20 pieces of the Eventtz rebuild

Mainline `rebuild/osce-architecture` @ `caaf8a7`. ws14 piece 11 (browse and favorites) is closed. Its 375px browser check is folded into piece 01.

## How to run a piece
Open a fresh agent chat on the repo root and paste:

> Read `.qwen/next20/NN-<slug>.md` and do it.

Each file starts with "First read `rules-web.md`" or "`rules-api.md`". Those hold the shared rules (safety, tiers, tests, done-checklist, commit trailer, report format), so the piece files don't repeat them.

Run **one piece per agent**. When it reports, I (Claude) review the commit before the next dependent piece starts.

## Order and dependencies
| # | File | Lane | Depends on | Model | Money / risk |
|---|---|---|---|---|---|
| 01 | `01-web-vendor-profile-page.md`: public vendor profile page and browse layout split | web | — | Sonnet | |
| 02 | `02-web-booking-request-modal.md`: client booking request modal | web | 01 | **Opus** | 💷 price never sent |
| 03 | `03-web-multi-vendor-enquire.md`: multi-select and multi-vendor enquiry | web | 02 | Sonnet | |
| 04 | `04-web-merge-admin-portal.md`: merge the ws16 branch, CI fixes | web | — | Sonnet | merge |
| 05 | `05-web-admin-tests-and-gating.md`: admin tests, super-admin gating, stale guards | web | 04 | Sonnet | gating |
| 05b | `05b-web-admin-fixup.md`: refund amount parse like baseline, mobile h1, seed local admins + browser check (from the 05 review) | web (+api/scripts) | 05 | Sonnet | refund input |
| 06 | `06-acceptance-receipts-freeze.md`: freeze receipts and restore-Connect on the baseline | api | — | Sonnet | |
| 07 | `07-api-receipts-read-routes.md`: 6 receipt routes, templates, goldens | api | 06 | **Opus** | 💷 |
| 07b | `07b-api-receipts-fixup.md`: verify 503/frozen fallback, pricing after frozen check, tests (from the 07 review) | api | 07 | **Opus** | 💷 |
| 08 | `08-api-receipt-snapshots-and-emails.md`: write-once snapshots and receipt emails | api | 07 | **Opus** | 💷 |
| 08b | `08b-api-receipt-freeze-fixup.md`: freeze in a savepoint, imports, seed-admins tombstone (from the 08 review) | api | 08 | **Opus** | 💷 |
| 08c | `08c-api-remove-freeze-test-hooks.md`: drop test hooks from app code, trigger-based DB failure test (from the 08b review) | api | 08b | Sonnet | |
| 09 | `09-api-restore-stripe-connect.md`: super-admin restore-Connect | api | 06, 07 | **Opus** | 💷 Stripe |
| 09b | `09b-web-admin-vendor-stripe-connect.md`: admin vendor Connect card and restore button (from the 04 review) | web | 09, 05 | Sonnet | super-admin gating |
| 10 | `10-web-receipt-pages.md`: client receipt and vendor record/statement pages | web | 07 | Sonnet | |
| 10b | `10b-web-receipts-fixup.md`: iframe preview like the baseline, receipt links capability + vendor link bug, seed-receipts, browser check (from the 10 review) | web (+api/scripts) | 10, 08b | Sonnet | |
| 10c | `10c-web-receipt-preview-csp.md`: CSP `frame-src blob:` for the receipt iframe, seed vendor status "submitted", vendor + 375px browser check (from the 10b review) | web (+api/scripts) | 10b | Sonnet | |
| 11 | `11-acceptance-deletion-freeze.md`: freeze deletion gates and erasure | api | — | Sonnet | |
| 12 | `12-api-account-deletion.md`: account deletion | api | 11 | **Opus** | ⚠️ erases data |
| 13 | `13-web-delete-account.md`: delete-account section | web | 12 | Sonnet | |
| 14 | `14-api-dispute-changed-and-suspended-email.md` | api | — | Sonnet | |
| 15 | `15-api-maintenance-reminders.md`: 4 reminders | api | — (not alongside 07/08/12) | Sonnet | |
| 16 | `16-ci-jobs-mypy-stale-comments.md`: GitHub CI for api/web, mypy, stale handles | api | best after 12 | Sonnet | |
| 17 | `17-web-redirects.md`: baseline redirects and `/videos` header | web | 04 | Sonnet | |
| 18 | `18-web-send-quote.md`: vendor "Send quote" from chat | web | — | Sonnet | 💷 vendor price |
| 19 | `19-web-chatdrawer-confirms-onboarding.md` | web | 01, 02 | Sonnet | |
| 20 | `20-web-helpwidget-and-agents-md.md`: help widget and AGENTS.md | web | run last | Sonnet | |

## Running two at once
Every piece commits straight to mainline in the same folder, so at most **one web piece and one api piece** may run at the same time.
- API pieces that regenerate `schema.d.ts` (07, 09, 12) touch `web/`. Don't run a web piece's `npm run ci` while one of them is mid-way; stagger them, or run the web piece first.
- The bookings slice is touched by 07, 08, 12, 15 and 16. Only one of those at a time.

A suggested pairing (web lane | api lane):
1. 01 | 06
2. 02 | 07
3. 03 | 08
4. 04 | 09
5. 05 | 11
6. 10 | 12
7. 17 | 14
8. 18 | 15
9. 13 | 16
10. 19
11. 20

## Left out on purpose (need a decision or a design first)
- **Mail after commit.** Many `mailer.send` calls return a bool the delivery log uses, so moving them to `defer_in_transaction` jobs needs a design. That's for me/Opus, not a Cursor piece.
- **npm packages** (lucide-react, charts, rich-text editor, carousel, Lottie, @sentry/nextjs, mixpanel-browser): these wait for the user's OK. Pieces build without them.
- **Mixpanel profile delete** on account closure: a new analytics port over plain HTTP, waiting for the user's OK. Piece 12 lists it as Deferred.
- **Cutover decisions and anything touching the hosted DB, pushes and deploys.** These belong to the user.
- `/me/capabilities`, the worker heartbeat route and `/internal/ui-kit`: waiting for the user's decisions.
