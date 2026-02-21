-- Stores metadata for current shopping list generation range per household

CREATE TABLE IF NOT EXISTS public.shopping_list_state (
    household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
    generated_start_date DATE,
    generated_end_date DATE,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_valid_generated_range CHECK (
        generated_start_date IS NULL
        OR generated_end_date IS NULL
        OR generated_start_date <= generated_end_date
    )
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_state_updated_at
    ON public.shopping_list_state(updated_at);

ALTER TABLE public.shopping_list_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view household shopping list state" ON public.shopping_list_state;
CREATE POLICY "Users can view household shopping list state"
    ON public.shopping_list_state FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can manage household shopping list state" ON public.shopping_list_state;
CREATE POLICY "Users can manage household shopping list state"
    ON public.shopping_list_state FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

DROP TRIGGER IF EXISTS update_shopping_list_state_updated_at ON public.shopping_list_state;
CREATE TRIGGER update_shopping_list_state_updated_at
    BEFORE UPDATE ON public.shopping_list_state
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
