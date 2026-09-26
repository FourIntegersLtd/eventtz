# Acceptance: the freeze suite

These are black-box HTTP tests of the product's behaviour. They are written to pass against the **baseline** `backend/` first, which freezes what users see today. The rebuilt `api/` must then pass the **same** tests. After cutover they become the post-deploy smoke test.

The two targets differ only inside `conftest.py` and `support/`:

- `admin_db` is local Supabase's service client on the baseline. On api/ it is `support/database.py`, which answers the same `table(...).select/insert/update/delete` calls from api/'s own Postgres, so the tests read the same on both.
- A browser's session is cookies on the baseline. On api/ it is Bearer tokens (`support/bearer.py`), following the baseline's rules for when cookies are set and cleared. That is the rebuild's one deliberate contract change. The few assertions about `Set-Cookie` go through `assert_session_cookies_touched`.
- Behaviour api/ has not rebuilt yet is listed in `conftest.NOT_YET_ON_API`. On `TARGET=api` those tests are strict expected failures, so an entry must be deleted once its tests pass.

Everything here runs against **local databases only**. `scripts/local_env.sh` and the `admin_db` fixture refuse any URL that isn't local. The baseline runs from a copy in `.run/` that has no `.env`, so hosted credentials can never be loaded. All outside services (Stripe, Resend, OpenAI, S3 and so on) are switched off.

```bash
npx supabase start                  # once; then apply backend/sql (see docs/adr/0006)
make env                            # write .env.local from `supabase status`
make serve                          # baseline on :8000 (leave running)
make test                           # run the suite against it
make serve TARGET=api               # rebuilt api on :8001
make test TARGET=api ARGS="test_identity_session.py"
```

## Writing a freeze test

- One file per slice: `test_<slice>_<area>.py`. Each test covers a route's success shape, its error statuses and `detail` text (asserted verbatim, because the web app shows them as they are), and the auth matrix.
- Use the fixtures in `conftest.py`:
  - browsers: `anonymous`, `as_client`, `as_vendor`, `as_staff`, `as_super_admin`
  - accounts: `client_account` and so on
  - `admin_db`: for seeding
  - `seed_account` and `unique_email`: for a fresh account in a specific state
- If the baseline behaves oddly, **freeze what it does** and mark it `# BASELINE BUG:` with an explanation. Fix it later in its own commit, changing the test with it.
- The baseline limits sign-ins in memory: 10 per email and 40 per IP every 15 minutes. Every browser gets its own fake IP. Any test that signs in directly should sign in as a fresh `seed_account(..., unique_email(...))`.
- Naming and docstring rules are the same as in `api/` (checked by the api guards).
