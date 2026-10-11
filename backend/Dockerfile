# The `backend` Railway service (Root Directory /backend). The Dockerfile owns build and
# start; Railway's dashboard owns the health check, restart policy, watch paths and draining
# (docs/runbooks/railway.md). No Procfile, no runtime.txt, no nixpacks.toml, no railway.toml
# (Config as Code stops being read on 2026-12-01).
#
# Two stages: `dependencies` holds the build tools and installs every package into /opt/venv;
# the final stage starts again from a clean base and copies only /opt/venv, so the compilers
# never reach the image that ships.

# ---- Stage 1: install the dependencies (throwaway) ------------------------
FROM python:3.13-slim AS dependencies

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

# requirements.txt is the prod export of poetry.lock (`make requirements`).
COPY requirements.txt ./
RUN pip install -r requirements.txt

# ---- Stage 2: the image that ships ----------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

COPY --from=dependencies /opt/venv /opt/venv

WORKDIR /srv
COPY . .

# Run as an unprivileged user. /opt/venv stays root-owned and read-only; /srv is writable
# because app/core/logging.py writes logs/eventtz.log next to the code.
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /srv
USER appuser

EXPOSE 8000
# One worker, as the old start command ran. Graceful shutdown (110 s) fits inside Railway's
# 120 s draining. No --proxy-headers: Railway publishes no proxy addresses to trust, so the
# app reads the visitor's address from the edge's X-Real-IP itself (app/core/http.py, client_ip).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 75 --timeout-graceful-shutdown 110"]
