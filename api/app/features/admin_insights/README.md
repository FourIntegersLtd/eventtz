# admin_insights

## Purpose

Read models for the admin console: headline dashboard counts, rolling-window
charts, the marketplace funnel, a cross-account directory search, and one
vendor's booking/review history. Nothing here changes any data - every route
is a `GET`.

## Use cases

- A support agent opens the admin console and sees how many clients, vendors,
  bookings and reviews exist, and how many bookings currently need attention.
- Staff pick a chart window (7/30/60/90 days) to see bookings created, bookings
  paid (with takings) and new signups, day by day.
- Staff review the marketplace funnel for a date range: enquiries through
  acceptance, payment and completion, broken down by category and location,
  with a shortlist of vendors worth recruiting more of.
- Staff search across clients and vendors by email or business name, to jump
  to one account.
- Staff open one vendor's page and see its booking counts by status and
  month, its review average, and whether it has any open disputes.

## Invariants

- No route here is super-admin-only: a plain admin (`CurrentStaff`) can see
  every read model in this slice.
- `/admin/vendors/{user_id}/insights` never 404s. An unknown or malformed
  `user_id` simply matches no bookings or reviews, so every count comes back
  zero rather than an error - the baseline's behaviour, frozen in
  `acceptance/test_admin_dashboards.py::test_vendor_insights_unknown_vendor_is_all_zero`
  and `test_vendor_insights_malformed_id_is_also_all_zero`.
- `/admin/dashboard-metrics`'s `days` query accepts any value in `[7, 90]`
  (FastAPI's own validation), but only `{7, 30, 60, 90}` are real chart
  windows; anything else silently falls back to 30
  (`domain.resolve_metrics_days`, also a frozen baseline quirk).
- `/admin/marketplace-analytics`'s `from_date`/`to_date` must be `YYYY-MM-DD`
  or absent; anything else raises `InvalidDateFilter` (400,
  `invalid_date_filter`), never a 422 - the baseline parses these by hand
  rather than through FastAPI's own date type.
- Money in this slice's responses stays float GBP (`payment_amount_gbp`
  straight from the row, or `0.0` when a booking predates that snapshot
  column), matching the baseline's loosely-typed `AdminMarketplaceAnalyticsResponse`
  contract. This is a read-only display aggregate, not the integer-pence rule
  that applies to a slice's own money maths.
- This slice owns no table. Every repository read crosses into `users`,
  `vendors`, `booking_requests`, `booking_reviews`, `dispute_cases`,
  `conversations` and `marketplace_events` through local `table()`/`column()`
  handles (never those slices' `models.py`), the pattern
  `bookings/repository_admin.py` already uses for `dispute_cases` and `vendors`.

## Routes

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/dashboard-summary` | staff |
| GET | `/admin/dashboard-metrics` | staff |
| GET | `/admin/marketplace-analytics` | staff |
| GET | `/admin/directory/search` | staff |
| GET | `/admin/vendors/{user_id}/insights` | staff |
