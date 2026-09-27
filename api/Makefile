# Every target runs inside api/.venv. `env -u VIRTUAL_ENV` stops a globally
# activated pyenv venv from hijacking poetry.
RUN := env -u VIRTUAL_ENV poetry run

.PHONY: install dev worker db-up db-down migrate migrate-down new-migration seed-admins seed-receipts lint format typecheck arch guards test test-unit ci openapi acceptance parity

install:
	env -u VIRTUAL_ENV POETRY_VIRTUALENVS_IN_PROJECT=true poetry install --extras dev --no-root

dev:
	$(RUN) uvicorn app.main:app --reload --port 8001

# The background job worker (procrastinate); a second Railway service in production.
worker:
	$(RUN) python -m app.worker.main

# Local Postgres (:5434) and Redis (:6381), clear of OSCE's :5433 / :6380.
db-up:
	docker compose up -d --wait

db-down:
	docker compose down

migrate:
	$(RUN) alembic upgrade head

migrate-down:
	$(RUN) alembic downgrade -1

# Fixed @example.com admin accounts for local browser checks (compose DB only).
seed-admins:
	$(RUN) python -m scripts.seed_local_admins

# Paid bookings with frozen receipt snapshots for local browser checks (compose DB only).
seed-receipts:
	$(RUN) python -m scripts.seed_local_receipts

# Autogenerate, then review by hand: constraint and index changes are often missed.
new-migration:
	@test -n "$(M)" || (echo 'usage: make new-migration M="what changed"' && exit 1)
	$(RUN) alembic revision --autogenerate -m "$(M)"

lint:
	$(RUN) ruff check .
	$(RUN) ruff format --check .

format:
	$(RUN) ruff check --fix .
	$(RUN) ruff format .

typecheck:
	$(RUN) mypy app

# Import rules, then proof the mapped models match the migrated schema (needs `make db-up migrate`).
arch:
	$(RUN) lint-imports
	$(RUN) alembic check

guards:
	$(RUN) python -m pytest -q tests/guards

test:
	$(RUN) python -m pytest -q

# The fast subset: no database, no Docker.
test-unit:
	$(RUN) python -m pytest -q tests/unit tests/golden tests/guards

ci: lint typecheck arch test

openapi:
	$(RUN) python -c "from app.openapi import write; write()"

# Black-box freeze suite (repo-root acceptance/) against this API on :8001.
acceptance:
	cd ../acceptance && TARGET=api $(MAKE) test

# Baseline routes api/ does not serve yet (compares against openapi.baseline.json).
parity:
	$(RUN) python -m tests.guards.test_routes_match_baseline
