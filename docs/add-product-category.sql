-- =====================================================
-- ADD PRODUCT CATEGORY FIELD
-- =====================================================

-- Add category column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'other' 
CHECK (category IN ('dairy', 'meat_fish', 'bakery', 'fruits_vegetables', 'other'));

-- Add index for category
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- Add index for household_id + category
CREATE INDEX IF NOT EXISTS idx_products_household_category ON public.products(household_id, category);

-- Comment on column
COMMENT ON COLUMN public.products.category IS 'Product category: dairy, meat_fish, bakery, fruits_vegetables, other';
