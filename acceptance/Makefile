# The freeze suite: black-box HTTP tests that must pass against the baseline
# backend first, then against the rebuilt api/ (TARGET=api).
TARGET ?= baseline
PYTHON := ../api/.venv/bin/python

.PHONY: env serve test lint capture

env:
	scripts/local_env.sh

serve:
	scripts/serve.sh $(TARGET)

test:
	TARGET=$(TARGET) $(PYTHON) -m pytest -q $(ARGS)

lint:
	../api/.venv/bin/ruff check --config ../api/pyproject.toml .
	../api/.venv/bin/ruff format --config ../api/pyproject.toml --check .

# Re-capture goldens from the baseline code into api/tests/golden/ (e.g. make capture SCRIPT=capture/content_goldens.py).
capture:
	scripts/capture.sh $(SCRIPT)
