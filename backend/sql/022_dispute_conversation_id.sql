-- Link disputes to the client–vendor chat thread for support investigations.
-- Run after 018_admin_console.sql and 014_chat_conversations_messages.sql.

ALTER TABLE public.dispute_cases
  ADD COLUMN IF NOT EXISTS conversation_id uuid
  REFERENCES public.conversations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_cases_conversation
  ON public.dispute_cases (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN public.dispute_cases.conversation_id IS
  'In-app chat between the same client and vendor, stored when the dispute is opened for investigation.';
