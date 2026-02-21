-- Track which household member a generated meal item belongs to

ALTER TABLE public.shopping_list_items
ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_list_source_user_id
    ON public.shopping_list_items(source_user_id);

COMMENT ON COLUMN public.shopping_list_items.source_user_id IS 'User for whom this meal-based shopping list item was generated';
