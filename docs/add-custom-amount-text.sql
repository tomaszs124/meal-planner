-- Add custom_amount_text field for free-form amount descriptions on custom shopping list items
-- This allows users to enter text like "garść", "opakowanie", "trochę" instead of numeric amounts

-- Add the new column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopping_list_items' 
    AND column_name = 'custom_amount_text'
  ) THEN
    ALTER TABLE shopping_list_items 
    ADD COLUMN custom_amount_text TEXT NULL;
    
    COMMENT ON COLUMN shopping_list_items.custom_amount_text IS 'Free-form text for custom amount descriptions (e.g., "garść", "2 opakowania")';
  END IF;
END $$;

-- When custom_amount_text is provided, amount field should be set to 1 (dummy value to satisfy NOT NULL constraint)
-- Display logic in frontend:
-- - If custom_amount_text is not null and not empty -> display custom_amount_text
-- - Otherwise -> display amount + unit_type as before
