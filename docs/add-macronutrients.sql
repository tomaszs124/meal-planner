-- =====================================================
-- Dodanie makroskładników do produktów
-- =====================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS protein NUMERIC(8,2),
ADD COLUMN IF NOT EXISTS fat NUMERIC(8,2),
ADD COLUMN IF NOT EXISTS carbs NUMERIC(8,2);

COMMENT ON COLUMN public.products.protein IS 'Białko (g) na jednostkę';
COMMENT ON COLUMN public.products.fat IS 'Tłuszcz (g) na jednostkę';
COMMENT ON COLUMN public.products.carbs IS 'Węglowodany (g) na jednostkę';
