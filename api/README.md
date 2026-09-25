# Eventtz API

The rebuilt FastAPI backend (see `../docs/adr/`). It uses the same Supabase project and the same `/api/v1` paths as the baseline `../backend/`, which it will replace at cutover.

```bash
make install   # api/.venv (Python 3.13)
cp .env.example .env
make dev       # http://localhost:8001
make ci        # ruff + mypy + import-linter + guards + tests
```

Layout: `app/core/` (kernel), `app/adapters/` (real vendor clients), `app/features/<slice>/` (one product area each). How to add or rebuild a slice: [CONTRIBUTING.md](CONTRIBUTING.md).
