-- Creator referral partners + vendor signup attributions (admin-managed links).

CREATE TABLE IF NOT EXISTS public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  display_name text NOT NULL,
  instagram_handle text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_admin_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_partners_slug_unique UNIQUE (slug),
  CONSTRAINT referral_partners_slug_format_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_referral_partners_active_slug
  ON public.referral_partners (slug)
  WHERE is_active = true;

COMMENT ON TABLE public.referral_partners IS
  'Instagram creators / partners with trackable vendor signup links (?ref=slug).';

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  referral_partner_id uuid NOT NULL REFERENCES public.referral_partners (id) ON DELETE RESTRICT,
  referral_slug text NOT NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  shoutout_completed boolean NOT NULL DEFAULT false,
  shoutout_completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_partner_attributed
  ON public.referral_attributions (referral_partner_id, attributed_at DESC);

COMMENT ON TABLE public.referral_attributions IS
  'Vendor signups attributed to a referral partner link (first-touch at registration).';

DROP TRIGGER IF EXISTS trg_referral_partners_updated_at ON public.referral_partners;
CREATE TRIGGER trg_referral_partners_updated_at
  BEFORE UPDATE ON public.referral_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.eventtz_set_updated_at();

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
