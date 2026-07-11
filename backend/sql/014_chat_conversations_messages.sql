-- In-app chat: one conversation per client–vendor pair; messages + read pointers on conversation.
-- Run after public.users exists (001). Backend-only writes via service role (RLS disabled).

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  vendor_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  client_last_read_at timestamptz,
  vendor_last_read_at timestamptz,
  CONSTRAINT conversations_no_self CHECK (client_user_id <> vendor_user_id),
  CONSTRAINT conversations_unique_pair UNIQUE (client_user_id, vendor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_client ON public.conversations (client_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendor ON public.conversations (vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON public.conversations (last_message_at DESC NULLS LAST);

COMMENT ON TABLE public.conversations IS
  'DM thread between a client and a vendor; last_read_* drive unread badges.';

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_len CHECK (char_length(body) >= 1 AND char_length(body) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);

COMMENT ON TABLE public.messages IS 'Chat messages; sender must be client or vendor on the conversation.';

ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
