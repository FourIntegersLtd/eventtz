# 0011 — List screens page on the server, 25 rows at a time

Status: accepted (2026-10-23).
Source: commit `c21acdf` (portal lists), `docs/plans/rebuild-audit-2026-10-22.md`.

## Decision
- **Default page size is 25** (`app/core/pagination.py`, `DEFAULT_LIST_LIMIT`), replacing the old
  backend's 50 on the routes that had one. The web tables send `offset` / `limit` / filters as query
  params and read `total` back; they no longer fetch a large page and filter in the browser.
- **Pagination fields are additive.** A list response that now pages gains `total`, `offset` and
  `limit` next to its frozen keys. No frozen key was renamed or removed. The vendor payout history
  also gained `paid_out_last_30_days_gbp` / `_label` for the payments screen header.
- **Acceptance follows.** Frozen tests that pinned an exact body or the old page size were updated
  in place with a docstring naming this ADR (`test_referral_partners.py` signups: 50 to 25;
  `test_payments.py` payout history and `test_referral_client_codes.py` referral bookings: the
  extra fields). No assertion about frozen behaviour was weakened.

## Affected routes (from `c21acdf`)
- Bookings: client, vendor and admin booking-request lists; `GET /client/dashboard`,
  `GET /vendor/dashboard` aggregates.
- Payments: `GET /vendor/payments/history`.
- Referrals: `GET /vendor/referral/bookings`, admin partner list and partner signups.
- Disputes: client, vendor and admin lists.
- Messaging: chat and support thread lists, admin support list.
- Notifications: client and vendor feeds.
- Content: public and admin blog lists.
- Reviews: vendor and admin lists. Staff: clients and team lists. Admin vendors list.
- Marketplace search and admin insights lists.

## Consequences
- `web/lib/api-types.ts` and `web/lib/listPageSize.ts` carry the same default; change both together.
- A route that grows pagination later is listed here, not silently added.
