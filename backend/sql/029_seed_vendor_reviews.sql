-- Landing review seed (v2): named clients, natural review copy, no demo prefix.
-- Replaces v1 rows (body LIKE 'Eventtz demo review:%' or notes = 'seed:landing-review-v2').
--
-- Preferred: run `PYTHONPATH=. poetry run python scripts/seed_vendor_reviews.py` from backend/
-- (creates seed client auth users Amara, Chioma, Jordan automatically).
--
-- This SQL file performs the same cleanup + insert when seed clients already exist in public.users.

-- ---------------------------------------------------------------------------
-- Cleanup prior landing seeds
-- ---------------------------------------------------------------------------
DELETE FROM public.booking_reviews
WHERE body LIKE 'Eventtz demo review:%';

DELETE FROM public.booking_reviews
WHERE booking_request_id IN (
  SELECT id FROM public.booking_requests WHERE notes = 'seed:landing-review-v2'
);

DELETE FROM public.booking_requests
WHERE notes IN (
  'Demo seed booking for landing page reviews.',
  'seed:landing-review-v2'
);

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  client_amara uuid;
  client_chioma uuid;
  client_jordan uuid;
  vendor_rec record;
  booking_id uuid;
  client_ids uuid[] := ARRAY[]::uuid[];
  event_titles text[] := ARRAY[
    'Traditional wedding reception',
    'Birthday celebration',
    'Naming ceremony'
  ];
  vendor_idx int := 0;
  row_idx int;
  review_rating int;
  review_body text;
  review_client uuid;
  review_sets jsonb[][] := ARRAY[
    ARRAY[
      '{"rating":5,"body":"The food was incredible and our guests kept going back for more. Booking through Eventtz was straightforward and the vendor was responsive from the first message."}'::jsonb,
      '{"rating":5,"body":"We used Eventtz for our daughter''s birthday and everything ran on time. Clear quote, easy payment, and the team delivered exactly what we discussed."}'::jsonb,
      '{"rating":4,"body":"Really happy with the catering overall. One small timing tweak on the day, but the vendor sorted it quickly and the celebration still felt seamless."}'::jsonb
    ],
    ARRAY[
      '{"rating":5,"body":"Beautiful setup and everything we ordered arrived as described. Eventtz made it easy to compare options and confirm the booking in one place."}'::jsonb,
      '{"rating":5,"body":"Professional service from enquiry to collection. The quote was clear and paying in the app gave us confidence the booking was locked in."}'::jsonb,
      '{"rating":4,"body":"Great quality rentals and friendly communication. Would happily book again for our next family event."}'::jsonb
    ]
  ];
BEGIN
  SELECT id INTO client_amara FROM public.users WHERE email = 'amara@eventtz.co.uk' LIMIT 1;
  SELECT id INTO client_chioma FROM public.users WHERE email = 'chioma@eventtz.co.uk' LIMIT 1;
  SELECT id INTO client_jordan FROM public.users WHERE email = 'jordan@eventtz.co.uk' LIMIT 1;

  client_ids := ARRAY[client_amara, client_chioma, client_jordan];

  IF client_amara IS NULL OR client_chioma IS NULL OR client_jordan IS NULL THEN
    RAISE NOTICE '029_seed_vendor_reviews: seed clients missing. Run: PYTHONPATH=. poetry run python scripts/seed_vendor_reviews.py';
    RETURN;
  END IF;

  FOR vendor_rec IN
    SELECT
      v.user_id AS vendor_id,
      COALESCE(NULLIF(trim(v.payload->>'businessName'), ''), 'Event vendor') AS business_name
    FROM public.vendors v
    WHERE v.approval_status = 'approved'
    ORDER BY v.updated_at DESC
    LIMIT 2
  LOOP
    FOR row_idx IN 0..2 LOOP
      review_rating := (review_sets[vendor_idx + 1][row_idx + 1]->>'rating')::int;
      review_body := review_sets[vendor_idx + 1][row_idx + 1]->>'body';
      review_client := client_ids[row_idx + 1];

      INSERT INTO public.booking_requests (
        client_user_id,
        vendor_user_id,
        event_name,
        event_date,
        event_postcode,
        event_address,
        notes,
        status,
        payment_status,
        selected_option_ids,
        line_items,
        vendor_adjustments,
        total_label,
        paid_at,
        client_completion_confirmed_at,
        vendor_completion_confirmed_at
      )
      VALUES (
        review_client,
        vendor_rec.vendor_id,
        event_titles[row_idx + 1],
        (CURRENT_DATE - ((row_idx + 1) * 45)),
        'SW1A 1AA',
        'London, UK',
        'seed:landing-review-v2',
        'completed',
        'payout_released',
        ARRAY[]::text[],
        '[]'::jsonb,
        '[]'::jsonb,
        '£850',
        now() - ((row_idx + 1) * interval '45 days'),
        now() - ((row_idx + 1) * interval '44 days'),
        now() - ((row_idx + 1) * interval '44 days')
      )
      RETURNING id INTO booking_id;

      INSERT INTO public.booking_reviews (
        booking_request_id,
        vendor_user_id,
        client_user_id,
        rating,
        body,
        created_at
      )
      VALUES (
        booking_id,
        vendor_rec.vendor_id,
        review_client,
        review_rating,
        review_body,
        now() - ((row_idx + 1) * interval '43 days')
      );

      RAISE NOTICE '029_seed_vendor_reviews: added review %/3 for % (client %).',
        row_idx + 1, vendor_rec.business_name, row_idx + 1;
    END LOOP;

    vendor_idx := vendor_idx + 1;
  END LOOP;
END $$;
