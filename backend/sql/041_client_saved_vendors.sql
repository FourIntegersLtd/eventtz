-- Client saved vendors (server-side favorites).

CREATE TABLE IF NOT EXISTS public.client_saved_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_user_id, vendor_user_id)
);

CREATE INDEX IF NOT EXISTS client_saved_vendors_client_idx
  ON public.client_saved_vendors (client_user_id, created_at DESC);

COMMENT ON TABLE public.client_saved_vendors IS
  'Client bookmarked vendors for favorites / saved list.';
