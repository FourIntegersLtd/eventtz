# Sentry alert rules (draft)

Apply these by hand in the Sentry project(s) for `api` and `worker` once
`SENTRY_DSN` is set for each service (`api/app/core/observability.py` only
starts reporting when that setting is non-empty, so nothing is sent until
then). If `api` and `worker` share one Sentry project, tag alerts by
`environment`/`server_name` instead of splitting projects; either works, this
runbook assumes separate projects since that is the simpler alert routing.

None of this can be applied by an agent: it needs a Sentry login and org
admin rights to create alert rules and routing.

## 1. Error rate spike (api)

- **Condition:** number of events matching `level:error` in the `api`
  project is greater than 20 in 5 minutes.
- **Filter:** `environment:production`.
- **Action:** notify the on-call channel (Slack/email) immediately; do not
  batch this one — a spike usually means a bad deploy.
- **Why this shape:** a single new error type climbing slowly is a bug to
  triage during the day; a sudden burst across many events is what a bad
  release looks like, and that is worth an immediate page.

## 2. New issue type (api, worker)

- **Condition:** "A new issue is created" (Sentry's built-in trigger).
- **Filter:** `environment:production`, `level:error` or higher.
- **Action:** notify the team channel, not on-call — a brand-new error type
  is worth triage but is not automatically an outage.

## 3. Unhandled exception in the payments code path (api)

- **Condition:** number of events matching `level:error` where
  `transaction` starts with `/api/v1/webhooks` OR the culprit/module contains
  `payments` or `bookings.service_payments`, greater than 1 in 5 minutes.
- **Filter:** `environment:production`.
- **Action:** page on-call immediately, separate from the general error-rate
  rule above.
- **Why:** AGENTS.md's traps call out that a webhook or payout that raises
  can leave `payment_status` inconsistent with `booking_requests.status`, and
  Stripe retries webhooks on non-2xx — a silent failure here compounds every
  retry, so it should not wait for a volume threshold to page.

## 4. Worker process stopped reporting (worker)

- **Condition:** "No events received" over 15 minutes, filtered to
  `environment:production` and `server_name` matching the worker's Railway
  service. Sentry's SDK sends a heartbeat/session event on process start,
  which is enough to notice the process itself dying (crash-looping, OOM),
  distinct from the **uptime check proposal** in `uptime-checks.md`, which
  checks that queued jobs are actually being drained, not just that the
  process is alive.
- **Action:** notify on-call.

## 5. Job failure rate (worker)

- **Condition:** number of events matching `level:error` in the `worker`
  project greater than 5 in 10 minutes.
- **Filter:** `environment:production`.
- **Action:** notify the team channel; escalate to on-call if it keeps
  climbing (a second, higher-threshold rule, e.g. >20 in 10 minutes, paging
  on-call, is a reasonable second step once real job-failure volume is
  known — start with one rule and split it once there is data).

## Setting these up

In Sentry: **Project → Alerts → Create Alert → Issues** for the
new-issue/error-rate rules, and **Create Alert → Metric Alert** for the
threshold-based ones (spike, job failure rate). Point each rule's action at
whichever integration the team already uses (Slack, PagerDuty, email) — this
repo does not prescribe one.
