-- Add unit_weight_grams column to products table
-- This represents the weight in grams of the preferred unit (e.g., 1 piece = 300g)
-- For '100g' (grams) unit type, this should be 1 (because amount is already in grams)

-- Add column only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'unit_weight_grams'
  ) THEN
    ALTER TABLE products ADD COLUMN unit_weight_grams DECIMAL(10, 2);
  END IF;
END $$;

-- Set default weight for existing products
-- For '100g' unit type (grams), set to 1 because amount is already in grams
UPDATE products
SET unit_weight_grams = 1
WHERE unit_type = '100g' AND unit_weight_grams IS NULL;

-- For other unit types, set a reasonable default (can be adjusted manually later)
UPDATE products
SET unit_weight_grams = 15
WHERE unit_type = 'tablespoon' AND unit_weight_grams IS NULL;

UPDATE products
SET unit_weight_grams = 5
WHERE unit_type = 'teaspoon' AND unit_weight_grams IS NULL;

UPDATE products
SET unit_weight_grams = 100
WHERE unit_type = 'piece' AND unit_weight_grams IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN products.unit_weight_grams IS 'Weight in grams of one preferred unit. For grams (100g), this is 1. For pieces, e.g., 300g. Nutritional values are always per 100g.';
