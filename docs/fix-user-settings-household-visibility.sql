-- Allow reading user_settings of users from the same household
-- Needed so member names from user_settings.name are visible in shared household UI

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;

CREATE POLICY "Users can view household settings"
    ON public.user_settings
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.household_users target_hu
            WHERE target_hu.user_id = public.user_settings.user_id
              AND target_hu.household_id IN (
                  SELECT household_id FROM public.get_user_household_ids(auth.uid())
              )
        )
    );
