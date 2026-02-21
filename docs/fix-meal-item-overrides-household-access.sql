-- =====================================================
-- FIX: household-wide access to meal item overrides
-- =====================================================
-- Why: UI allows setting per-member variants, but old policies allowed
-- insert/update/delete only when user_id = auth.uid().
-- This blocked saving variants for other household members.

ALTER TABLE public.meal_item_overrides ENABLE ROW LEVEL SECURITY;

-- Remove restrictive policies from initial migration
DROP POLICY IF EXISTS "Users can view meal item overrides in their household" ON public.meal_item_overrides;
DROP POLICY IF EXISTS "Users can create their own meal item overrides" ON public.meal_item_overrides;
DROP POLICY IF EXISTS "Users can update their own overrides" ON public.meal_item_overrides;
DROP POLICY IF EXISTS "Users can delete their own overrides" ON public.meal_item_overrides;

-- Household members can view overrides for meals in their household
CREATE POLICY "Users can view household meal item overrides"
ON public.meal_item_overrides
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.meals m
    WHERE m.id = meal_item_overrides.meal_id
      AND m.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
  )
);

-- Household members can create overrides for any member in the same household
CREATE POLICY "Users can create household meal item overrides"
ON public.meal_item_overrides
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.meals m
    WHERE m.id = meal_item_overrides.meal_id
      AND m.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1
    FROM public.household_users hu
    WHERE hu.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
      AND hu.user_id = meal_item_overrides.user_id
  )
);

-- Household members can update overrides in their household
CREATE POLICY "Users can update household meal item overrides"
ON public.meal_item_overrides
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.meals m
    WHERE m.id = meal_item_overrides.meal_id
      AND m.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.meals m
    WHERE m.id = meal_item_overrides.meal_id
      AND m.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1
    FROM public.household_users hu
    WHERE hu.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
      AND hu.user_id = meal_item_overrides.user_id
  )
);

-- Household members can delete overrides in their household
CREATE POLICY "Users can delete household meal item overrides"
ON public.meal_item_overrides
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.meals m
    WHERE m.id = meal_item_overrides.meal_id
      AND m.household_id IN (SELECT household_id FROM public.get_user_household_ids(auth.uid()))
  )
);
