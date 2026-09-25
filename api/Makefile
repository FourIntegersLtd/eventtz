# Every target runs inside api/.venv. `env -u VIRTUAL_ENV` stops a globally
# activated pyenv venv from hijacking poetry.
RUN := env -u VIRTUAL_ENV poetry run

.PHONY: install dev lint format typecheck arch guards test ci openapi acceptance

install:
	env -u VIRTUAL_ENV POETRY_VIRTUALENVS_IN_PROJECT=true poetry install --extras dev --no-root

dev:
	$(RUN) uvicorn app.main:app --reload --port 8001

lint:
	$(RUN) ruff check .
	$(RUN) ruff format --check .

format:
	$(RUN) ruff check --fix .
	$(RUN) ruff format .

typecheck:
	$(RUN) mypy app

arch:
	$(RUN) lint-imports

guards:
	$(RUN) python -m pytest -q tests/guards

test:
	$(RUN) python -m pytest -q

ci: lint typecheck arch test

openapi:
	$(RUN) python -c "from app.core.openapi import write; write()"

# Black-box freeze suite (repo-root acceptance/) against this API on :8001.
acceptance:
	cd ../acceptance && TARGET=api $(MAKE) test
