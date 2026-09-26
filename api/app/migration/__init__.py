"""Cut-over tooling (workstream 17): move Supabase's data into a Railway `api/` database once.

**Not a feature slice.** It has no router, no `models.py` mapped by SQLAlchemy
and no place in `app.main`'s startup — nothing in `app/` imports it, and
`tests/guards/test_migration_is_contained.py` holds that. It is a standalone
script, run by hand (or by CI in a rehearsal), and deleted once the real
cut-over has happened and its job is done.

See `docs/runbooks/cutover.md` for the full procedure and `cli.py` for the
four commands (`export`, `load`, `verify`, `report`). `safety.py`'s local-only
check applies to every one of them.
"""

from __future__ import annotations
