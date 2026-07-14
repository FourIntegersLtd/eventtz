-- Enable RLS on every base table in public (run in Supabase SQL Editor).
-- Safe for Eventtz while the FastAPI backend uses the service_role key
-- (service_role bypasses RLS). anon / authenticated clients get zero rows
-- until you add policies — which is usually what you want if the API owns access.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'              -- ordinary tables only (not views)
      AND n.nspname = 'public'
      AND c.relrowsecurity = false     -- already-enabled tables skipped
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schemaname,
      r.tablename
    );
    RAISE NOTICE 'RLS enabled on %.%', r.schemaname, r.tablename;
  END LOOP;
END $$;

-- Optional: confirm
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
