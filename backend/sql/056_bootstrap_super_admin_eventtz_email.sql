-- Bootstrap super admin uses Eventtz ops inbox (hello@eventtz.com).
-- Run after auth.users / public.users exist for that email.

UPDATE public.users
SET
  user_type = 'admin',
  admin_role = 'super_admin'
WHERE lower(email) = lower('hello@eventtz.com');
