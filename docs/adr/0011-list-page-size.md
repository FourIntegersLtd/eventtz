# 0011 — List screens page on the server, 25 rows at a time

Status: accepted (2026-10-23).
Source: commit `c21acdf` (portal lists), `docs/plans/rebuild-audit-2026-10-22.md`, rebuild audit Phase 3.

## Decision
- **Default page size is 25** (`app/core/pagination.py`, `DEFAULT_LIST_LIMIT`), replacing the old
  backend's 50 on the routes that had one. The web tables send `offset` / `limit` / filters as query
  params and read `total` back; they no longer fetch a large page and filter in the browser.
- **One kernel.** A router asks for `page: PageDep` (`PageParams`: `offset >= 0`, `1 <= limit <= 200`);
  its response schema extends `PagedResponse` (`total`, `offset`, `limit`); its repository pages with
  `paged()`, which counts, sorts and always adds the row's primary key as the last sort key so rows
  never repeat or vanish between pages. `escape_like()` / `contains_pattern()` escape `%`, `_` and `\`
  in every `ilike` search term. `tests/guards/test_routers_use_page_params.py` fails on a router that
  declares its own `offset` or a schema that redeclares the triple.
- **Pagination fields are additive.** A list response that now pages gains `total`, `offset` and
  `limit` next to its frozen keys. No frozen key was renamed or removed. The vendor payout history
  also gained `paid_out_last_30_days_gbp` / `_label` for the payments screen header.
- **Kept maxima.** Three routes keep a frozen larger or smaller cap through
  `page_params(max_limit=...)`: audit log 500, vendor reviews 100, admin referral signups
  (`MAX_SIGNUPS_PAGE`). Everything else caps at 200.
- **Default changes.** The audit log and the admin reviews list defaulted to 100 rows; they now
  default to 25. The web sends an explicit `limit=100` to both, so the screens are unchanged.
- **Served in SQL.** Vendor payout history and admin daily financials used to load every row and
  slice in memory. They now page in SQL (payout history sums the whole ledger in SQL from the
  payment-time snapshots; daily financials pick the page's days first and price only those days).
  Amounts are byte-identical (the money goldens and the frozen acceptance suite pass).
- **Acceptance follows.** Frozen tests that pinned an exact body or the old page size were updated
  in place with a docstring naming this ADR (`test_referral_partners.py` signups: 50 to 25;
  `test_payments.py` payout history and `test_referral_client_codes.py` referral bookings: the
  extra fields). No assertion about frozen behaviour was weakened.

## Affected routes
All paths are under `/api/v1`.
- Bookings: `GET /client/booking-requests`, `GET /vendor/booking-requests`, `GET /admin/bookings`,
  `GET /admin/financials/daily`.
- Payments: `GET /vendor/payments/history`.
- Referrals: `GET /vendor/referral/bookings`, `GET /admin/referrals/partners`,
  `GET /admin/referrals/partners/{partner_id}/signups`.
- Disputes: `GET /client/disputes`, `GET /vendor/disputes`, `GET /admin/disputes`.
- Messaging: `GET /chat/conversations`, `GET /admin/messages/conversations`.
- Notifications: `GET /client/notifications/feed`, `GET /vendor/notifications/feed`.
- Content: `GET /admin/blog/posts` (the public blog list keeps its own `limit` only).
- Reviews: `GET /vendor/reviews`, `GET /admin/reviews`.
- Staff: `GET /admin/clients`, `GET /admin/team`, `GET /admin/audit-log`.
- Vendors: `GET /admin/vendors`.
- Marketplace: `GET /vendors/explore/search`.
- Not paged by this kernel: admin insights (`category_offset` / `category_limit` page one table
  inside the analytics payload, allow-listed in the guard). `GET /client/dashboard` and
  `GET /vendor/dashboard` are aggregates, not lists.

## Consequences
- `web/lib/api-types.ts` and `web/lib/listPageSize.ts` carry the same default; change both together.
- A route that grows pagination later is listed here, not silently added.
