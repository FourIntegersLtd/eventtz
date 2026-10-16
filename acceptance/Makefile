# The acceptance suite: black-box HTTP tests of api/, frozen from the old backend's
# behaviour before it was retired.
PYTHON := ../api/.venv/bin/python

.PHONY: serve test lint

serve:
	scripts/serve.sh

test:
	$(PYTHON) -m pytest -q $(ARGS)

lint:
	../api/.venv/bin/ruff check --config ../api/pyproject.toml .
	../api/.venv/bin/ruff format --config ../api/pyproject.toml --check .
