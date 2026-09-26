# One image, two Railway services (copied from OSCE `platform-api`, minus its
# private marking engine):
#   api      default CMD; `railway.toml` migrates the schema before each deploy
#   worker   `railway.worker.toml` overrides the start command to the job worker
#
# Two stages. `dependencies` holds the build tools and installs every package
# into /opt/venv. The final stage starts again from a clean base and copies only
# /opt/venv, so the build tools never reach the image that ships.

# ---- Stage 1: install the dependencies (throwaway) ------------------------
FROM python:3.13-slim AS dependencies

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VERSION=2.1.4 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

# Poetry goes into the system Python so it stays out of /opt/venv.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && pip install --no-cache-dir "poetry==${POETRY_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

# The virtualenv the final stage copies. Poetry installs into whichever
# environment `VIRTUAL_ENV` names when it is told not to create its own.
RUN python -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /srv
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root

# ---- Stage 2: the image that ships ----------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

# psycopg ships its own libpq (the `binary` extra), so the runtime needs no
# system packages beyond the base image.
COPY --from=dependencies /opt/venv /opt/venv

WORKDIR /srv
COPY . .

# Run as an unprivileged user. Dependencies in /opt/venv stay root-owned and
# read-only; the app logs to stdout and writes nothing under /srv.
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /srv
USER appuser

EXPOSE 8000
# The schema is migrated before deploy (`preDeployCommand` in railway.toml).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
