-- =====================================================
-- MEAL FAVORITES (the heart)
-- Personal: every household member keeps their own list. Drives the
-- "Ulubione na początku" toggle in meal lists and the heart shown on rows.
-- Run in Supabase Dashboard -> SQL Editor. Idempotent.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meal_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, meal_id)
);

COMMENT ON TABLE public.meal_favorites IS 'Meals a user marked with the heart. One row per (user, meal).';

CREATE INDEX IF NOT EXISTS idx_meal_favorites_user ON public.meal_favorites(user_id);

ALTER TABLE public.meal_favorites ENABLE ROW LEVEL SECURITY;

-- Own rows only: read, add, remove.
DROP POLICY IF EXISTS "Users read own favorites" ON public.meal_favorites;
CREATE POLICY "Users read own favorites"
    ON public.meal_favorites FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users add own favorites" ON public.meal_favorites;
CREATE POLICY "Users add own favorites"
    ON public.meal_favorites FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users remove own favorites" ON public.meal_favorites;
CREATE POLICY "Users remove own favorites"
    ON public.meal_favorites FOR DELETE TO authenticated
    USING (user_id = auth.uid());
