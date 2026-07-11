-- Eventtz: public.users (profile + role) + vendors (JSONB vendor profile per vendor user)
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f backend/sql/001_users_and_vendor_onboarding.sql
--
-- Requires: auth.users (Supabase Auth). Service role bypasses RLS for backend API calls.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
    CREATE TYPE public.user_type AS ENUM ('client', 'vendor', 'admin');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- public.users — one row per auth user; role for app routing and permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  user_type public.user_type NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase_chk CHECK (email IS NULL OR email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users (user_type);

COMMENT ON TABLE public.users IS 'App profile linked to auth.users; user_type drives client vs vendor vs admin UI.';

-- ---------------------------------------------------------------------------
-- vendors — one row per vendor account; serializable JSON only (no file blobs; use Storage later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'complete')),
  current_step integer NOT NULL DEFAULT 1
    CHECK (current_step >= 1 AND current_step <= 20),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors (user_id);

COMMENT ON COLUMN public.vendors.payload IS
  'JSON snapshot of vendor profile form (strings, numbers, booleans, string arrays). Files: store storage paths when upload exists.';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eventtz_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (optional; PostgREST service role bypasses. Enable for future direct client access.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Backend uses service role — no policies required for server-only access.
-- Example policy for authenticated users (uncomment and tune when using Supabase client from browser):
-- CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
-- CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
