"""Payments slice: Stripe webhooks and vendor payout setup (Stripe Connect) with its ledger.

The booking money flows themselves (checkout, refunds, payouts) live in the bookings slice,
because they are steps of a booking's lifecycle; this slice calls them, never the reverse.
"""
