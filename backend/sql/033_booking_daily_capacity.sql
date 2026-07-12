-- Concurrency-safe maxBookingsPerDay enforcement (vendor payload JSON, default 1, cap 20).
-- Run after 032_vendor_business_name_unique.sql.
--
-- Uses pg_advisory_xact_lock per (vendor_user_id, calendar day) so concurrent inserts
-- serialize and the second transaction sees the first booking before deciding.

CREATE OR REPLACE FUNCTION public.eventtz_parse_max_bookings_per_day(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.enforce_booking_daily_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap integer;
  payload jsonb;
  day cursor_date date;
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

DROP TRIGGER IF EXISTS trg_booking_requests_daily_capacity ON public.booking_requests;
CREATE TRIGGER trg_booking_requests_daily_capacity
  BEFORE INSERT OR UPDATE OF status, event_date, event_end_date, vendor_user_id
  ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_daily_capacity();

CREATE INDEX IF NOT EXISTS idx_booking_requests_vendor_active_dates
  ON public.booking_requests (vendor_user_id, event_date, event_end_date)
  WHERE status IN ('pending', 'accepted');

COMMENT ON FUNCTION public.enforce_booking_daily_capacity() IS
  'Serializes booking creates/updates per vendor/day and rejects when maxBookingsPerDay is reached.';
