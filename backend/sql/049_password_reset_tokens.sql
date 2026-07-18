-- Password reset tokens for Resend one-click forgot-password flow.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_created
  ON public.password_reset_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
  ON public.password_reset_tokens (expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.password_reset_tokens IS
  'One-click password reset: store SHA-256 of raw token only; 60m expiry; single use.';
