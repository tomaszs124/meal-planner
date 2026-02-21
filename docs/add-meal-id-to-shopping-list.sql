-- Add meal_id to shopping_list_items to track which meal each item comes from
-- This enables meal-based grouping in shopping list view

-- Add the meal_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_list_items' 
    AND column_name = 'meal_id'
  ) THEN
    ALTER TABLE shopping_list_items 
    ADD COLUMN meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE;
    
    -- Add index for meal_id queries
    CREATE INDEX idx_shopping_list_meal_id ON public.shopping_list_items(meal_id);
    
    COMMENT ON COLUMN shopping_list_items.meal_id IS 'Reference to the meal this item comes from (null for custom items)';
  END IF;
END $$;

-- meal_id can be NULL for:
-- 1. Custom items added manually by users
-- 2. Items from old shopping lists before this feature was added
-- 
-- Display logic in frontend:
-- - Items with meal_id can be grouped by meal
-- - Items without meal_id (NULL) should be shown in an "Other items" section
