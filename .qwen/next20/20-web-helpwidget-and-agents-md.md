# Piece 20 — web: floating Help widget in the portal and admin shells; AGENTS.md refresh

First read `.qwen/next20/rules-web.md` and follow it in full.
Run it last: it touches `surfaces/portal-shell` (and the admin shell from piece 04), and AGENTS.md should describe the finished state.

## Part A — HelpWidget

### Facts
- api endpoints already exist, in `api/app/features/content/router.py`: `GET /api/v1/help/articles`, `GET /api/v1/help/articles/{slug}`, `GET /api/v1/help/categories` and `POST /api/v1/help/ask`. Check them in `schema.d.ts`.
- Web `domains/help` has only `HelpHubView.tsx`, `helpHub.ts` and `helpHub.test.ts`.
- An older domain, `web/src/domains/vendor-help/`, was deleted when the help hub was shared. Its files are in git at `4b0f401^`:
  - `AskAssistantPanel.tsx`
  - `HelpArticleBrowser.tsx`
  - `api.ts`
  - `helpFormatting.ts`
  - `helpFormatting.test.ts`
  - (`HelpHubView.tsx`, `SupportMessagesView.tsx` and `SupportThreadView.tsx` are superseded; don't restore them.)

  Restore the useful ones **into `domains/help/`** (not `vendor-help`), e.g. `git show "4b0f401^:web/src/domains/vendor-help/api.ts" > web/src/domains/help/api.ts`. Then fix the imports, and merge the api functions with any existing ones, with no duplicates.
- Portal shell: `web/src/surfaces/portal-shell/PortalShell.tsx`. The admin shell is in `web/src/capabilities/admin-shell/` after piece 04.

### Baseline
- `frontend/features/help/HelpWidget.tsx` (657 lines), plus `HelpArticleBody`, `HelpAssistantThread` and `helpContent.ts` (+ its test).
- It's mounted in the baseline PortalShell and AdminShell: grep `HelpWidget` in `frontend/`.
- It uses `lucide-react` icons, which are **not allowed**. Use inline SVGs (a small `icons.tsx` in `domains/help`) or text.
- Port:
  - the floating button (position, label, aria);
  - the panel's tabs or views: search articles, article view, ask the assistant, and "message support" if present (then link to `{portal}/help`, which web already serves);
  - copy, empty states, loading and error text;
  - how it hides on certain routes, if it does (read it);
  - the article body rendering. The baseline may use `dangerouslySetInnerHTML` on sanitised HTML; see what `helpFormatting.ts` does, and **never** render unsanitised HTML.

### Build
- `web/src/domains/help/HelpWidget.tsx`: split it into files under ~250 lines each (`HelpWidgetPanel.tsx`, `HelpArticleView.tsx`, `HelpAssistantThread.tsx`).
- `helpContent.ts`: port it along with its test, `helpContent.test.ts`, keeping the baseline test names.
- Mounting: surfaces may import domains. Mount `<HelpWidget portal=… />` in `PortalShell`, and in the admin shell if the baseline does.
  - If the admin shell is a capability (capabilities can't import domains), pass the widget from `web/src/app/admin/layout.tsx` through a slot prop instead.

## Part B — AGENTS.md refresh (repo root)
Keep it short, as its last section asks. Update:
- **Repo map:** add the api slices that now exist (payments, admin_insights, realtime, migration, receipts inside bookings) and the web tiers' main folders (`capabilities/admin-shell`, `realtime-stream`, `vendor-copilot-panel`, `surfaces/portal-shell`).
- **Commands:** add `make reset-data` (local `@example.com` data only), and add `npm run api:types` next to `make openapi` if missing.
- **Traps** (one line each):
  - importing the `capabilities/admin-shell` barrel in a `node --test` file crashes (it re-exports .tsx), so import concrete modules;
  - Node's ICU prints "Sept", so date formatting uses a fixed month table;
  - in zsh, `$VAR:` in a string is a modifier, so write `${VAR}:`.
- Don't touch the other sections.

## Allowed paths
- `web/src/domains/help/**`, `web/src/surfaces/portal-shell/**`
- `web/src/app/admin/layout.tsx` (a slot only) and `web/src/capabilities/admin-shell/**` (a slot prop only)
- `AGENTS.md`

## Browser check
- On :3001 as a client, a vendor and an admin: the widget opens, a search returns articles, an article renders, and the assistant answers (or shows its "unavailable" state if OpenAI isn't configured locally; show the baseline's message).
- At 375px, the panel is full-screen and closable.

## Commits
1. `web: floating help widget in portal and admin shells (ws14)`
2. `docs: refresh AGENTS.md repo map, commands and traps`
