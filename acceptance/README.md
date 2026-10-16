# Acceptance: the freeze suite

These are black-box HTTP tests of the product's behaviour. They are written to pass against the **baseline** `backend/` first, which freezes what users see today. The rebuilt `api/` must then pass the **same** tests. After cutover they become the post-deploy smoke test.

The two targets differ only inside `conftest.py` and `support/`:

- `admin_db` is local Supabase's service client on the baseline. On api/ it is `support/database.py`, which answers the same `table(...).select/insert/update/delete` calls from api/'s own Postgres, so the tests read the same on both.
- The old backend kept the session in cookies; api/ uses Bearer tokens (`support/bearer.py`), following the old cookie rules. The few assertions about `Set-Cookie` go through `assert_session_cookies_touched`.

Everything here runs against **local databases only**: the `admin_db` fixture refuses any URL that isn't local, and all outside services (Stripe, Resend, OpenAI, S3 and so on) are switched off.

```bash
make serve                          # api/ on :8001 over its compose Postgres (leave running)
make test                           # run the suite against it
make test ARGS="test_identity_session.py"
```

