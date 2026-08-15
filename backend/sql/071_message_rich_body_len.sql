-- Allow sanitized HTML in admin support messages (visible text still capped at 5000 in app code).
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_len;
ALTER TABLE public.messages ADD CONSTRAINT messages_body_len
  CHECK (char_length(body) >= 1 AND char_length(body) <= 15000);

COMMENT ON COLUMN public.messages.body IS
  'Message body: plain text for user DMs; sanitized HTML for admin support messages (metadata.format = html).';
