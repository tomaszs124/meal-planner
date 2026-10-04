-- Add package_size column to products table
-- Represents how much of the product is in one retail package, expressed in the
-- product's preferred unit (unit_type):
--   '100g'  -> grams            (e.g. tofu 180 g  -> 180)
--   'piece' -> number of pieces (e.g. eggs 10 szt -> 10)
--   'slice' -> number of slices (e.g. cheese 8 slices -> 8)
-- Used by the recipe rules (whole / half / quarter package per 2 persons).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products'
    AND column_name = 'package_size'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN package_size NUMERIC(10, 2) NULL CHECK (package_size > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.products.package_size IS 'Amount of product in one retail package, in the product''s preferred unit (unit_type). NULL = unknown / sold loose.';
