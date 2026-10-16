# Piece 09b — web: admin vendor Stripe Connect section and "Restore from payout transfer"

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 09, which must be committed: `POST /admin/vendors/{user_id}/restore-stripe-connect` is in `schema.d.ts`. It also depends on piece 05, for `permissions.ts` tests and the stale guards.

## Why (piece 04 review)
The baseline admin vendor details show a Stripe Connect card. A super admin can restore a missing account ID from the vendor's latest payout transfer there. Web's `admin-directory/AdminVendorsPanel.tsx` shows only a "Payouts: Verified / Not set up" column. There is no Connect card and no restore action.

## Baseline
- `frontend/features/admin/vendors/VendorStripeConnectSection.tsx`, the whole file:
  - masked account id: "Not set", or the last 8 characters after "…";
  - "Charges enabled" and "Payouts enabled", each Yes/No;
  - the payout status badge;
  - the help text, word for word;
  - the success message "Stripe Connect restored from the latest payout transfer.";
  - on error, the api's detail, falling back to `COULD_NOT_RESTORE_STRIPE_CONNECT` (`frontend/lib/admin-messages.ts`).
- Where it is shown and how the restore is wired: `frontend/features/admin/vendors/VendorDetailsApprovalSection.tsx`, near line 137, and whoever passes `onRestoreStripe`. Follow it up to find what refreshes the vendor row after a restore.
- The button shows only if the viewer is a super admin **and** `!vendor.stripe_account_id`. A plain admin sees the card without the button.

## Tasks
1. `web/src/domains/admin-directory/`:
   - `vendorConnect.ts`: the pure pieces, `maskAccountId` and `canRestoreConnect(session, vendor)` using `isSuperAdmin` from `capabilities/admin-shell/permissions` (import the concrete module, not the barrel).
   - A `VendorStripeConnectCard.tsx`.
   - A `restoreVendorStripeConnect(userId)` call in `api.ts`, typed from `schema.d.ts`. Don't cast.
   Render the card where web shows a vendor's details: the inline insights panel in `AdminVendorsPanel.tsx`. If the admin vendor row in `schema.d.ts` lacks `stripe_account_id`, `stripe_charges_enabled` or `stripe_payouts_enabled`, stop and report. Don't change the api here.
2. After a successful restore, update that vendor's row in place from the response fields (`stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`), then show the success message. No refetch race.
3. Errors: show the api's message for 400 and 502 (piece 09 keeps the baseline text). For 403 `super_admin_only`, show the baseline message. Branch on `code`, never on the message text.
4. `node --test`, `vendorConnect.test.ts`, with literal values:
   - `maskAccountId(null)` is "Not set"; "acct_1" stays as it is; "acct_1234567890AB" becomes "…567890AB";
   - `canRestoreConnect`: super admin with no account id is true; super admin with an id is false; plain admin is false; vendor and client are false.

## Allowed paths
`web/src/domains/admin-directory/**`. Read `capabilities/admin-shell/**`; if it needs a change, stop and report.

## Browser check (only with local @example.com admin logins, api :8001, web :3001)
- As a super admin, on a local vendor with no account id but with a paid transfer: press restore and confirm the card updates.
- As a plain admin: confirm there is no button.
- Log in with `make seed-admins` (admin@example.com / superadmin@example.com, `LocalAdmin123!`). Type into the login form with real key or insertText events; setting `.value` doesn't update React state.
- Also (from the 05b review): if the local DB has an open dispute, confirm the super admin sees the financial resolve controls on /admin/trust and the plain admin doesn't. Try "£50" as a partial refund amount, but don't submit unless the booking is local test data.

Say which checks you ran.

## Commit
`web: admin vendor Stripe Connect card and restore action (ws16)`
