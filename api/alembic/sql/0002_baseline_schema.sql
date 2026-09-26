--
-- PostgreSQL database dump
--

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

--
-- Name: user_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_type AS ENUM (
    'client',
    'vendor',
    'admin'
);

--
-- Name: enforce_booking_daily_capacity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_booking_daily_capacity() RETURNS trigger
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

--
-- Name: FUNCTION enforce_booking_daily_capacity(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.enforce_booking_daily_capacity() IS 'Serializes booking creates/updates per vendor/day and rejects when maxBookingsPerDay is reached.';

--
-- Name: eventtz_parse_max_bookings_per_day(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eventtz_parse_max_bookings_per_day(payload jsonb) RETURNS integer
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

--
-- Name: eventtz_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eventtz_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text,
    user_type public.user_type DEFAULT 'client'::public.user_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_suspended boolean DEFAULT false NOT NULL,
    contact_phone text,
    share_email boolean DEFAULT true NOT NULL,
    share_phone boolean DEFAULT true NOT NULL,
    share_address boolean DEFAULT true NOT NULL,
    admin_role text,
    preferred_name text,
    client_onboarding_completed_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT users_admin_role_check CHECK (((admin_role IS NULL) OR (admin_role = ANY (ARRAY['super_admin'::text, 'admin'::text])))),
    CONSTRAINT users_email_lowercase_chk CHECK (((email IS NULL) OR (email = lower(email))))
);

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'One account; user_type drives client vs vendor vs admin UI.';

--
-- Name: COLUMN users.account_suspended; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.account_suspended IS 'When true, user should be blocked from app actions (enforce in API as you roll out).';

--
-- Name: COLUMN users.contact_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.contact_phone IS 'Optional phone the user may share with booking counterparties when share_phone is true.';

--
-- Name: COLUMN users.share_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.share_email IS 'When true, email is visible to the counterparty on accepted bookings.';

--
-- Name: COLUMN users.share_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.share_phone IS 'When true, contact_phone is visible to the counterparty on accepted bookings.';

--
-- Name: COLUMN users.share_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.share_address IS 'Legacy client pref; booking venue is always visible to vendors. Not used for contact masking.';

--
-- Name: COLUMN users.admin_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.admin_role IS 'When user_type = admin: super_admin can manage the team; admin is a standard operator.';

--
-- Name: COLUMN users.preferred_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.preferred_name IS 'What the client wants to be called; shown to vendors on booking requests. Never an email.';

--
-- Name: COLUMN users.client_onboarding_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.client_onboarding_completed_at IS 'When the client finished (or skipped) the first-visit portal onboarding modal.';

--
-- Name: COLUMN users.email_verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email_verified_at IS 'When the user confirmed their email via Eventtz verify link. NULL = must verify before sign-in (client/vendor).';

--
-- Name: COLUMN users.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deleted_at IS 'When set, the account is closed: login is gone, PII is stripped, row kept for booking FKs.';

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    stripe_account_id text,
    stripe_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_payouts_enabled boolean DEFAULT false NOT NULL,
    business_name_normalized text GENERATED ALWAYS AS (NULLIF(lower(regexp_replace(TRIM(BOTH FROM COALESCE((payload ->> 'businessName'::text), ''::text)), '\s+'::text, ' '::text, 'g'::text)), ''::text)) STORED,
    min_list_price_gbp numeric,
    base_city_normalized text,
    services_offered text[],
    country_code character(2) DEFAULT 'GB'::bpchar NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    listing_override text DEFAULT 'auto'::text NOT NULL,
    listing_override_reason text,
    listing_override_by uuid,
    listing_override_at timestamp with time zone,
    approved_at timestamp with time zone,
    payouts_setup_nudge_at timestamp with time zone,
    client_referral_code text,
    client_referral_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT vendors_approval_status_chk CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'banned'::text]))),
    CONSTRAINT vendors_client_referral_code_format_chk CHECK (((client_referral_code IS NULL) OR (client_referral_code ~ '^[0-9]{1,6}$'::text))),
    CONSTRAINT vendors_current_step_check CHECK (((current_step >= 1) AND (current_step <= 20))),
    CONSTRAINT vendors_listing_override_check CHECK ((listing_override = ANY (ARRAY['auto'::text, 'visible'::text, 'hidden'::text]))),
    CONSTRAINT vendors_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'complete'::text])))
);

--
-- Name: TABLE vendors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendors IS 'Vendor profile row per vendor user; payload JSONB (draft/submitted).';

--
-- Name: COLUMN vendors.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.payload IS 'JSON snapshot of vendor profile (strings, numbers, booleans, string arrays). File blobs: Storage later.';

--
-- Name: COLUMN vendors.approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.approval_status IS 'pending = awaiting admin; approved = visible in client explore; banned = hidden.';

--
-- Name: COLUMN vendors.stripe_account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.stripe_account_id IS 'Stripe Connect Express account id (acct_...).';

--
-- Name: COLUMN vendors.stripe_charges_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.stripe_charges_enabled IS 'Mirrors Stripe Account.charges_enabled.';

--
-- Name: COLUMN vendors.stripe_payouts_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.stripe_payouts_enabled IS 'Mirrors Stripe Account.payouts_enabled.';

--
-- Name: COLUMN vendors.business_name_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.business_name_normalized IS 'Generated from payload.businessName for uniqueness checks (lowercase, trimmed, collapsed spaces).';

--
-- Name: COLUMN vendors.min_list_price_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.min_list_price_gbp IS 'Denormalized from payload for SQL budget filters on explore search.';

--
-- Name: COLUMN vendors.base_city_normalized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.base_city_normalized IS 'Lowercase trimmed baseCity from vendor payload.';

--
-- Name: COLUMN vendors.services_offered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.services_offered IS 'Denormalized servicesOffered keys from vendor payload.';

--
-- Name: COLUMN vendors.country_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.country_code IS 'ISO 3166-1 alpha-2 operating country (denormalized from payload.countryCode).';

--
-- Name: COLUMN vendors.currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.currency IS 'ISO 4217 listing currency for explore budget filters (denormalized from market).';

--
-- Name: COLUMN vendors.listing_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.listing_override IS 'auto = approval + Stripe decide visibility; visible = admin waives the Stripe gate; hidden = admin takes the listing down without banning.';

--
-- Name: COLUMN vendors.approved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.approved_at IS 'When approval_status last became approved (for the 24h payouts-setup nudge).';

--
-- Name: COLUMN vendors.payouts_setup_nudge_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.payouts_setup_nudge_at IS 'When the automatic payouts-setup email was sent.';

--
-- Name: COLUMN vendors.client_referral_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.client_referral_code IS 'Shareable numeric code for clients (?vref= on browse, or booking form). 1–6 digits.';

--
-- Name: COLUMN vendors.client_referral_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vendors.client_referral_enabled IS 'When false, client_referral_code is ignored for new bookings.';

--
-- Name: admin_vendor_list; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_vendor_list AS
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

--
-- Name: VIEW admin_vendor_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.admin_vendor_list IS 'Rows for admin vendor list: union of vendor-role users and vendors profile rows, with coalesced defaults.';

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    subtitle text,
    cover_image_url text,
    body_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    excerpt text,
    status text DEFAULT 'draft'::text NOT NULL,
    author_admin_user_id uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_name text,
    CONSTRAINT blog_posts_slug_nonempty CHECK ((length(TRIM(BOTH FROM slug)) > 0)),
    CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);

--
-- Name: TABLE blog_posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.blog_posts IS 'Public marketing blog; admins draft/publish. body_json = TipTap doc; body_html = sanitized HTML for readers.';

--
-- Name: COLUMN blog_posts.author_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.blog_posts.author_name IS 'Display name shown as "By …" on public blog pages; independent of author_admin_user_id.';

--
-- Name: booking_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    kind text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    body text,
    CONSTRAINT booking_notifications_kind_check CHECK ((kind = ANY (ARRAY['booking_accepted'::text, 'booking_completed'::text, 'booking_declined_by_vendor'::text, 'booking_request_received'::text, 'booking_request_sent'::text, 'booking_cancelled_by_client'::text, 'booking_cancelled_by_vendor'::text, 'booking_pricing_updated'::text, 'client_confirmed_updated_price'::text, 'client_declined_updated_price'::text, 'vendor_quote_received'::text, 'vendor_quote_accepted'::text, 'vendor_quote_declined'::text, 'vendor_quote_withdrawn'::text, 'payment_received'::text, 'vendor_payment_received'::text, 'vendor_payout_released'::text, 'payment_refunded'::text, 'completion_confirmed_awaiting_other_party'::text, 'completion_reminder'::text, 'vendor_completion_reminder'::text, 'enquiry_reminder_1h'::text, 'enquiry_reminder_6h'::text, 'enquiry_reminder_24h'::text, 'client_vendor_no_response'::text, 'event_tomorrow'::text, 'vendor_event_tomorrow'::text, 'pay_to_confirm'::text, 'payout_held_connect_incomplete'::text])))
);

--
-- Name: TABLE booking_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_notifications IS 'In-app alerts for clients when a vendor accepts or completes a booking.';

--
-- Name: COLUMN booking_notifications.body; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_notifications.body IS 'Human-readable summary (e.g. updated total and vendor additions) for the client.';

--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid NOT NULL,
    vendor_user_id uuid NOT NULL,
    event_name text NOT NULL,
    event_date date NOT NULL,
    event_end_date date,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    selected_option_ids text[] DEFAULT '{}'::text[] NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    vendor_adjustments jsonb DEFAULT '[]'::jsonb NOT NULL,
    stripe_payment_intent_id text,
    stripe_charge_id text,
    payment_amount_gbp numeric(12,2),
    initiator text DEFAULT 'client'::text NOT NULL,
    conversation_id uuid,
    event_postcode text,
    event_address text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    stripe_checkout_session_id text,
    vendor_amount_gbp numeric(12,2),
    platform_fee_gbp numeric(12,2),
    stripe_transfer_id text,
    payout_released_at timestamp with time zone,
    client_completion_confirmed_at timestamp with time zone,
    vendor_completion_confirmed_at timestamp with time zone,
    initial_client_total_label text,
    cancelled_by text,
    cancelled_at timestamp with time zone,
    payout_auto_released_at timestamp with time zone,
    completion_reminder_sent_at timestamp with time zone,
    support_hold boolean DEFAULT false NOT NULL,
    currency character(3) DEFAULT 'GBP'::bpchar NOT NULL,
    accepted_at timestamp with time zone,
    declined_at timestamp with time zone,
    vendor_first_response_at timestamp with time zone,
    vendor_response_time_seconds integer,
    payment_requested_at timestamp with time zone,
    completed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    vendor_notified_at timestamp with time zone,
    failure_reason text,
    failure_noted_at timestamp with time zone,
    enquiry_reminder_1h_at timestamp with time zone,
    enquiry_reminder_6h_at timestamp with time zone,
    enquiry_reminder_24h_at timestamp with time zone,
    client_no_response_nudge_at timestamp with time zone,
    client_search_context jsonb,
    event_id uuid,
    stripe_receipt_url text,
    payment_receipt_snapshot jsonb,
    vendor_payment_record_snapshot jsonb,
    vendor_payout_statement_snapshot jsonb,
    event_tomorrow_reminded_at timestamp with time zone,
    pay_to_confirm_reminded_at timestamp with time zone,
    vendor_referral_code text,
    service_fee_percent numeric(5,2) DEFAULT 5.00 NOT NULL,
    referral_fee_discount_gbp numeric(12,2),
    CONSTRAINT booking_requests_cancelled_by_check CHECK (((cancelled_by IS NULL) OR (cancelled_by = ANY (ARRAY['client'::text, 'vendor'::text])))),
    CONSTRAINT booking_requests_failure_reason_check CHECK (((failure_reason IS NULL) OR (failure_reason = ANY (ARRAY['NO_VENDOR_AVAILABLE'::text, 'VENDOR_UNAVAILABLE'::text, 'VENDOR_NO_RESPONSE'::text, 'PRICE_TOO_HIGH'::text, 'CUSTOMER_CANCELLED'::text, 'PAYMENT_FAILED'::text, 'OTHER'::text])))),
    CONSTRAINT booking_requests_initiator_check CHECK ((initiator = ANY (ARRAY['client'::text, 'vendor'::text]))),
    CONSTRAINT booking_requests_no_self_booking CHECK ((client_user_id <> vendor_user_id)),
    CONSTRAINT booking_requests_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'paid'::text, 'refunded'::text, 'partially_refunded'::text, 'payout_released'::text]))),
    CONSTRAINT booking_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text, 'completed'::text]))),
    CONSTRAINT booking_requests_vendor_response_time_seconds_check CHECK (((vendor_response_time_seconds IS NULL) OR (vendor_response_time_seconds >= 0)))
);

--
-- Name: TABLE booking_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_requests IS 'Client-initiated booking enquiry; line_items/selected_option_ids snapshot vendor payload ids.';

--
-- Name: COLUMN booking_requests.paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.paid_at IS 'Set automatically when payment succeeds (e.g. Stripe). Not used for manual confirmation.';

--
-- Name: COLUMN booking_requests.vendor_adjustments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_adjustments IS 'Array of {id, tag, label, amount_gbp} - additions (positive) or discounts (negative) before accept; client total includes Eventtz service fee on top.';

--
-- Name: COLUMN booking_requests.stripe_payment_intent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.stripe_payment_intent_id IS 'Stripe PaymentIntent id when checkout is integrated.';

--
-- Name: COLUMN booking_requests.payment_amount_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payment_amount_gbp IS 'Captured payment amount in GBP when known.';

--
-- Name: COLUMN booking_requests.initiator; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.initiator IS 'client = enquiry from explore; vendor = custom quote sent to client (client accepts pending).';

--
-- Name: COLUMN booking_requests.conversation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.conversation_id IS 'Optional chat thread the quote was sent from.';

--
-- Name: COLUMN booking_requests.event_postcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.event_postcode IS 'Venue/event location postcode supplied by the client when requesting a booking.';

--
-- Name: COLUMN booking_requests.event_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.event_address IS 'Optional formatted venue address line(s); event_postcode is still required for client requests.';

--
-- Name: COLUMN booking_requests.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payment_status IS 'Money lifecycle, independent of status: unpaid -> pending -> paid -> payout_released, or refunded/partially_refunded via disputes.';

--
-- Name: COLUMN booking_requests.vendor_amount_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_amount_gbp IS 'Vendor portion snapshot at payment time (does not move if pricing edits happen later).';

--
-- Name: COLUMN booking_requests.platform_fee_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.platform_fee_gbp IS 'Eventtz service fee snapshot at payment time.';

--
-- Name: COLUMN booking_requests.stripe_transfer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.stripe_transfer_id IS 'Stripe Transfer id once the vendor payout has been released.';

--
-- Name: COLUMN booking_requests.client_completion_confirmed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.client_completion_confirmed_at IS 'Client confirmed the event/booking is complete.';

--
-- Name: COLUMN booking_requests.vendor_completion_confirmed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_completion_confirmed_at IS 'Vendor confirmed the event/booking is complete. Both set -> status=completed + payout released.';

--
-- Name: COLUMN booking_requests.initial_client_total_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.initial_client_total_label IS 'Client total incl. service fee at request creation; used when vendor sends an updated price.';

--
-- Name: COLUMN booking_requests.cancelled_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.cancelled_by IS 'Who cancelled the booking (client or vendor). Null unless status = cancelled.';

--
-- Name: COLUMN booking_requests.cancelled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.cancelled_at IS 'When the booking was cancelled.';

--
-- Name: COLUMN booking_requests.payout_auto_released_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payout_auto_released_at IS 'Set when the vendor payout was released automatically 48h after the event (no mutual confirmation).';

--
-- Name: COLUMN booking_requests.completion_reminder_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.completion_reminder_sent_at IS 'Set once the post-event confirm-completion reminder batch has been sent for this booking (dedupe).';

--
-- Name: COLUMN booking_requests.support_hold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.support_hold IS 'When true, blocks automatic payout release until cleared by support.';

--
-- Name: COLUMN booking_requests.currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.currency IS 'ISO 4217 currency for this booking (defaults to GBP for UK launch).';

--
-- Name: COLUMN booking_requests.accepted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.accepted_at IS 'When the vendor accepted (enquiry → bookable). Set once.';

--
-- Name: COLUMN booking_requests.vendor_first_response_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_first_response_at IS 'First meaningful vendor response (message, accept, or decline). Set once.';

--
-- Name: COLUMN booking_requests.failure_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.failure_reason IS 'Analytics outcome for unfulfilled demand; does not replace status.';

--
-- Name: COLUMN booking_requests.enquiry_reminder_1h_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.enquiry_reminder_1h_at IS 'When the 1h vendor reply reminder was sent (pending client-initiated enquiries).';

--
-- Name: COLUMN booking_requests.enquiry_reminder_6h_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.enquiry_reminder_6h_at IS 'When the 6h vendor reply reminder was sent.';

--
-- Name: COLUMN booking_requests.enquiry_reminder_24h_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.enquiry_reminder_24h_at IS 'When the 24h vendor reply reminder was sent.';

--
-- Name: COLUMN booking_requests.client_no_response_nudge_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.client_no_response_nudge_at IS 'When the client received the 24h “try other vendors” email/notification.';

--
-- Name: COLUMN booking_requests.client_search_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.client_search_context IS 'Marketplace search filters at enquire time (types, location, dates, q, country) for alternative suggestions.';

--
-- Name: COLUMN booking_requests.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.event_id IS 'Optional link to client_events for multi-vendor planning under one celebration.';

--
-- Name: COLUMN booking_requests.stripe_receipt_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.stripe_receipt_url IS 'Stripe Charge.receipt_url snapshot at payment time (client card receipt).';

--
-- Name: COLUMN booking_requests.payment_receipt_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.payment_receipt_snapshot IS 'Frozen client payment receipt JSON at checkout; write-once.';

--
-- Name: COLUMN booking_requests.vendor_payment_record_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_payment_record_snapshot IS 'Frozen vendor payment record JSON when client pays; write-once.';

--
-- Name: COLUMN booking_requests.vendor_payout_statement_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_payout_statement_snapshot IS 'Frozen vendor payout statement JSON when transfer succeeds; write-once.';

--
-- Name: COLUMN booking_requests.event_tomorrow_reminded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.event_tomorrow_reminded_at IS 'When the day-before event reminder was sent to client and vendor.';

--
-- Name: COLUMN booking_requests.pay_to_confirm_reminded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.pay_to_confirm_reminded_at IS 'When the client was reminded to pay after the vendor accepted.';

--
-- Name: COLUMN booking_requests.vendor_referral_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.vendor_referral_code IS 'Vendor client referral code applied at enquiry (nullable).';

--
-- Name: COLUMN booking_requests.service_fee_percent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.service_fee_percent IS 'Snapshotted platform service fee % for this booking (always 5; referral uses fixed GBP discount).';

--
-- Name: COLUMN booking_requests.referral_fee_discount_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.referral_fee_discount_gbp IS 'GBP discount applied to Eventtz service fee via vendor client referral tier (snapshot at payment).';

--
-- Name: booking_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_request_id uuid NOT NULL,
    vendor_user_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    rating integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_at timestamp with time zone,
    image_urls text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT booking_reviews_body_check CHECK (((char_length(body) >= 10) AND (char_length(body) <= 4000))),
    CONSTRAINT booking_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: TABLE booking_reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_reviews IS 'Client review after a completed booking; UNIQUE(booking_request_id) enforces one review per booking.';

--
-- Name: COLUMN booking_reviews.hidden_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_reviews.hidden_at IS 'When set, review is excluded from public lists (admin moderation).';

--
-- Name: COLUMN booking_reviews.image_urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_reviews.image_urls IS 'Public image URLs uploaded by the client with the review (max enforced in app).';

--
-- Name: celebration_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.celebration_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    need_id text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    service_key text NOT NULL,
    optional boolean DEFAULT false NOT NULL,
    primary_vendor_user_id uuid,
    alternative_vendor_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    estimated_cost_gbp numeric,
    why_selected text,
    score_breakdown jsonb,
    sort_order integer DEFAULT 0 NOT NULL
);

--
-- Name: TABLE celebration_plan_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.celebration_plan_items IS 'Per-need primary + alternative vendor recommendations for a celebration plan.';

--
-- Name: celebration_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.celebration_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid NOT NULL,
    title text,
    raw_prompt text NOT NULL,
    brief jsonb DEFAULT '{}'::jsonb NOT NULL,
    confidence_score integer,
    confidence_reasons jsonb,
    summary text,
    budget_total_gbp numeric,
    budget_remaining_gbp numeric,
    currency text DEFAULT 'GBP'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_event_id uuid,
    CONSTRAINT celebration_plans_status_chk CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);

--
-- Name: TABLE celebration_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.celebration_plans IS 'AI Event Planner celebration plans for clients (prompt → brief → recommendations).';

--
-- Name: COLUMN celebration_plans.client_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.celebration_plans.client_event_id IS 'Client celebration event created when the client starts booking from this plan.';

--
-- Name: client_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid NOT NULL,
    title text NOT NULL,
    event_date date NOT NULL,
    event_end_date date,
    event_address text,
    event_postcode text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_events_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);

--
-- Name: TABLE client_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_events IS 'Client-owned celebration/event; multiple booking_requests can link to one event.';

--
-- Name: client_saved_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_saved_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid NOT NULL,
    vendor_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE client_saved_vendors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_saved_vendors IS 'Client bookmarked vendors for favorites / saved list.';

--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    portal text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_submissions_portal_check CHECK ((portal = ANY (ARRAY['client'::text, 'vendor'::text, 'admin'::text])))
);

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_user_id uuid,
    vendor_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone,
    client_last_read_at timestamp with time zone,
    vendor_last_read_at timestamp with time zone,
    kind text DEFAULT 'dm'::text NOT NULL,
    support_user_id uuid,
    admin_last_read_at timestamp with time zone,
    CONSTRAINT conversations_kind_check CHECK ((kind = ANY (ARRAY['dm'::text, 'support'::text]))),
    CONSTRAINT conversations_shape_check CHECK ((((kind = 'dm'::text) AND (client_user_id IS NOT NULL) AND (vendor_user_id IS NOT NULL) AND (support_user_id IS NULL) AND (client_user_id <> vendor_user_id)) OR ((kind = 'support'::text) AND (support_user_id IS NOT NULL) AND (client_user_id IS NULL) AND (vendor_user_id IS NULL))))
);

--
-- Name: TABLE conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversations IS 'DM thread between a client and a vendor; last_read_* drive unread badges.';

--
-- Name: COLUMN conversations.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.kind IS 'dm = client-vendor pair; support = Eventtz Support ↔ one end user.';

--
-- Name: COLUMN conversations.support_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.support_user_id IS 'End user (client or vendor) on a support thread; null for DMs.';

--
-- Name: COLUMN conversations.admin_last_read_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.admin_last_read_at IS 'Staff read cursor for support threads.';

--
-- Name: dispute_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispute_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_request_id uuid NOT NULL,
    opened_by_user_id uuid NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    summary text NOT NULL,
    internal_notes text,
    resolution_note text,
    assigned_admin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    conversation_id uuid,
    resolution_action text,
    refund_amount_gbp numeric(12,2),
    client_resolution_note text,
    vendor_resolution_note text,
    CONSTRAINT dispute_cases_resolution_action_check CHECK (((resolution_action IS NULL) OR (resolution_action = ANY (ARRAY['release_to_vendor'::text, 'refund_client'::text, 'partial_refund'::text])))),
    CONSTRAINT dispute_cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT dispute_cases_summary_check CHECK (((char_length(summary) >= 1) AND (char_length(summary) <= 4000)))
);

--
-- Name: TABLE dispute_cases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dispute_cases IS 'Admin-managed disputes linked to a booking request.';

--
-- Name: COLUMN dispute_cases.resolution_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.resolution_note IS 'Legacy shared note; prefer client_resolution_note / vendor_resolution_note. Still used as fallback when party-specific notes are empty.';

--
-- Name: COLUMN dispute_cases.conversation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.conversation_id IS 'In-app chat between the same client and vendor, stored when the dispute is opened for investigation.';

--
-- Name: COLUMN dispute_cases.resolution_action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.resolution_action IS 'Money decision recorded when an admin resolves the dispute.';

--
-- Name: COLUMN dispute_cases.refund_amount_gbp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.refund_amount_gbp IS 'Set when resolution_action = partial_refund.';

--
-- Name: COLUMN dispute_cases.client_resolution_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.client_resolution_note IS 'Admin message shown only to the client on this dispute.';

--
-- Name: COLUMN dispute_cases.vendor_resolution_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispute_cases.vendor_resolution_note IS 'Admin message shown only to the vendor on this dispute.';

--
-- Name: email_delivery_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_delivery_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id text NOT NULL,
    recipient_email text NOT NULL,
    recipient_user_id uuid,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE email_delivery_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_delivery_log IS 'Records sent transactional emails; unique index prevents duplicate booking lifecycle sends.';

--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE email_verification_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_verification_tokens IS 'One-click email verification: store SHA-256 of raw token only; 60m expiry; single use.';

--
-- Name: help_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    body_md text DEFAULT ''::text NOT NULL,
    audience text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    related_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT help_articles_audience_check CHECK ((audience = ANY (ARRAY['client'::text, 'vendor'::text, 'both'::text, 'admin'::text])))
);

--
-- Name: TABLE help_articles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.help_articles IS 'Help Center articles (markdown body). Source for browse + AI assistant retrieval.';

--
-- Name: help_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    icon_key text DEFAULT 'book'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    audience text NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT help_categories_audience_check CHECK ((audience = ANY (ARRAY['client'::text, 'vendor'::text, 'both'::text, 'admin'::text])))
);

--
-- Name: TABLE help_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.help_categories IS 'Help Center categories filtered by portal audience (client/vendor/both).';

--
-- Name: job_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_runs (
    job_name text NOT NULL,
    period_key text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE job_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.job_runs IS 'One row per job + period (e.g. UTC hour). Insert wins the run; unique conflict means skip.';

--
-- Name: marketplace_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    actor_user_id uuid,
    vendor_user_id uuid,
    booking_request_id uuid,
    category text,
    location text,
    booking_value_gbp numeric(12,2),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketplace_events_event_name_check CHECK ((event_name = ANY (ARRAY['vendor_profile_viewed'::text, 'enquiry_created'::text, 'vendor_notified'::text, 'vendor_message_sent'::text, 'vendor_accepted_booking'::text, 'vendor_declined_booking'::text, 'customer_started_payment'::text, 'customer_payment_completed'::text, 'booking_completed'::text, 'booking_cancelled'::text, 'review_submitted'::text, 'enquiry_unfulfilled'::text, 'enquiry_vendor_reminded'::text, 'enquiry_client_no_response_nudge'::text, 'enquiry_multi_created'::text])))
);

--
-- Name: TABLE marketplace_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketplace_events IS 'Lightweight marketplace funnel events for analytics (not a third-party SDK).';

--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb,
    CONSTRAINT messages_body_len CHECK (((char_length(body) >= 1) AND (char_length(body) <= 15000)))
);

--
-- Name: TABLE messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.messages IS 'Chat messages; sender must be client or vendor on the conversation.';

--
-- Name: COLUMN messages.body; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.body IS 'Message body: plain text for user DMs; sanitized HTML for admin support messages (metadata.format = html).';

--
-- Name: COLUMN messages.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.metadata IS 'Optional structured payload for non-plain-text messages, e.g. {"kind":"quote","booking_request_id":"...","event_name":"...","total_label":"...","status":"pending"}.';

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE password_reset_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.password_reset_tokens IS 'One-click password reset: store SHA-256 of raw token only; 60m expiry; single use.';

--
-- Name: referral_attributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_attributions (
    user_id uuid NOT NULL,
    referral_partner_id uuid NOT NULL,
    referral_slug text NOT NULL,
    attributed_at timestamp with time zone DEFAULT now() NOT NULL,
    shoutout_completed boolean DEFAULT false NOT NULL,
    shoutout_completed_at timestamp with time zone
);

--
-- Name: TABLE referral_attributions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.referral_attributions IS 'Vendor signups attributed to a referral partner link (first-touch at registration).';

--
-- Name: referral_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    instagram_handle text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_admin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_partners_slug_format_chk CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);

--
-- Name: TABLE referral_partners; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.referral_partners IS 'Instagram creators / partners with trackable vendor signup links (?ref=slug).';

--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    id text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE stripe_webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_webhook_events IS 'Processed Stripe event ids, for webhook dedupe.';

--
-- Name: vendor_review_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vendor_review_stats AS
 SELECT vendor_user_id,
    count(*) AS review_count,
    (round(avg(rating), 2))::double precision AS average_rating
   FROM public.booking_reviews
  WHERE (hidden_at IS NULL)
  GROUP BY vendor_user_id;

--
-- Name: VIEW vendor_review_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.vendor_review_stats IS 'Average rating and count per vendor (visible reviews only).';

--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);

--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);

--
-- Name: booking_notifications booking_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_pkey PRIMARY KEY (id);

--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);

--
-- Name: booking_reviews booking_reviews_booking_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reviews
    ADD CONSTRAINT booking_reviews_booking_request_id_key UNIQUE (booking_request_id);

--
-- Name: booking_reviews booking_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reviews
    ADD CONSTRAINT booking_reviews_pkey PRIMARY KEY (id);

--
-- Name: celebration_plan_items celebration_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plan_items
    ADD CONSTRAINT celebration_plan_items_pkey PRIMARY KEY (id);

--
-- Name: celebration_plan_items celebration_plan_items_plan_need_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plan_items
    ADD CONSTRAINT celebration_plan_items_plan_need_unique UNIQUE (plan_id, need_id);

--
-- Name: celebration_plans celebration_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plans
    ADD CONSTRAINT celebration_plans_pkey PRIMARY KEY (id);

--
-- Name: client_events client_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_events
    ADD CONSTRAINT client_events_pkey PRIMARY KEY (id);

--
-- Name: client_saved_vendors client_saved_vendors_client_user_id_vendor_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_saved_vendors
    ADD CONSTRAINT client_saved_vendors_client_user_id_vendor_user_id_key UNIQUE (client_user_id, vendor_user_id);

--
-- Name: client_saved_vendors client_saved_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_saved_vendors
    ADD CONSTRAINT client_saved_vendors_pkey PRIMARY KEY (id);

--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);

--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

--
-- Name: dispute_cases dispute_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_cases
    ADD CONSTRAINT dispute_cases_pkey PRIMARY KEY (id);

--
-- Name: email_delivery_log email_delivery_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_pkey PRIMARY KEY (id);

--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);

--
-- Name: email_verification_tokens email_verification_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_unique UNIQUE (token_hash);

--
-- Name: help_articles help_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);

--
-- Name: help_articles help_articles_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_slug_unique UNIQUE (slug);

--
-- Name: help_categories help_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_categories
    ADD CONSTRAINT help_categories_pkey PRIMARY KEY (id);

--
-- Name: help_categories help_categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_categories
    ADD CONSTRAINT help_categories_slug_unique UNIQUE (slug);

--
-- Name: job_runs job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_runs
    ADD CONSTRAINT job_runs_pkey PRIMARY KEY (job_name, period_key);

--
-- Name: marketplace_events marketplace_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);

--
-- Name: password_reset_tokens password_reset_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash);

--
-- Name: referral_attributions referral_attributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_attributions
    ADD CONSTRAINT referral_attributions_pkey PRIMARY KEY (user_id);

--
-- Name: referral_partners referral_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_pkey PRIMARY KEY (id);

--
-- Name: referral_partners referral_partners_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_slug_unique UNIQUE (slug);

--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);

--
-- Name: booking_notifications uq_booking_notifications_booking_kind; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT uq_booking_notifications_booking_kind UNIQUE (booking_id, kind);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);

--
-- Name: vendors vendors_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_key UNIQUE (user_id);

--
-- Name: blog_posts_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX blog_posts_slug_unique ON public.blog_posts USING btree (slug);

--
-- Name: celebration_plan_items_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX celebration_plan_items_plan_idx ON public.celebration_plan_items USING btree (plan_id);

--
-- Name: celebration_plans_client_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX celebration_plans_client_updated_idx ON public.celebration_plans USING btree (client_user_id, updated_at DESC);

--
-- Name: client_saved_vendors_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_saved_vendors_client_idx ON public.client_saved_vendors USING btree (client_user_id, created_at DESC);

--
-- Name: conversations_unique_dm_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_unique_dm_pair ON public.conversations USING btree (client_user_id, vendor_user_id) WHERE (kind = 'dm'::text);

--
-- Name: conversations_unique_support_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_unique_support_user ON public.conversations USING btree (support_user_id) WHERE (kind = 'support'::text);

--
-- Name: email_delivery_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_delivery_log_created_at_idx ON public.email_delivery_log USING btree (created_at DESC);

--
-- Name: email_delivery_log_dedupe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_delivery_log_dedupe_idx ON public.email_delivery_log USING btree (template_id, booking_id, recipient_user_id) WHERE ((booking_id IS NOT NULL) AND (recipient_user_id IS NOT NULL));

--
-- Name: idx_admin_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_created ON public.admin_audit_log USING btree (created_at DESC);

--
-- Name: idx_blog_posts_published_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_published_feed ON public.blog_posts USING btree (status, published_at DESC NULLS LAST) WHERE (status = 'published'::text);

--
-- Name: idx_blog_posts_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_updated ON public.blog_posts USING btree (updated_at DESC);

--
-- Name: idx_booking_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_notifications_user_created ON public.booking_notifications USING btree (user_id, created_at DESC);

--
-- Name: idx_booking_requests_accepted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_accepted_at ON public.booking_requests USING btree (accepted_at DESC NULLS LAST);

--
-- Name: idx_booking_requests_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_client ON public.booking_requests USING btree (client_user_id);

--
-- Name: idx_booking_requests_client_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_client_event ON public.booking_requests USING btree (client_user_id, event_id) WHERE (event_id IS NOT NULL);

--
-- Name: idx_booking_requests_completion_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_completion_pending ON public.booking_requests USING btree (event_date) WHERE ((status = 'accepted'::text) AND (payment_status = 'paid'::text));

--
-- Name: idx_booking_requests_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_conversation ON public.booking_requests USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);

--
-- Name: idx_booking_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_created_at ON public.booking_requests USING btree (created_at DESC);

--
-- Name: idx_booking_requests_enquiry_reminders_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_enquiry_reminders_pending ON public.booking_requests USING btree (created_at) WHERE ((status = 'pending'::text) AND (initiator = 'client'::text) AND (vendor_first_response_at IS NULL));

--
-- Name: idx_booking_requests_failure_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_failure_reason ON public.booking_requests USING btree (failure_reason) WHERE (failure_reason IS NOT NULL);

--
-- Name: idx_booking_requests_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_payment_status ON public.booking_requests USING btree (payment_status);

--
-- Name: idx_booking_requests_status_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_status_payment ON public.booking_requests USING btree (status, payment_status);

--
-- Name: idx_booking_requests_stripe_checkout_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_stripe_checkout_session_id ON public.booking_requests USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);

--
-- Name: idx_booking_requests_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_updated_at ON public.booking_requests USING btree (updated_at DESC);

--
-- Name: idx_booking_requests_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_vendor ON public.booking_requests USING btree (vendor_user_id);

--
-- Name: idx_booking_requests_vendor_active_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_vendor_active_dates ON public.booking_requests USING btree (vendor_user_id, event_date, event_end_date) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));

--
-- Name: idx_booking_requests_vendor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_vendor_created ON public.booking_requests USING btree (vendor_user_id, created_at DESC);

--
-- Name: idx_booking_requests_vendor_first_response_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_vendor_first_response_at ON public.booking_requests USING btree (vendor_first_response_at DESC NULLS LAST);

--
-- Name: idx_booking_requests_vendor_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_vendor_referral_code ON public.booking_requests USING btree (vendor_referral_code) WHERE (vendor_referral_code IS NOT NULL);

--
-- Name: idx_booking_reviews_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_reviews_client ON public.booking_reviews USING btree (client_user_id);

--
-- Name: idx_booking_reviews_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_reviews_vendor ON public.booking_reviews USING btree (vendor_user_id);

--
-- Name: idx_celebration_plans_client_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_celebration_plans_client_event ON public.celebration_plans USING btree (client_event_id) WHERE (client_event_id IS NOT NULL);

--
-- Name: idx_client_events_client_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_events_client_status_date ON public.client_events USING btree (client_user_id, status, event_date DESC);

--
-- Name: idx_contact_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions USING btree (created_at DESC);

--
-- Name: idx_contact_submissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_user_id ON public.contact_submissions USING btree (user_id);

--
-- Name: idx_conversations_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_client ON public.conversations USING btree (client_user_id);

--
-- Name: idx_conversations_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_kind ON public.conversations USING btree (kind);

--
-- Name: idx_conversations_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_last_message ON public.conversations USING btree (last_message_at DESC NULLS LAST);

--
-- Name: idx_conversations_support_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_support_user ON public.conversations USING btree (support_user_id) WHERE (kind = 'support'::text);

--
-- Name: idx_conversations_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_vendor ON public.conversations USING btree (vendor_user_id);

--
-- Name: idx_dispute_cases_assigned_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispute_cases_assigned_admin ON public.dispute_cases USING btree (assigned_admin_id);

--
-- Name: idx_dispute_cases_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispute_cases_booking ON public.dispute_cases USING btree (booking_request_id);

--
-- Name: idx_dispute_cases_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispute_cases_conversation ON public.dispute_cases USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);

--
-- Name: idx_dispute_cases_one_active_per_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_dispute_cases_one_active_per_booking ON public.dispute_cases USING btree (booking_request_id) WHERE (status = ANY (ARRAY['open'::text, 'under_review'::text]));

--
-- Name: INDEX idx_dispute_cases_one_active_per_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dispute_cases_one_active_per_booking IS 'Prevents two concurrent inserts from opening two active disputes for the same booking.';

--
-- Name: idx_dispute_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispute_cases_status ON public.dispute_cases USING btree (status);

--
-- Name: idx_email_verification_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_verification_tokens_expires ON public.email_verification_tokens USING btree (expires_at) WHERE (used_at IS NULL);

--
-- Name: idx_email_verification_tokens_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_verification_tokens_user_created ON public.email_verification_tokens USING btree (user_id, created_at DESC);

--
-- Name: idx_help_articles_audience_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_articles_audience_sort ON public.help_articles USING btree (audience, sort_order) WHERE (published = true);

--
-- Name: idx_help_articles_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_articles_category ON public.help_articles USING btree (category_id, sort_order);

--
-- Name: idx_help_categories_audience_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_categories_audience_sort ON public.help_categories USING btree (audience, sort_order) WHERE (published = true);

--
-- Name: idx_marketplace_events_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_events_booking ON public.marketplace_events USING btree (booking_request_id) WHERE (booking_request_id IS NOT NULL);

--
-- Name: idx_marketplace_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_events_created ON public.marketplace_events USING btree (created_at DESC);

--
-- Name: idx_marketplace_events_name_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_events_name_created ON public.marketplace_events USING btree (event_name, created_at DESC);

--
-- Name: idx_marketplace_events_vendor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketplace_events_vendor_created ON public.marketplace_events USING btree (vendor_user_id, created_at DESC) WHERE (vendor_user_id IS NOT NULL);

--
-- Name: idx_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);

--
-- Name: idx_password_reset_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at) WHERE (used_at IS NULL);

--
-- Name: idx_password_reset_tokens_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_created ON public.password_reset_tokens USING btree (user_id, created_at DESC);

--
-- Name: idx_referral_attributions_partner_attributed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_attributions_partner_attributed ON public.referral_attributions USING btree (referral_partner_id, attributed_at DESC);

--
-- Name: idx_referral_partners_active_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_partners_active_slug ON public.referral_partners USING btree (slug) WHERE (is_active = true);

--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);

--
-- Name: idx_users_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_user_type ON public.users USING btree (user_type);

--
-- Name: idx_vendors_business_name_normalized_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendors_business_name_normalized_unique ON public.vendors USING btree (business_name_normalized) WHERE (business_name_normalized IS NOT NULL);

--
-- Name: idx_vendors_client_referral_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vendors_client_referral_code_unique ON public.vendors USING btree (client_referral_code) WHERE (client_referral_code IS NOT NULL);

--
-- Name: idx_vendors_stripe_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_stripe_account_id ON public.vendors USING btree (stripe_account_id) WHERE (stripe_account_id IS NOT NULL);

--
-- Name: idx_vendors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_user_id ON public.vendors USING btree (user_id);

--
-- Name: vendors_approval_status_approved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_approval_status_approved_idx ON public.vendors USING btree (updated_at DESC) WHERE (approval_status = 'approved'::text);

--
-- Name: vendors_base_city_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_base_city_normalized_idx ON public.vendors USING btree (base_city_normalized) WHERE ((approval_status = 'approved'::text) AND (base_city_normalized IS NOT NULL));

--
-- Name: vendors_country_code_approved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_country_code_approved_idx ON public.vendors USING btree (country_code, updated_at DESC) WHERE (approval_status = 'approved'::text);

--
-- Name: vendors_country_code_base_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_country_code_base_city_idx ON public.vendors USING btree (country_code, base_city_normalized) WHERE ((approval_status = 'approved'::text) AND (base_city_normalized IS NOT NULL));

--
-- Name: vendors_min_list_price_gbp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_min_list_price_gbp_idx ON public.vendors USING btree (min_list_price_gbp) WHERE ((approval_status = 'approved'::text) AND (min_list_price_gbp IS NOT NULL));

--
-- Name: vendors_public_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_public_listing_idx ON public.vendors USING btree (country_code, updated_at DESC) WHERE ((approval_status = 'approved'::text) AND (listing_override <> 'hidden'::text) AND ((listing_override = 'visible'::text) OR ((stripe_account_id IS NOT NULL) AND stripe_charges_enabled AND stripe_payouts_enabled)));

--
-- Name: INDEX vendors_public_listing_idx; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.vendors_public_listing_idx IS 'Public marketplace listing gate: approved, not force-hidden, and either Stripe-verified or admin-waived.';

--
-- Name: vendors_services_offered_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_services_offered_gin_idx ON public.vendors USING gin (services_offered) WHERE ((approval_status = 'approved'::text) AND (services_offered IS NOT NULL));

--
-- Name: booking_requests trg_booking_requests_daily_capacity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_daily_capacity BEFORE INSERT OR UPDATE OF status, event_date, event_end_date, vendor_user_id ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_daily_capacity();

--
-- Name: booking_requests trg_booking_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: booking_reviews trg_booking_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_reviews_updated_at BEFORE UPDATE ON public.booking_reviews FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: client_events trg_client_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_client_events_updated_at BEFORE UPDATE ON public.client_events FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: dispute_cases trg_dispute_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispute_cases_updated_at BEFORE UPDATE ON public.dispute_cases FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: referral_partners trg_referral_partners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_referral_partners_updated_at BEFORE UPDATE ON public.referral_partners FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: vendors trg_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at();

--
-- Name: admin_audit_log admin_audit_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: blog_posts blog_posts_author_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_admin_user_id_fkey FOREIGN KEY (author_admin_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: booking_notifications booking_notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking_requests(id) ON DELETE CASCADE;

--
-- Name: booking_notifications booking_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: booking_requests booking_requests_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: booking_requests booking_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

--
-- Name: booking_requests booking_requests_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.client_events(id) ON DELETE SET NULL;

--
-- Name: booking_requests booking_requests_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_vendor_user_id_fkey FOREIGN KEY (vendor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: booking_reviews booking_reviews_booking_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reviews
    ADD CONSTRAINT booking_reviews_booking_request_id_fkey FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE CASCADE;

--
-- Name: booking_reviews booking_reviews_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reviews
    ADD CONSTRAINT booking_reviews_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: booking_reviews booking_reviews_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reviews
    ADD CONSTRAINT booking_reviews_vendor_user_id_fkey FOREIGN KEY (vendor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: celebration_plan_items celebration_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plan_items
    ADD CONSTRAINT celebration_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.celebration_plans(id) ON DELETE CASCADE;

--
-- Name: celebration_plan_items celebration_plan_items_primary_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plan_items
    ADD CONSTRAINT celebration_plan_items_primary_vendor_user_id_fkey FOREIGN KEY (primary_vendor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: celebration_plans celebration_plans_client_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plans
    ADD CONSTRAINT celebration_plans_client_event_id_fkey FOREIGN KEY (client_event_id) REFERENCES public.client_events(id) ON DELETE SET NULL;

--
-- Name: celebration_plans celebration_plans_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.celebration_plans
    ADD CONSTRAINT celebration_plans_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: client_events client_events_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_events
    ADD CONSTRAINT client_events_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: client_saved_vendors client_saved_vendors_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_saved_vendors
    ADD CONSTRAINT client_saved_vendors_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: client_saved_vendors client_saved_vendors_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_saved_vendors
    ADD CONSTRAINT client_saved_vendors_vendor_user_id_fkey FOREIGN KEY (vendor_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: contact_submissions contact_submissions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking_requests(id);

--
-- Name: contact_submissions contact_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: conversations conversations_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: conversations conversations_support_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_support_user_id_fkey FOREIGN KEY (support_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: conversations conversations_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_vendor_user_id_fkey FOREIGN KEY (vendor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: dispute_cases dispute_cases_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_cases
    ADD CONSTRAINT dispute_cases_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: dispute_cases dispute_cases_booking_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_cases
    ADD CONSTRAINT dispute_cases_booking_request_id_fkey FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE CASCADE;

--
-- Name: dispute_cases dispute_cases_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_cases
    ADD CONSTRAINT dispute_cases_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

--
-- Name: dispute_cases dispute_cases_opened_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispute_cases
    ADD CONSTRAINT dispute_cases_opened_by_user_id_fkey FOREIGN KEY (opened_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- Name: email_delivery_log email_delivery_log_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;

--
-- Name: email_delivery_log email_delivery_log_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_delivery_log
    ADD CONSTRAINT email_delivery_log_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: help_articles help_articles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.help_categories(id) ON DELETE CASCADE;

--
-- Name: marketplace_events marketplace_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: marketplace_events marketplace_events_booking_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_booking_request_id_fkey FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;

--
-- Name: marketplace_events marketplace_events_vendor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_vendor_user_id_fkey FOREIGN KEY (vendor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: messages messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: referral_attributions referral_attributions_referral_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_attributions
    ADD CONSTRAINT referral_attributions_referral_partner_id_fkey FOREIGN KEY (referral_partner_id) REFERENCES public.referral_partners(id) ON DELETE RESTRICT;

--
-- Name: referral_attributions referral_attributions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_attributions
    ADD CONSTRAINT referral_attributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: referral_partners referral_partners_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_partners
    ADD CONSTRAINT referral_partners_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: vendors vendors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

--
-- PostgreSQL database dump complete
--
