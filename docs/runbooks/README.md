# Runbooks

Operational docs for the `api`/`web` rebuild once it is deployed. These are
drafts for the repo owner to apply by hand in GitHub, Sentry and the uptime
tool of choice — nothing here is applied automatically, and nothing here
creates a cloud resource, secret or GitHub setting on its own.

- [`sentry-alerts.md`](sentry-alerts.md) — alert rules to configure in Sentry.
- [`uptime-checks.md`](uptime-checks.md) — checks for `api`, `worker` and
  `web`, including the worker heartbeat proposal.
- [`github-security-settings.md`](github-security-settings.md) — Dependabot
  PRs are merged by hand; why there is no auto-merge or CodeQL.
- [`post-deploy-smoke-test.md`](post-deploy-smoke-test.md) — running
  `scripts/smoke/smoke_test.py` after a deploy.
- [`s3-uploads.md`](s3-uploads.md) — bucket CORS for browser presigned POST uploads.
