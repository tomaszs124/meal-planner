-- =====================================================
-- RLS HARDENING (proposed, NOT yet applied)
-- Source: docs/rls-audit.md (2026-10-04), findings #1-#4, #6, #10.
-- Run in Supabase Dashboard -> SQL Editor after reading the audit.
-- Idempotent: safe to re-run. Service-role clients (MCP connector) are unaffected (they bypass RLS).
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- #1 CRITICAL: anyone signed in could insert themselves into ANY household
-- (as 'owner'). The UI never inserts into household_users; members are
-- added by hand in the dashboard. Replace the policy with "owners only".
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can insert household memberships" ON public.household_users;

CREATE POLICY "Household owners can add members"
    ON public.household_users FOR INSERT TO authenticated
    WITH CHECK (
        household_id IN (
            SELECT hu.household_id FROM public.household_users hu
            WHERE hu.user_id = auth.uid() AND hu.role = 'owner'
        )
    );

-- -----------------------------------------------------
-- #2 HIGH: get_user_household_ids(uuid) returned the households of ANY user
-- and was callable by anon. Keep the signature (used by ~25 policies), add a
-- guard so it only ever answers for the caller, pin search_path, drop anon.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_household_ids(user_uuid UUID)
RETURNS TABLE(household_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT hu.household_id
    FROM public.household_users hu
    WHERE hu.user_id = user_uuid
      AND user_uuid = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_household_ids(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_household_ids(UUID) TO authenticated, service_role;

-- Unused helper that leaks whether a (meal, user) pair has overrides.
REVOKE EXECUTE ON FUNCTION public.user_has_meal_overrides(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------
-- #3 HIGH: profiles were readable by everyone, including anonymous visitors.
-- The app only ever reads profiles of household members.
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view household profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR id IN (
            SELECT hu.user_id FROM public.household_users hu
            WHERE hu.household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

-- -----------------------------------------------------
-- #4 MEDIUM: meal_plan had two generations of policies (household-wide and
-- owner-only). Make the household-wide set explicit and check that the row's
-- user and meal belong to the same household.
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can view own meal plans"          ON public.meal_plan;
DROP POLICY IF EXISTS "Users can insert own meal plans"        ON public.meal_plan;
DROP POLICY IF EXISTS "Users can update own meal plans"        ON public.meal_plan;
DROP POLICY IF EXISTS "Users can delete own meal plans"        ON public.meal_plan;
DROP POLICY IF EXISTS "Users can view household meal plans"    ON public.meal_plan;
DROP POLICY IF EXISTS "Users can manage household meal plans"  ON public.meal_plan;

CREATE POLICY "Users can view household meal plans"
    ON public.meal_plan FOR SELECT TO authenticated
    USING (household_id IN (SELECT get_user_household_ids(auth.uid())));

CREATE POLICY "Users can manage household meal plans"
    ON public.meal_plan FOR ALL TO authenticated
    USING (household_id IN (SELECT get_user_household_ids(auth.uid())))
    WITH CHECK (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
        AND EXISTS (
            SELECT 1 FROM public.household_users hu
            WHERE hu.household_id = meal_plan.household_id AND hu.user_id = meal_plan.user_id
        )
        AND EXISTS (
            SELECT 1 FROM public.meals m
            WHERE m.id = meal_plan.meal_id AND m.household_id = meal_plan.household_id
        )
    );

-- -----------------------------------------------------
-- #6 LOW: leftover owner-only policies on meal_item_overrides (the fix
-- migration dropped different names). Harmless (OR-ed), but confusing.
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own meal item overrides" ON public.meal_item_overrides;
DROP POLICY IF EXISTS "Users can delete their own meal item overrides" ON public.meal_item_overrides;

-- -----------------------------------------------------
-- #10 FUNCTIONAL: signup trigger ran without SECURITY DEFINER, so RLS on
-- user_settings could block it and break registration.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_user_settings_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_settings (user_id, snack_enabled, second_breakfast_enabled, lunch_enabled, dinner_enabled)
    VALUES (NEW.id, false, true, true, true)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

COMMIT;

-- =====================================================
-- NOT INCLUDED (decisions needed, see audit #5, #7, #8, #9):
--  * #5  storage bucket meal-images is public (photos reachable by URL without login).
--        Making it private requires signed URLs in the UI.
--  * #7  custom_lists.visible_to is only enforced in the UI, not by RLS.
--  * #8  cross-household references (product_id / tag_id / meal_id in child rows)
--        are not validated by RLS; integrity issue, not a data leak.
--  * #9  hygiene: add TO authenticated everywhere, use (select auth.uid()),
--        drop the "Users can create households" INSERT policy, drop meals.is_shared.
-- =====================================================
