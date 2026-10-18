---
name: build-feature
description: Build any new feature, or change an existing behaviour, so it ships without breaking the rest. Use whenever a feature, screen, route, job or behaviour change is requested, before writing any implementation code. Owner hand-off, spec matrix, sibling check, impact, failing tests, smallest build, proof with the owner's verify skill, reviews.
---

# Build a feature

Start the work as, or hand it to, the owner for the paths (`.claude/OWNERS.md`; Agent with
`subagent_type: <area>-owner`) and read its rule file (`.claude/rules/<area>.md`). A feature that
spans owners is split by owner, with the contract between them (route, schema, error codes)
written down first. Work through the steps in order; each ends with something written down.

1. **Spec matrix** (short; show the user anything that is a product choice, with a recommended
   default): roles allowed and refused (client, vendor, each staff permission, signed out); for
   each load: loading, empty, failed; for each action: success, each error `code`, double submit,
   stale data; state over time (booking status, payment status, suspension, deletion); out of scope.
2. **Sibling check**: grep every other route, job or screen that asks the same question (the
   visibility helpers, a status check, a price read) and change them together.
3. **Impact**: grep callers; list the guards, goldens and `acceptance/` tests that cover them.
   A path or method removed from `api/openapi.baseline.json` fails CI: that is ask-first.
4. **Failing tests** at the lowest level per matrix row (unit for `domain*.py`, http for a route,
   repository for a write, vitest for web logic). See each fail for the stated reason. Assert
   literal user-visible values; fakes from `tests/support/fakes.py`, never `patch("app.…")`.
5. **Smallest build**: reuse first, no new layer without a second caller, delete what is now
   dead, no shims. Follow `AGENTS.md` (SQL in `repository*.py`, `AppError` codes, pence in
   `domain.py`, docstrings, descriptive names). A schema change is an Alembic revision reviewed by
   hand; a response change runs `make openapi` and updates `web/lib/api-types.ts` by hand; a new
   setting goes in `core/settings.py` and `api/.env.example`.
6. **Prove** with the owner's verify skill at the level it names, and check the running app,
   stored row or rendered screen. Then `quality-reviewer` always, and `reviewer` (opus) plus
   `/security-review` for auth, money, deletion or a migration. Fix findings before reporting done.
7. **Write it down**: the slice README (Use cases, Invariants, Routes) if they changed, and the
   owner's rule file if you learned a trap. Anything you chose not to do is said in the report,
   not left as a TODO comment.

Stage by explicit path. No repo-wide formatters. No `git stash`. Commit only when asked.
