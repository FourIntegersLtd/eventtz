-- Optional: run once if you already applied 001_users_and_vendor_onboarding.sql when it included display_name.
ALTER TABLE public.users DROP COLUMN IF EXISTS display_name;
