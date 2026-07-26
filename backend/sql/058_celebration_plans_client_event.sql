-- Link AI celebration plans to client_events so planner handoff creates an event before booking.

ALTER TABLE public.celebration_plans
  ADD COLUMN IF NOT EXISTS client_event_id uuid REFERENCES public.client_events (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_celebration_plans_client_event
  ON public.celebration_plans (client_event_id)
  WHERE client_event_id IS NOT NULL;

COMMENT ON COLUMN public.celebration_plans.client_event_id IS
  'Client celebration event created when the client starts booking from this plan.';
