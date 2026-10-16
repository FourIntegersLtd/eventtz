# Piece 05 — web: admin portal tests, super-admin gating and stale-response guards

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 04, which must be committed: the admin portal is merged.

## Facts
- Only two admin test files exist: `capabilities/admin-shell/format.test.ts` and `domains/admin-audit/auditFormatters.test.ts`.
- Gating lives in `web/src/capabilities/admin-shell/permissions.ts`:
  - `isSuperAdmin(session)`
  - an `adminCapabilities` matrix:
    - `canManageAdminTeam`, `canRunBookingSupportActions`, `canResolveDisputesFinancially`, `canExportFinancials`, `canBroadcastMessages` and `canSendTestEmails` are for super admins only;
    - `canModerateReviews` is for any admin.
- `nav.ts` marks "Email health" as `superAdminOnly`.
- Call sites:
  - `AdminShell.tsx`
  - `admin-bookings/AdminBookingDetailView.tsx` (`canActOnMoney`)
  - `admin-commerce/AdminFinancialsView.tsx`
  - `admin-email/AdminEmailTestingView.tsx`
  - `admin-settings/AdminSettingsView.tsx`
  - `admin-team/AdminTeamView.tsx`
  - `admin-trust/AdminDisputesPanel.tsx`
- 15 views load with `useEffect(() => { queueMicrotask(() => { void load(); }); }, [load])`. It has no `cancelled` or sequence check, so a slow earlier response can overwrite a newer one when filters or pages change.

## Baseline reference for gating
- `frontend/app/admin/**` and `frontend/features/admin/**`: grep for `isSuperAdmin` or `super_admin` to see exactly which buttons and pages the baseline hides.
- The api refuses these actions anyway: `CurrentSuperAdmin` in api routers, 403 `super_admin_only`. The web must *hide* what the baseline hides and show the baseline's message if the api refuses.

## Tasks
1. **Gating audit.** For each super-admin action below, check that web hides or disables it exactly where the baseline does. Fix any mismatch.
   - team invite, role change and delete;
   - email test-send;
   - booking money actions (refund, release payout, recovery);
   - dispute financial resolution;
   - financials CSV export;
   - broadcast messages;
   - "Email health" in the nav.
2. **Unit tests** (`node --test`). Import concrete modules, **never** the `capabilities/admin-shell/index.ts` barrel: it re-exports .tsx, which crashes `node --test`.
   - `permissions.test.ts`: a super admin, a plain admin, a vendor and a client, against every `adminCapabilities` key, with literal true/false values.
   - `nav.test.ts`: a plain admin's nav has no "Email health"; a super admin's does.
   - One pure-logic test file for each of these 8 domains, where there is real logic: blog, trust, referrals, settings, report-bug, dashboard, directory, messages. Also team, email, bookings and commerce if they have logic.
     - If a domain's logic is inline in a .tsx (formatters, filters, query-string builders, status labels, validation), move it to a `.ts` file in that domain and test it there.
     - If a domain has no pure logic, write no test and list it in your report. Don't write tests that only restate constants.
3. **Stale-response guard** in the 15 `queueMicrotask` views. Smallest change: keep the pattern, and add a request sequence inside each `load`:
   ```ts
   const requestSeq = useRef(0);
   const load = useCallback(async () => {
     const mySeq = ++requestSeq.current;
     ...await fetch...
     if (mySeq !== requestSeq.current) return; // a newer load started; drop this answer
     setState(...)
   }, [deps]);
   ```
   Apply the same guard to the catch path. Don't rewrite the views to the derived-loading pattern. Explain the change in a one-line comment in one place, the first view.

4. **Mobile admin nav** (piece 04 review). `AdminShell.tsx` hides the sidebar below `md` and offers no menu, so on a phone no admin page can reach another. Port the baseline's mobile header and slide-over from `frontend/components/admin-shell/AdminShell.tsx:251-300`:
   - a `md:hidden` header with a 44px menu button (`aria-expanded`, `aria-label` "Open menu" / "Close menu");
   - a `role="dialog"` `aria-modal` panel on the right, a backdrop that closes it, and a close button;
   - the same `visibleNav` (so "Email health" stays super-admin only), the email and "Sign out";
   - closes on navigation; body scroll locked while open, as the baseline does.
   There's no icon library, so use text or inline SVG. No new dependency. Put the nav-filtering logic you test in `nav.test.ts` in a `.ts` file that the desktop sidebar and the mobile panel both use.

## Allowed paths
`web/src/capabilities/admin-shell/**` and `web/src/domains/admin-*/**`

## Browser check (if api :8001 and web :3001 run and you have local @example.com admin logins)
Sign in as a plain admin and as a super admin. At 375px width, open the menu, go to another admin page, and confirm the panel closes. Say which super-admin controls each one sees on `/admin/team`, `/admin/commerce?tab=financials`, `/admin/bookings/<id>`, `/admin/trust` and `/admin/email`. If you have no admin logins, say so; don't create accounts in any non-local DB.

## Commit
`web: admin tests, super-admin gating and stale-response guards (ws16)`
