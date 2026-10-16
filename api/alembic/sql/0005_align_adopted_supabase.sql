-- Revision 0005: bring a database built by backend/sql/ (the live Supabase one)
-- level with the 0002 snapshot. Every statement is idempotent and leaves a
-- database built by `alembic upgrade head` exactly as it was. Definitions are
-- copied verbatim from 0002_baseline_schema.sql; keep them identical.

-- backend/sql/033: daily capacity (missing on live). The parser first: the trigger function calls it.
CREATE OR REPLACE FUNCTION public.eventtz_parse_max_bookings_per_day(payload jsonb) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  raw text;
  parsed int;
BEGIN
  IF payload IS NULL THEN
    RETURN 1;
  END IF;
  raw := COALESCE(payload ->> 'maxBookingsPerDay', '1');
  raw := NULLIF(regexp_replace(raw, '[^0-9.]', '', 'g'), '');
  IF raw IS NULL THEN
    RETURN 1;
  END IF;
  BEGIN
    parsed := raw::numeric::int;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN 1;
  END;
  RETURN GREATEST(1, LEAST(20, parsed));
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_booking_daily_capacity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cap integer;
  payload jsonb;
  day date;
  day_end date;
  booking_count integer;
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending', 'accepted')
     AND NEW.status IN ('pending', 'accepted')
     AND OLD.vendor_user_id = NEW.vendor_user_id
     AND OLD.event_date = NEW.event_date
     AND OLD.event_end_date IS NOT DISTINCT FROM NEW.event_end_date THEN
    RETURN NEW;
  END IF;

  SELECT v.payload
  INTO payload
  FROM public.vendors v
  WHERE v.user_id = NEW.vendor_user_id
  LIMIT 1;

  cap := public.eventtz_parse_max_bookings_per_day(payload);
  day_end := COALESCE(NEW.event_end_date, NEW.event_date);
  day := NEW.event_date;

  WHILE day <= day_end LOOP
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW.vendor_user_id::text),
      hashtext(day::text)
    );

    SELECT COUNT(*)::integer
    INTO booking_count
    FROM public.booking_requests br
    WHERE br.vendor_user_id = NEW.vendor_user_id
      AND br.status IN ('pending', 'accepted')
      AND br.id IS DISTINCT FROM NEW.id
      AND day >= br.event_date
      AND day <= COALESCE(br.event_end_date, br.event_date);

    IF booking_count >= cap THEN
      RAISE EXCEPTION
        'vendor_daily_capacity_exceeded:%:%',
        day::text,
        cap::text
        USING ERRCODE = 'check_violation';
    END IF;

    day := day + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_booking_daily_capacity() IS 'Serializes booking creates/updates per vendor/day and rejects when maxBookingsPerDay is reached.';

CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor_active_dates ON public.booking_requests USING btree (vendor_user_id, event_date, event_end_date) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));

-- Creating the trigger does not check existing rows; docs/runbooks/cutover.md has the over-capacity query to run first.
CREATE OR REPLACE TRIGGER trg_booking_requests_daily_capacity BEFORE INSERT OR UPDATE OF status, event_date, event_end_date, vendor_user_id ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_daily_capacity();

-- backend/sql/006: admin vendor list view (missing on live; nothing in api/ or backend/ reads it).
CREATE OR REPLACE VIEW public.admin_vendor_list AS
 WITH candidate_ids AS (
         SELECT users.id AS user_id
           FROM public.users
          WHERE (users.user_type = 'vendor'::public.user_type)
        UNION
         SELECT vendors.user_id
           FROM public.vendors
        )
 SELECT v.id,
    c.user_id,
    u.email,
    COALESCE(v.status, 'draft'::text) AS status,
    COALESCE(v.approval_status, 'pending'::text) AS approval_status,
    COALESCE(v.current_step, 1) AS current_step,
    COALESCE(v.payload, '{}'::jsonb) AS payload,
    COALESCE(v.created_at, u.created_at) AS created_at,
    COALESCE(v.updated_at, u.updated_at) AS updated_at
   FROM ((candidate_ids c
     LEFT JOIN public.users u ON ((u.id = c.user_id)))
     LEFT JOIN public.vendors v ON ((v.user_id = c.user_id)));

COMMENT ON VIEW public.admin_vendor_list IS 'Rows for admin vendor list: union of vendor-role users and vendors profile rows, with coalesced defaults.';

-- backend/sql/071: messages.body cap raised from 5000 to 15000 (live still has 5000).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_body_len'
      AND pg_get_constraintdef(oid) <> 'CHECK (((char_length(body) >= 1) AND (char_length(body) <= 15000)))'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_body_len;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_body_len'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_body_len
      CHECK (((char_length(body) >= 1) AND (char_length(body) <= 15000)));
  END IF;
END $$;

-- backend/sql/003 renamed the table vendor_onboarding -> vendors; live kept the old constraint names.
DO $$
DECLARE
  constraint_pair record;
BEGIN
  FOR constraint_pair IN
    SELECT * FROM (VALUES
      ('vendor_onboarding_pkey', 'vendors_pkey'),
      ('vendor_onboarding_user_id_key', 'vendors_user_id_key'),
      ('vendor_onboarding_current_step_check', 'vendors_current_step_check'),
      ('vendor_onboarding_status_check', 'vendors_status_check')
    ) AS names (old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vendors'::regclass AND conname = constraint_pair.old_name)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.vendors'::regclass AND conname = constraint_pair.new_name)
    THEN
      EXECUTE format('ALTER TABLE public.vendors RENAME CONSTRAINT %I TO %I', constraint_pair.old_name, constraint_pair.new_name);
    END IF;
  END LOOP;
END $$;

-- backend/sql/077 replaced vendors.user_id's CASCADE key with a RESTRICT one, but dropped it by its new
-- name (`vendors_user_id_fkey`), so on live the old CASCADE key `vendor_onboarding_user_id_fkey`
-- survived next to the new one. Drop it; make sure the RESTRICT key exists.
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendor_onboarding_user_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vendors'::regclass AND conname = 'vendors_user_id_fkey' AND confdeltype = 'r'
  ) THEN
    ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_user_id_fkey;
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Column comments live holds in older wording (backend/sql files were edited after live ran them) or lacks.
COMMENT ON COLUMN public.users.share_address IS 'Legacy client pref; booking venue is always visible to vendors. Not used for contact masking.';
COMMENT ON COLUMN public.booking_requests.paid_at IS 'Set automatically when payment succeeds (e.g. Stripe). Not used for manual confirmation.';
COMMENT ON COLUMN public.booking_requests.vendor_adjustments IS 'Array of {id, tag, label, amount_gbp} - additions (positive) or discounts (negative) before accept; client total includes Eventtz service fee on top.';
COMMENT ON COLUMN public.conversations.kind IS 'dm = client-vendor pair; support = Eventtz Support ↔ one end user.';
COMMENT ON COLUMN public.messages.body IS 'Message body: plain text for user DMs; sanitized HTML for admin support messages (metadata.format = html).';
COMMENT ON COLUMN public.messages.metadata IS 'Optional structured payload for non-plain-text messages, e.g. {"kind":"quote","booking_request_id":"...","event_name":"...","total_label":"...","status":"pending"}.';
