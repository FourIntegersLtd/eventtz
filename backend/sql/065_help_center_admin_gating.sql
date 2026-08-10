-- Help Center: document super_admin gates for listing override and support broadcasts.

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
- Invite or change admin team roles
- Open Email testing
- Export financials CSV (API is super-admin gated)

## Super admin

Everything a support admin can do, plus:

- Vendor listing **Publish anyway** / **Hide listing**
- Support message **audience broadcasts** (all clients, vendors, or users)
- Booking **Support actions** (payment sync, payout, hold, cancel, mark complete)
- Dispute **financial resolve** (release to vendor, full or partial refund)
- Team invite / role / suspend
- Email testing
- Financials CSV export API
$md$,
  updated_at = now()
WHERE slug = 'admin-roles-explained';

UPDATE help_articles
SET
  body_md = $md$
## Path

**Messages → Compose** (`/admin/messages?tab=compose`).

## Options

- **Selected users** (directory search) — any support admin
- **All clients / vendors / users** — **super admin only**

## Steps

1. Choose audience.
2. Write the message.
3. Send. This creates support conversations.

Broadcasts are audited. Double-check audience before sending platform-wide messages.
$md$,
  updated_at = now()
WHERE slug = 'admin-compose-broadcast';
