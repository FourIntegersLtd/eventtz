-- Email verification for client/vendor signup (app-owned, same pattern as password reset).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

COMMENT ON COLUMN public.users.email_verified_at IS
  'When the user confirmed their email via Eventtz verify link. NULL = must verify before sign-in (client/vendor).';

-- Existing accounts are treated as already verified so we do not lock anyone out.
UPDATE public.users
SET email_verified_at = COALESCE(created_at, now())
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_created
  ON public.email_verification_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires
  ON public.email_verification_tokens (expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.email_verification_tokens IS
  'One-click email verification: store SHA-256 of raw token only; 60m expiry; single use.';
