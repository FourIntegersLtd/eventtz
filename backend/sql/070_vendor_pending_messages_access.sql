-- Help Center: vendors can open Messages before admin approval (Eventtz Support threads).

UPDATE help_articles
SET
  summary = 'Edit Profile, read Messages, and Contact while pending. Bookings unlock after approval.',
  body_md = $md$
## While your profile is pending

You can usually:

- Open **Profile** and finish or fix your application
- Open **Messages** to read **Eventtz Support** (for example when we return your profile for edits)
- Use **Contact** to reach Eventtz
- Read **Help** and use **Ask**

## Locked until you are approved

These areas stay unavailable until we approve you:

- **Bookings** (accepting client requests)
- **Analytics**
- **Payments** setup for live bookings
- Most other vendor tools that assume you are live

## After approval

Once approved, you can open **Bookings**, **Payments**, and **Analytics**. You still need payout setup finished before you can **accept** a paid booking.
$md$
WHERE slug = 'vendor-pending-access';
