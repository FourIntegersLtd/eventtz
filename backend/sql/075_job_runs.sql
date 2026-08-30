-- At-most-once claim per scheduled job period (in-process hourly maintenance).

CREATE TABLE IF NOT EXISTS public.job_runs (
  job_name text NOT NULL,
  period_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_name, period_key)
);

COMMENT ON TABLE public.job_runs IS
  'One row per job + period (e.g. UTC hour). Insert wins the run; unique conflict means skip.';

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
