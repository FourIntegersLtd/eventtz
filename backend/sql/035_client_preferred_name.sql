-- Client preferred name (shown to vendors instead of masked email) and
-- first-visit client onboarding completion tracking.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS client_onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.users.preferred_name IS
  'What the client wants to be called; shown to vendors on booking requests. Never an email.';

COMMENT ON COLUMN public.users.client_onboarding_completed_at IS
  'When the client finished (or skipped) the first-visit portal onboarding modal.';
