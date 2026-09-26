# Enabling Dependabot, CodeQL and auto-merge (draft)

This workstream added the workflow files under `.github/`; none of them take
effect until the repo owner flips the matching settings below in GitHub. An
agent cannot do this: it needs GitHub admin rights on the repo, which the
safety rules for this workstream explicitly withhold ("Must not create...
GitHub settings").

## 1. Dependabot version updates

`.github/dependabot.yml` already configures this — GitHub reads it
automatically once it exists on the default branch. Nothing to switch on;
just merge this branch to `main` and check **Insights → Dependency graph →
Dependabot** shows the three ecosystems (`api` pip, `web` npm,
`github-actions`) after the first scheduled run (Mondays).

## 2. Dependabot security updates (separate from version updates)

Optional but recommended alongside the config file above: **Settings →
Code security → Dependabot → Dependabot alerts** and **Dependabot security
updates**, both "Enable". This is GitHub's own vulnerability-driven PR
system (distinct from the scheduled version bumps in `dependabot.yml`) and
needs no file — it is a toggle only.

## 3. Auto-merge, repo-wide

> **Do not turn this on yet.** `ci.yml`'s `ci-gate` currently tests only the
> baseline `backend/` and `frontend/`. A Dependabot bump to `api/` or `web/`
> would pass that gate without a single `api/` or `web/` test running, and
> auto-merge would merge it. Enable auto-merge only after `ci.yml` runs
> `make ci` for `api/` and `npm run ci` for `web/` and `ci-gate` depends on both
> (planned for the cut-over, when `api/` and `web/` replace the baseline).

**Settings → General → Pull Requests → "Allow auto-merge"** must be checked,
or `.github/workflows/dependabot-automerge.yml`'s `gh pr merge --auto` call
fails outright (GitHub rejects enabling auto-merge on a repo where the
feature is off).

## 4. Branch protection on `main`

`gh pr merge --auto` merges a PR **once its required status checks pass** —
if `main` has no required checks configured, `--auto` merges immediately
with no gate at all, which defeats the point.

**Settings → Branches → Branch protection rules → `main` → "Require status
checks to pass before merging"**, and add at least:
- `ci-gate` (from `.github/workflows/ci.yml` — already exists and already
  triggers on `pull_request`, unchanged by this workstream)
- `pip-audit (api)` and `npm-audit (web)` (from
  `.github/workflows/security-audit.yml`) if the team wants a vulnerability
  finding to block a Dependabot merge, not just get logged
- optionally the CodeQL jobs (`analyze (python)`, `analyze (javascript-typescript)`
  from `.github/workflows/codeql.yml`) if the team wants a new CodeQL
  finding to also block merges rather than only appear in the Security tab

## 5. CodeQL

`.github/workflows/codeql.yml` runs CodeQL directly via `github/codeql-action`
(not GitHub's "default setup" UI toggle), so there is nothing to enable for
the workflow to run — merging it to `main` is enough. Findings appear under
**Security → Code scanning alerts**. If GitHub's own "default setup" was
already turned on for this repo before this workflow merges, turn it off
first (**Settings → Code security → Code scanning → Default setup →
Disable**) to avoid two CodeQL configurations analyzing the same code.

## 6. Secrets this workflow set needs

None. `dependabot-automerge.yml` and `codeql.yml` both use the
repo-provided `secrets.GITHUB_TOKEN`, which GitHub creates automatically per
workflow run — nothing to add in **Settings → Secrets and variables**.

The smoke test script (`scripts/smoke/smoke_test.py`) reads
`SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` from the environment it is run
in, not from a committed GitHub secret — see `post-deploy-smoke-test.md` for
where to put those if the team wants to run it from CI later. Nothing here
requires that today, since this workstream only proved the script against a
local server.
