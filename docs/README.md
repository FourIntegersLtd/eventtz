# Eventtz docs map

| Doc | Read it when |
|---|---|
| [`../AGENTS.md`](../AGENTS.md) | Always first: repo map, commands, boundaries, traps |
| [`adr/`](adr/) | Changing structure, the data layer, auth, errors or realtime |
| [`domain-rules.md`](domain-rules.md) | Touching payments, pricing, visibility, bookings, auth flows (until each rule moves into its slice README) |
| [`../api/CONTRIBUTING.md`](../api/CONTRIBUTING.md) | Adding or rebuilding a backend slice |
| `../api/app/features/<slice>/README.md` | Working in that slice: purpose, use cases, invariants, routes |
| [`../api/README.md`](../api/README.md) | Running the new API |
| [`../backend/README.md`](../backend/README.md) | Baseline API: running, deploying (Railway), Stripe CLI |
| [`../web/README.md`](../web/README.md) | Running the new web app |
| [`../frontend/UI-CONVENTIONS.md`](../frontend/UI-CONVENTIONS.md) | Building UI: feedback, mobile, motion |

One fact lives in one place. If you find it in two, delete one and link.
