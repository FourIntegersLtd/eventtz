# Dependabot and dependency audits

What `.github/` does for dependency hygiene, and why there is no auto-merge or
CodeQL. The repo is private on GitHub's free plan, which rules out two things:
branch protection (required status checks) and code scanning.

## 1. Dependabot version updates

`.github/dependabot.yml` opens weekly PRs for `api` (pip), `web` (npm) and
`github-actions`. Check **Insights → Dependency graph → Dependabot** after a
Monday run.

**Every Dependabot PR is merged by hand**, after:

- `make ci` passes in `api/` (for a pip PR), or `npm ci && npm run ci` in `web/`
  (for an npm PR), run locally on the PR branch. `ci.yml`'s `ci-gate` tests
  only the baseline `backend/` and `frontend/`, so a green PR says nothing
  about `api/` or `web/` until the cutover adds them.
- for a major bump, reading the changelog.

## 2. Why there is no auto-merge workflow

`gh pr merge --auto` waits for *required* status checks. With no branch
protection there are none, so it merges at once. That is how #42, #47 and #54
reached `main` untested, and why `dependabot-automerge.yml` was removed.
Bring it back only when both hold: `ci.yml` runs `api/` and `web/` CI, and
`main` requires `ci-gate` (a paid plan or a public repo).

## 3. Dependabot security updates

Optional: **Settings → Code security → Dependabot alerts** and **Dependabot
security updates**. These are toggles, not files.

## 4. Audits in CI

`.github/workflows/security-audit.yml` runs `pip-audit (api)` and
`npm-audit (web)` (runtime dependencies, high and critical only) on every PR and push to `main`. They
report; nothing can block a merge without branch protection.

## 5. Why there is no CodeQL

Uploading CodeQL results needs code scanning, which private repos get only with
GitHub Advanced Security. The workflow failed on every run, so it was removed.
Add it back (as `github/codeql-action` with `contents: read` and
`security-events: write` on the job) if the repo goes public or the plan
changes.

## 6. Secrets

None. The smoke test (`scripts/smoke/smoke_test.py`) reads
`SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` from its own environment; see
`post-deploy-smoke-test.md`.
