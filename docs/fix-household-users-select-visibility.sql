-- Fix visibility of all members in the same household
-- Current policy from fix-rls-recursion.sql limits SELECT to only own membership row.
-- This policy lets a user see all household_users rows for households they belong to.

DROP POLICY IF EXISTS "Users can view their household memberships" ON public.household_users;

CREATE POLICY "Users can view their household memberships"
    ON public.household_users FOR SELECT
    USING (
        household_id IN (
            SELECT household_id FROM public.get_user_household_ids(auth.uid())
        )
    );
