-- Support conversations: one Eventtz Support thread per end user (client or vendor).
-- Extends 014_chat_conversations_messages.sql.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS support_user_id uuid NULL REFERENCES public.users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS admin_last_read_at timestamptz;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_unique_pair;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_no_self;

ALTER TABLE public.conversations ALTER COLUMN client_user_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN vendor_user_id DROP NOT NULL;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('dm', 'support'));

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_shape_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_shape_check CHECK (
    (
      kind = 'dm'
      AND client_user_id IS NOT NULL
      AND vendor_user_id IS NOT NULL
      AND support_user_id IS NULL
      AND client_user_id <> vendor_user_id
    )
    OR (
      kind = 'support'
      AND support_user_id IS NOT NULL
      AND client_user_id IS NULL
      AND vendor_user_id IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_dm_pair
  ON public.conversations (client_user_id, vendor_user_id)
  WHERE kind = 'dm';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_support_user
  ON public.conversations (support_user_id)
  WHERE kind = 'support';

CREATE INDEX IF NOT EXISTS idx_conversations_support_user
  ON public.conversations (support_user_id)
  WHERE kind = 'support';

CREATE INDEX IF NOT EXISTS idx_conversations_kind
  ON public.conversations (kind);

COMMENT ON COLUMN public.conversations.kind IS
  'dm = client–vendor pair; support = Eventtz Support ↔ one end user.';
COMMENT ON COLUMN public.conversations.support_user_id IS
  'End user (client or vendor) on a support thread; null for DMs.';
COMMENT ON COLUMN public.conversations.admin_last_read_at IS
  'Staff read cursor for support threads.';
