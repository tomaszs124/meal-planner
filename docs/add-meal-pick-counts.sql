-- =====================================================
-- MEAL PICK COUNTS
-- How many times each meal was put into a day plan (any member, any date).
-- Used for the default "Najczęściej wybierane" sort on the Meals list and in
-- the meal picker. A view over meal_plan, so it is retroactive and needs no
-- counter maintenance. security_invoker: the caller's RLS on meal_plan applies,
-- so members only see counts of their own household.
-- Run in Supabase Dashboard -> SQL Editor. Idempotent.
-- =====================================================

CREATE OR REPLACE VIEW public.meal_pick_counts
WITH (security_invoker = true) AS
SELECT
    meal_id,
    household_id,
    COUNT(*)::int AS picks
FROM public.meal_plan
GROUP BY meal_id, household_id;

COMMENT ON VIEW public.meal_pick_counts IS 'Times a meal was planned (rows in meal_plan), per household. Drives the "most picked" sort.';

GRANT SELECT ON public.meal_pick_counts TO authenticated;
