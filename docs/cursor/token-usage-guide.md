# Cursor token usage guide (Eventtz)

Repo config (`.cursorignore`, scoped rules) reduces indexing noise and always-on context. **Workflow habits** have the biggest impact on monthly spend.

## 1. Audit your usage (do this first)

Open **Cursor Settings → Account → Usage** (or [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage)).

Note for 2–3 days:

| Question | Why it matters |
|----------|----------------|
| Which **model** dominates? | Opus/GPT-5.x vs Composer 2.5 can be 5–25× cost difference |
| **Agent** vs Tab vs inline edit? | Agent re-sends full thread context every turn |
| **Cloud Agents / Bugbot / parallel subagents?** | Each run is a separate bill |
| Hitting limit in **days 1–3** of the cycle? | Usually long Agent threads + premium models |

Set a **spend limit** under **Settings → Billing** to avoid surprise overages.

## 2. Default workflow (adopt these habits)

### Model selection

| Task | Use |
|------|-----|
| Autocomplete, rename, small fix | **Tab** or **Cmd+K** |
| Routine feature work | **Composer 2.5** or **Auto Cost** |
| Hard bugs / architecture | Premium model in a **new short chat** |
| “How does X work?” | **Ask mode** + 1–2 `@file` mentions |

### Context discipline

- **New chat per task** — reset after ~5–10 turns or when switching topics.
- **`@file`** over **`@codebase`** — targeted paths, not whole-repo search.
- **Short prompts** with file paths and expected behavior.
- **Plan mode** for large changes — cheaper than long Agent repair loops.

### Expensive patterns to avoid

- One Agent thread for an entire afternoon of unrelated work
- `@codebase` on every question
- Premium “thinking” models for typos and formatting
- Parallel background agents without need
- Pasting full logs — use last ~20 lines + file path

## 3. What this repo configures

| File | Purpose |
|------|---------|
| [`.cursorignore`](../.cursorignore) | Blocks AI access to secrets, `.next`, `node_modules`, videos |
| [`.cursorindexingignore`](../.cursorindexingignore) | Keeps docs/SQL/animations out of `@codebase` search |
| [`.cursor/rules/core.mdc`](../.cursor/rules/core.mdc) | Short always-on rules (~40 lines) |
| [`.cursor/rules/backend.mdc`](../.cursor/rules/backend.mdc) | Backend rules when editing `backend/**` |
| [`.cursor/rules/frontend.mdc`](../.cursor/rules/frontend.mdc) | Frontend rules when editing `frontend/**` |
| [`docs/cursor/architecture-reference.md`](./architecture-reference.md) | Full architecture — use `@architecture-reference.md` when needed |

**User Rules** (Cursor → Customize → Rules): keep global rules short. Move detailed git/PR workflows to manual `@mention` rules so they are not sent on every chat.

## 4. One-week experiment

Track daily usage for 7 days with these defaults:

1. Composer 2.5 or Auto Cost for ~80% of work
2. New chat per task; max ~8 turns before reset
3. `@file` not `@codebase`
4. Tab/Cmd+K for small edits

| Day | Model mostly used | Chats started | Notes |
|-----|-------------------|---------------|-------|
| 1 | | | Baseline from Usage dashboard |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

**Success:** usage spread across the month instead of exhausted in 2–3 days. If still tight on Composer/Cost with short chats, check for Cloud Agents/automations, then consider Pro+.

## 5. Global Cursor settings (all projects)

**Settings → Indexing → Ignore Files** — add patterns like:

```
**/.env
**/node_modules/
**/.next/
```
