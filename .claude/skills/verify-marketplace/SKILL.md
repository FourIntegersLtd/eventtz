---
name: verify-marketplace
description: How to prove a change to marketplace or planner works (explore and search, favorites, geo, vendor/admin analytics, AI event planner, client browse/planner/dashboard screens). Use before calling any marketplace or planner change done. Lists the proof each kind of change needs and the traps that make a green run meaningless.
---

# Verify marketplace

Pick the **lowest level that can see your change**, run it, and report the command and its output.

| Your change | Minimum proof |
|---|---|
| Pure domain rule (`domain*.py`, ranking, budget bands) | Level 1, and show a route or service calls it |
| Router, service, repository, schema | Level 1 + Level 2 on the matching acceptance file |
| Query parsing, ranking, plan output (goldens) | Level 1; a golden diff means behaviour changed: say so, never edit the fixture to pass |
| Web screen or `web/lib` helper | Level 1 web command; Level 3 for anything visible |
| Anything touching the OpenAI path | Level 1 with the fake model; say that no real model call was made |

## Level 1: tests (~10 s with the Docker services up)

```bash
cd api
make db-up        # Postgres :5434, Redis :6381. Without them DB tests skip and a pass means nothing
poetry run python -m pytest -q tests/http/test_planner_*.py tests/unit/test_planner_*.py \
  tests/golden/test_marketplace_goldens.py
make guards       # the architecture guards
```

77 passed, 0 skipped on 2026-10-18 (Postgres :5434 up). The marketplace HTTP behaviour itself is
pinned by `acceptance/` (Level 2); the api-side marketplace slice has no `test_marketplace_*` http file.

Web:

```bash
cd web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run \
  features/admin/marketplace/marketplaceAnalyticsModel.test.ts \
  features/client/planner/plannerModel.test.ts lib/marketplaceSearchParams.test.ts \
  lib/photonLocationAutocomplete.test.ts features/client/browse
```

## Level 2: acceptance (black box over HTTP, local DB only)

```bash
cd acceptance && make serve          # api/ on :8001 over its compose Postgres; leave running
make test ARGS="test_marketplace_explore.py test_marketplace_favorites.py test_marketplace_geo_analytics.py test_planner.py"
```

`ARGS` is passed straight to pytest, so `-k name` works too. These files freeze behaviour; a
failing one means the contract changed.

## Level 3: the running app

`make dev` (api :8001) and `npm run dev` (web :3001), signed in as a local client. Check: `/client/browse`
lists only listed vendors, a search with OpenAI unset still returns results (simple mode), favorites
toggle and persist on reload, `/client/planner` creates and archives a plan and "ensure event" gives
the same event twice. Outside services are off locally; do not point at live Stripe or OpenAI.

## Traps

- DB tests **skip silently** without Docker: read the "skipped" count in the summary (must be 0).
- Check pytest's **exit code**, not the tail. Use `poetry run python -m pytest` (stale shebang on `pytest`).
- Docker hung: create a fresh database on the compose Postgres and set
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.
- Goldens (`tests/golden/marketplace/*.json`) and `acceptance/` quirks are pinned on purpose; do not "fix" them.
- A planner check on a fresh DB needs listed vendors; with none, plans look empty for the wrong reason.
- Web: Node is not on PATH; use the export above. `npm run build` is the only full type check of screens.
