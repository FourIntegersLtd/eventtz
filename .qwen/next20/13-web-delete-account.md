# Piece 13 — web: "Delete your account" section in client and vendor settings

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 12, which must be committed: `POST /api/v1/user/account/deletion` is in `schema.d.ts`.

## Facts
- `web/src/domains/settings/SettingsView.tsx:48` is `SettingsView({ role, extraSections })`, and it renders `{extraSections}` at :179.
- Client settings: `web/src/app/client/(portal)/settings/page.tsx` passes `extraSections={<SettingsClientOnboardingSection />}`.
- Find the vendor settings page with `ls "web/src/app/vendor/(portal)/settings"`.
- `foundation/ui` has `ConfirmDialog`, `TextField` and `Button`. There's no Modal and no toast.

## Baseline reference
- `frontend/features/settings/SettingsDeleteAccountSection.tsx` is shared by both portals. Port its copy **exactly**:
  - the section heading and body;
  - the button label;
  - the modal title "Delete your account?";
  - the modal body "This cannot be undone. You will be signed out. You can register again later with the same email; it will be a new account.";
  - the password field label;
  - the confirm label;
  - the error mapping by `code` (`money_in_flight`, `active_booking`, `open_dispute`, wrong password, admin).
- Where the baseline renders it on each portal's settings page (grep `SettingsDeleteAccountSection` in `frontend/app`).
- What happens after success: sign out, then redirect. Copy the baseline's destination and any message.

## What to build
- `web/src/domains/settings/DeleteAccountSection.tsx`: the section plus a dialog with a password field.
  - Use `ConfirmDialog` if it can hold a child input. Otherwise build the dialog inline in this file on the same pattern ConfirmDialog uses (focus trap, Esc, aria), and don't add a new foundation component.
- `web/src/domains/settings/accountDeletion.ts` (+ `accountDeletion.test.ts`):
  - `deletionErrorMessage(error: unknown): string`. Branch on `PlatformError.code` **only**, returning the baseline text for each code. Otherwise use `detail`, or the baseline fallback.
  - Add `deleteOwnAccount(password)` in `domains/settings/api.ts`.
- On success, call `signOut()` from `useSession()`, then `router.replace(<baseline destination>)`.
- Render it:
  - in the client settings page, next to the onboarding section, with `extraSections={<>…</>}`;
  - in the vendor settings page.
  - Admins never see it; the baseline hides it for admins.

## Tests
`accountDeletion.test.ts`: each code gives its literal message; an unknown code with a detail returns the detail; a non-PlatformError returns the fallback.

## Allowed paths
- `web/src/domains/settings/**`
- `web/src/app/client/(portal)/settings/page.tsx`
- `web/src/app/vendor/(portal)/settings/page.tsx`

## Browser check
With a local `@example.com` client on :3001 (api :8001):
1. With an accepted future booking, delete: the dialog shows the `active_booking` text.
2. With no bookings, delete: you're signed out and redirected.
3. Sign in with the old password: the baseline's sign-in error.

## Commit
`web: delete account section for client and vendor settings (ws13)`
