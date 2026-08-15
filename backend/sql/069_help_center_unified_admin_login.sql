-- Help Center: unified admin login URL (/login?next=/admin/dashboard).

UPDATE help_articles
SET
  body_md = $md$
## Sign in

1. Go to **/login?next=/admin/dashboard** (legacy **/admin/login** redirects here).
2. Sign in with an account whose user type is **admin**.
3. You land on **/admin/dashboard**.

## Console layout

- **Sidebar** (desktop) or **menu** (mobile): Dashboard, Commerce, Directory, Referrals, Messages, Blog, Trust & safety, Team, Activity log.
- **Email testing** appears only for **super admins**.
- Your role label shows as **Support admin** or **Super admin**.

## Sign out

Use **Sign out** in the shell. You return to the login page.

## Help in the console

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. Answers are grounded in these admin docs.
$md$,
  updated_at = now()
WHERE slug = 'admin-sign-in-console';
