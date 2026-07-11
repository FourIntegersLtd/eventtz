-- Simplest backend access: PostgREST + service role against RLS-enabled tables can still
-- fail depending on project settings. For tables only touched by your FastAPI backend
-- (not the browser), disabling RLS avoids policy puzzles. Run once in Supabase SQL Editor.

ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors DISABLE ROW LEVEL SECURITY;
