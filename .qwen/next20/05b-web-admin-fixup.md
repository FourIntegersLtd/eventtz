# Piece 05b — web: admin fix-up after review of b890862, plus local admin logins for the browser check

First read `.qwen/next20/rules-web.md` and follow it in full. Mainline includes b890862. Commit only your own paths.

Review result: the gating matches the baseline. All 15 loaders have the sequence guard on the success, catch and finally paths. The mobile menu works as the baseline's does. CI: 428/428. Three things are left.

## 1. BUG: the partial-refund amount rejects input the baseline accepts
`web/src/domains/admin-trust/disputeResolutionValidation.ts` uses plain `Number(...)`, so "£50" and "1,200" are rejected. The baseline accepts both.
Baseline:
- `frontend/lib/validation/common.ts:114-127`, `moneyGbpSchema`:
  - trim, then strip `£` and `,`;
  - empty gives "Enter an amount.";
  - not a finite number gives "Enter a valid amount in pounds (£).";
  - below 0 gives "Amount can't be negative.";
  - above 1,000,000 gives "That amount is too high.".
- `frontend/lib/validation/settingsAdmin.ts:18-21`, `adminPartialRefundSchema`: zero gives "Enter a refund amount greater than zero."; the note is at most 8000 characters.
- `frontend/features/admin/disputes/DisputeResolveModal.tsx:17-19`: the note for the other actions is also at most 8000, "Message is too long.".
- Order and messages: `DisputeResolveModal.tsx:38-60`.

Fix:
- `validateDisputeFinancialResolution(action, refundAmountRaw, note)` returns `{ error: string } | { refundAmountGbp: number | null }`, following the baseline's order and exact messages. Keep "Choose a resolution action." for an empty action; the baseline's select always has a value, so this is web-only.
- `AdminDisputesPanel` sends the **parsed** `refundAmountGbp` from the validator, never `Number(refundAmount)` again.
- Tests, with literal values:
  - "£50" gives 50; "1,200.50" gives 1200.5; " 10 " gives 10;
  - "" gives "Enter an amount."; "abc" gives "Enter a valid amount in pounds (£).";
  - "-5" gives "Amount can't be negative."; "0" gives "Enter a refund amount greater than zero."; "1000001" gives "That amount is too high.";
  - an 8001-character note gives "Message is too long." for `refund_client`;
  - `release_to_vendor` with an empty amount gives `refundAmountGbp: null`.

## 2. The mobile page title is not a heading
`AdminShell.tsx` hides the `<h1>` below `md` and shows the title as a `<p>` in the mobile header, so phone screens have no page heading. Render one `<h1>` that is visible at every width, for example the mobile header's title as `<h1>` and the desktop `<h1>` as `md:block` only. Screen readers must find exactly one h1 at each width.

## 3. Local admin logins, so the browser checks can run (05, 09b and later)
There is no seed for admins. Add `api/scripts/seed_local_admins.py`:
- Run it with `poetry run python -m scripts.seed_local_admins`. Add a `make seed-admins` target in `api/Makefile`.
- It creates or updates two users in the **local compose DB only**:
  - `admin@example.com` with admin_role `admin`;
  - `superadmin@example.com` with admin_role `super_admin`;
  - password `LocalAdmin123!` (argon2 through the identity slice's hasher).
- Refuse and exit 1 unless the database URL host is `127.0.0.1` or `localhost`. Copy the check in `acceptance/conftest.py` (`LOCAL_HOSTS`).
- Write through the identity slice's service or repository functions. Read how `acceptance/` creates admin users and follow the same columns (`user_type="admin"`, `admin_role`).
- Docstring the module; print only the two emails, never the hash.
- Allowed extra paths for this task only: `api/scripts/**` and `api/Makefile`.
- Then do the browser check that 05 skipped (web :3001, api :8001):
  - Sign in as each user. Say which super-admin controls each one sees on `/admin/team`, `/admin/commerce?tab=financials`, `/admin/trust` (disputes) and `/admin/email`.
  - At 375px, open the menu, tap another page, and confirm the panel closes and the page scrolls again.

## Allowed paths
- `web/src/capabilities/admin-shell/**`
- `web/src/domains/admin-*/**`
- `api/scripts/**`
- `api/Makefile`

## Done
- web `npm run ci` exits 0 (report `# tests` / `# pass`).
- api `make ci` exits 0.
- Two commits:
  - `web: admin refund amount parses like the baseline, mobile h1 (ws16)`
  - `api: seed local admin logins for browser checks (ws16)`
  Both with the Cursor trailer.
- Report in 10 lines or fewer, including exactly which browser checks you ran.
