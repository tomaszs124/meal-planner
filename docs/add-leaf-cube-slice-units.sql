-- Add 'leaf', 'cube', 'slice' to allowed unit_type values in products table
-- The existing CHECK constraint needs to be dropped and recreated

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_unit_type_check
    CHECK (unit_type IN ('100g', 'piece', 'tablespoon', 'teaspoon', 'leaf', 'cube', 'slice'));
