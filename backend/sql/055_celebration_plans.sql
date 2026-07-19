-- AI Event Planner: persisted celebration plans + per-need vendor recommendations.

CREATE TABLE IF NOT EXISTS public.celebration_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text,
  raw_prompt text NOT NULL,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score int,
  confidence_reasons jsonb,
  summary text,
  budget_total_gbp numeric,
  budget_remaining_gbp numeric,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT celebration_plans_status_chk CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.celebration_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.celebration_plans (id) ON DELETE CASCADE,
  need_id text NOT NULL,
  label text NOT NULL DEFAULT '',
  service_key text NOT NULL,
  optional boolean NOT NULL DEFAULT false,
  primary_vendor_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  alternative_vendor_user_ids uuid[] NOT NULL DEFAULT '{}',
  estimated_cost_gbp numeric,
  why_selected text,
  score_breakdown jsonb,
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT celebration_plan_items_plan_need_unique UNIQUE (plan_id, need_id)
);

CREATE INDEX IF NOT EXISTS celebration_plans_client_updated_idx
  ON public.celebration_plans (client_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS celebration_plan_items_plan_idx
  ON public.celebration_plan_items (plan_id);

COMMENT ON TABLE public.celebration_plans IS
  'AI Event Planner celebration plans for clients (prompt → brief → recommendations).';
COMMENT ON TABLE public.celebration_plan_items IS
  'Per-need primary + alternative vendor recommendations for a celebration plan.';
