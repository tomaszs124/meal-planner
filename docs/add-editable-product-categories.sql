-- =====================================================
-- EDITABLE PRODUCT CATEGORIES (per household)
-- =====================================================

-- 1) Create table for product categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_categories_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT unique_product_category_per_household UNIQUE(household_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_household_id ON public.product_categories(household_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_household_name ON public.product_categories(household_id, name);

-- 2) Make products.category editable (remove old fixed CHECK enum-like constraint)
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%category%'
    LOOP
        EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE public.products
ALTER COLUMN category TYPE VARCHAR(100);

-- 3) Migrate legacy category keys to readable names
UPDATE public.products
SET category = CASE category
    WHEN 'dairy' THEN 'Nabiał'
    WHEN 'meat_fish' THEN 'Mięso i ryby'
    WHEN 'bakery' THEN 'Pieczywo'
    WHEN 'fruits_vegetables' THEN 'Owoce i warzywa'
    WHEN 'other' THEN 'Pozostałe'
    ELSE category
END;

-- 4) Seed category table from existing products
INSERT INTO public.product_categories (household_id, name)
SELECT DISTINCT p.household_id, p.category
FROM public.products p
WHERE p.category IS NOT NULL
  AND length(trim(p.category)) > 0
ON CONFLICT (household_id, name) DO NOTHING;

-- 5) Ensure defaults exist for every household
INSERT INTO public.product_categories (household_id, name)
SELECT h.id, default_name
FROM public.households h
CROSS JOIN LATERAL (
    SELECT unnest(ARRAY['Nabiał', 'Mięso i ryby', 'Pieczywo', 'Owoce i warzywa', 'Pozostałe']) AS default_name
) defaults
ON CONFLICT (household_id, name) DO NOTHING;

-- 6) Trigger for updated_at
DROP TRIGGER IF EXISTS update_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER update_product_categories_updated_at
    BEFORE UPDATE ON public.product_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7) RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view household product categories" ON public.product_categories;
CREATE POLICY "Users can view household product categories"
    ON public.product_categories FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can manage household product categories" ON public.product_categories;
CREATE POLICY "Users can manage household product categories"
    ON public.product_categories FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    )
    WITH CHECK (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

COMMENT ON TABLE public.product_categories IS 'Editable product categories per household';
COMMENT ON COLUMN public.products.category IS 'Editable category name assigned from product_categories';
