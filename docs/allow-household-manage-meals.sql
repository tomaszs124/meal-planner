-- =====================================================
-- ALLOW HOUSEHOLD MEMBERS TO MANAGE MEALS
-- =====================================================

-- Replace restrictive meal policies
DROP POLICY IF EXISTS "Users can manage own meals" ON public.meals;
CREATE POLICY "Users can manage household meals"
    ON public.meals FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    )
    WITH CHECK (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

-- Update meal_items policies to allow household management
DROP POLICY IF EXISTS "Users can manage meal items" ON public.meal_items;
CREATE POLICY "Users can manage household meal items"
    ON public.meal_items FOR ALL
    USING (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    )
    WITH CHECK (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

-- Update meal_images policies to allow household management
DROP POLICY IF EXISTS "Users can manage meal images" ON public.meal_images;
CREATE POLICY "Users can manage household meal images"
    ON public.meal_images FOR ALL
    USING (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    )
    WITH CHECK (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );
