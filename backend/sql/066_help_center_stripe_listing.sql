-- Help Center: clarify hide listing vs Stripe Connect; document restore policy.

UPDATE help_articles
SET
  body_md = $md$
## Support admin

Can:

- View dashboard, commerce lists, financials summary, marketplace analytics
- Approve / pending / ban vendors; revert listing override to **Automatic**; suspend / unsuspend clients
- Triage disputes (status, assign, party notes); hide / unhide reviews
- Use support Messages (selected users) and Blog CMS
- Read Team roster and Activity log

Cannot:

- Run booking money / recovery actions
- Resolve disputes with refunds or payouts
- Force vendor **Publish anyway** or **Hide listing** (Stripe payout bypass)
- Broadcast support messages to all clients, vendors, or users
- Restore Stripe Connect from payout history (super admin)
- Invite or change admin team roles
- Open Email testing
- Export financials CSV (API is super-admin gated)

## Super admin

Everything a support admin can do, plus:

- Vendor listing **Publish anyway** / **Hide listing**
- Support message **audience broadcasts** (all clients, vendors, or users)
- **Restore Stripe Connect** from a vendor's latest payout transfer when the account id was wrongly cleared
- Booking **Support actions** (payment sync, payout, hold, cancel, mark complete)
- Dispute **financial resolve** (release to vendor, full or partial refund)
- Team invite / role / suspend
- Email testing
- Financials CSV export API

## Hide listing vs Stripe Connect

**Hide listing** only sets `listing_override = hidden`. It does **not** remove `stripe_account_id` or payout flags.

If Connect disappears after a vendor was paid, use **Restore from payout transfer** on the vendor Actions tab (super admin) or `POST /api/v1/admin/vendors/{id}/restore-stripe-connect`. Eventtz never auto-deletes Connect for vendors with payout history.
$md$,
  updated_at = now()
WHERE slug = 'admin-roles-explained';
