-- meal_plan.is_skipped is used by the planner UI ("pominięty" state) but was never
-- captured in a migration file (the column was added by hand in the dashboard).
-- This file documents it and is safe to re-run.

ALTER TABLE public.meal_plan
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meal_plan.is_skipped IS 'Planned meal explicitly skipped by the user (mutually exclusive with is_consumed in the UI).';
