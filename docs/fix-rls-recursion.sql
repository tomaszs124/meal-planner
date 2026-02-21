-- =====================================================
-- FIX: Infinite recursion in household_users RLS
-- =====================================================

-- Drop old policies for household_users
DROP POLICY IF EXISTS "Users can view their household memberships" ON public.household_users;
DROP POLICY IF EXISTS "Household owners can manage members" ON public.household_users;

-- New policies WITHOUT recursion
CREATE POLICY "Users can view their household memberships"
    ON public.household_users FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert household memberships"
    ON public.household_users FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Household owners can manage members"
    ON public.household_users FOR UPDATE
    USING (
        household_id IN (
            SELECT household_id FROM public.household_users
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

CREATE POLICY "Household owners can delete members"
    ON public.household_users FOR DELETE
    USING (
        household_id IN (
            SELECT household_id FROM public.household_users
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );
