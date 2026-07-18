-- Marketplace funnel analytics columns on booking_requests + backfill.
-- Enquiry = client-initiated booking_requests (initiator = 'client').

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_response_time_seconds integer,
  ADD COLUMN IF NOT EXISTS payment_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_noted_at timestamptz;

ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_vendor_response_time_seconds_check;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_vendor_response_time_seconds_check
  CHECK (vendor_response_time_seconds IS NULL OR vendor_response_time_seconds >= 0);

ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_failure_reason_check;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_failure_reason_check
  CHECK (
    failure_reason IS NULL
    OR failure_reason IN (
      'NO_VENDOR_AVAILABLE',
      'VENDOR_UNAVAILABLE',
      'VENDOR_NO_RESPONSE',
      'PRICE_TOO_HIGH',
      'CUSTOMER_CANCELLED',
      'PAYMENT_FAILED',
      'OTHER'
    )
  );

CREATE INDEX IF NOT EXISTS idx_booking_requests_accepted_at
  ON public.booking_requests (accepted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor_first_response_at
  ON public.booking_requests (vendor_first_response_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_booking_requests_failure_reason
  ON public.booking_requests (failure_reason)
  WHERE failure_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_requests_status_payment
  ON public.booking_requests (status, payment_status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor_created
  ON public.booking_requests (vendor_user_id, created_at DESC);

COMMENT ON COLUMN public.booking_requests.accepted_at IS
  'When the vendor accepted (enquiry → bookable). Set once.';
COMMENT ON COLUMN public.booking_requests.vendor_first_response_at IS
  'First meaningful vendor response (message, accept, or decline). Set once.';
COMMENT ON COLUMN public.booking_requests.failure_reason IS
  'Analytics outcome for unfulfilled demand; does not replace status.';

-- Backfill accepted_at / declined_at from notifications when possible.
UPDATE public.booking_requests br
SET accepted_at = n.created_at
FROM (
  SELECT DISTINCT ON (booking_id) booking_id, created_at
  FROM public.booking_notifications
  WHERE kind = 'booking_accepted'
  ORDER BY booking_id, created_at ASC
) n
WHERE br.id = n.booking_id
  AND br.accepted_at IS NULL
  AND br.status IN ('accepted', 'completed', 'cancelled');

UPDATE public.booking_requests br
SET declined_at = n.created_at
FROM (
  SELECT DISTINCT ON (booking_id) booking_id, created_at
  FROM public.booking_notifications
  WHERE kind = 'booking_declined_by_vendor'
  ORDER BY booking_id, created_at ASC
) n
WHERE br.id = n.booking_id
  AND br.declined_at IS NULL
  AND br.status = 'declined';

-- Fallback: updated_at when status matches and still null.
UPDATE public.booking_requests
SET accepted_at = COALESCE(accepted_at, updated_at)
WHERE accepted_at IS NULL
  AND status IN ('accepted', 'completed');

UPDATE public.booking_requests
SET declined_at = COALESCE(declined_at, updated_at)
WHERE declined_at IS NULL
  AND status = 'declined';

UPDATE public.booking_requests
SET completed_at = COALESCE(
  completed_at,
  GREATEST(client_completion_confirmed_at, vendor_completion_confirmed_at),
  updated_at
)
WHERE completed_at IS NULL
  AND status = 'completed';

UPDATE public.booking_requests
SET refunded_at = COALESCE(refunded_at, updated_at)
WHERE refunded_at IS NULL
  AND payment_status IN ('refunded', 'partially_refunded');

UPDATE public.booking_requests
SET payment_requested_at = COALESCE(payment_requested_at, paid_at)
WHERE payment_requested_at IS NULL
  AND (paid_at IS NOT NULL OR stripe_checkout_session_id IS NOT NULL);

-- First vendor message → first response (when conversation linked).
UPDATE public.booking_requests br
SET
  vendor_first_response_at = v.first_at,
  vendor_response_time_seconds = GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (v.first_at - br.created_at)))::integer
  )
FROM (
  SELECT
    br2.id AS booking_id,
    MIN(m.created_at) AS first_at
  FROM public.booking_requests br2
  JOIN public.messages m ON m.conversation_id = br2.conversation_id
  WHERE br2.conversation_id IS NOT NULL
    AND m.sender_user_id = br2.vendor_user_id
    AND COALESCE(m.metadata->>'kind', '') IS DISTINCT FROM 'quote'
  GROUP BY br2.id
) v
WHERE br.id = v.booking_id
  AND br.vendor_first_response_at IS NULL;

-- Accept/decline as first response when still empty.
UPDATE public.booking_requests
SET
  vendor_first_response_at = COALESCE(accepted_at, declined_at),
  vendor_response_time_seconds = GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (COALESCE(accepted_at, declined_at) - created_at)))::integer
  )
WHERE vendor_first_response_at IS NULL
  AND COALESCE(accepted_at, declined_at) IS NOT NULL;

-- Soft failure reasons for terminal non-completed states.
UPDATE public.booking_requests
SET
  failure_reason = 'VENDOR_UNAVAILABLE',
  failure_noted_at = COALESCE(declined_at, updated_at)
WHERE failure_reason IS NULL
  AND status = 'declined';

UPDATE public.booking_requests
SET
  failure_reason = 'CUSTOMER_CANCELLED',
  failure_noted_at = COALESCE(cancelled_at, updated_at)
WHERE failure_reason IS NULL
  AND status = 'cancelled'
  AND cancelled_by = 'client';
