-- Vendor-initiated quotes on booking_requests + notification kinds.
-- Run in Supabase SQL Editor after 014_chat_conversations_messages.sql and 010_booking_requests.sql.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS initiator text NOT NULL DEFAULT 'client'
    CHECK (initiator IN ('client', 'vendor'));

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS conversation_id uuid
    REFERENCES public.conversations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_conversation
  ON public.booking_requests (conversation_id)
  WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN public.booking_requests.initiator IS
  'client = enquiry from explore; vendor = custom quote sent to client (client accepts pending).';
COMMENT ON COLUMN public.booking_requests.conversation_id IS
  'Optional chat thread the quote was sent from.';

-- Extend notification kinds for vendor quotes.
ALTER TABLE public.booking_notifications DROP CONSTRAINT IF EXISTS booking_notifications_kind_check;
ALTER TABLE public.booking_notifications ADD CONSTRAINT booking_notifications_kind_check
  CHECK (kind IN (
    'booking_accepted',
    'booking_completed',
    'booking_cancelled_by_vendor',
    'booking_pricing_updated',
    'vendor_quote_received',
    'vendor_quote_accepted',
    'vendor_quote_declined',
    'vendor_quote_withdrawn'
  ));
