-- Persist servings per meal in shopping list state so changes are shared across devices

ALTER TABLE public.shopping_list_state
ADD COLUMN IF NOT EXISTS meal_servings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.shopping_list_state.meal_servings IS 'Map of meal_id -> servings value used in shopping list dish view';
