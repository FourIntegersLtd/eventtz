-- Admin team roles + dispute assignment index.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_role text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_admin_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_admin_role_check
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'admin'));

COMMENT ON COLUMN public.users.admin_role IS
  'When user_type = admin: super_admin can manage the team; admin is a standard operator.';

-- Bootstrap the first super admin (must already exist in auth.users + public.users as admin).
UPDATE public.users
SET
  user_type = 'admin',
  admin_role = 'super_admin'
WHERE lower(email) = lower('hello@eventtz.com');

-- Default role for any other admins missing admin_role.
UPDATE public.users
SET admin_role = 'admin'
WHERE user_type = 'admin' AND admin_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_cases_assigned_admin
  ON public.dispute_cases (assigned_admin_id);
