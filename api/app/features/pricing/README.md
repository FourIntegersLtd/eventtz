# pricing

## Purpose

The single place that turns a booking's line items, vendor adjustments, service fee
percent and referral discount into money figures and labels. Bookings, payments,
receipts and referrals all price through `service.py`, so a total can never be
worked out two different ways.

## Use cases

- As **another slice**, I **price a booking** (`build_pricing_breakdown`) so that the
  client, the vendor, staff and the receipt all see the same numbers.
- As **bookings**, I **store the total label** (`persisted_total_label`) that list
  screens show without re-pricing.
- As **referrals**, I **work out a vendor's portion** (`vendor_portion_gbp`) to pick a
  fee-discount tier.

## Invariants

- The referral discount comes off the service fee only, is capped at the fee, and a
  fee is never negative. The vendor's portion is never reduced by Eventtz.
- A line item without a price is "TBC": it adds nothing but marks the total provisional.
- Every figure is rounded to pennies at each step exactly as the baseline does;
  `tests/golden/pricing/` pins the results.
- Pure: no database, clock or network (adjustment ids shorter than 8 characters are
  the one exception, replaced with a random UUID as the baseline does).

## Routes

None. Other slices call `service.py`.
