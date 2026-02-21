-- =====================================================
-- ADD TAGS SYSTEM FOR MEALS
-- =====================================================

-- Add description/recipe field to meals
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.meals.description IS 'Recipe or description of the meal (step by step instructions)';

-- =====================================================
-- TAGS TABLE
-- =====================================================

-- Drop existing policies if recreating
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view household tags" ON public.tags;
    DROP POLICY IF EXISTS "Users can manage household tags" ON public.tags;
EXCEPTION 
    WHEN undefined_table THEN NULL;
END $$;

-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    text_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_household_tag UNIQUE(household_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_household_id ON public.tags(household_id);

COMMENT ON TABLE public.tags IS 'Tags for categorizing and filtering meals';
COMMENT ON COLUMN public.tags.color IS 'Background color in hex format';
COMMENT ON COLUMN public.tags.text_color IS 'Text color in hex format';

-- Enable RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Users can view household tags"
    ON public.tags FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Users can manage household tags"
    ON public.tags FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

-- =====================================================
-- MEAL_TAGS (Many-to-Many relationship)
-- =====================================================

-- Drop existing policies if recreating
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view meal tags" ON public.meal_tags;
    DROP POLICY IF EXISTS "Users can manage meal tags" ON public.meal_tags;
EXCEPTION 
    WHEN undefined_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.meal_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_meal_tag UNIQUE(meal_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_tags_meal_id ON public.meal_tags(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_tags_tag_id ON public.meal_tags(tag_id);

COMMENT ON TABLE public.meal_tags IS 'Many-to-many relationship between meals and tags';

-- Enable RLS for meal_tags
ALTER TABLE public.meal_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for meal_tags
CREATE POLICY "Users can view meal tags"
    ON public.meal_tags FOR SELECT
    USING (
        meal_id IN (
            SELECT id FROM public.meals 
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can manage meal tags"
    ON public.meal_tags FOR ALL
    USING (
        meal_id IN (
            SELECT id FROM public.meals 
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

-- =====================================================
-- MEAL_IMAGES TABLE
-- =====================================================

-- Drop existing policies if recreating
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view meal images" ON public.meal_images;
    DROP POLICY IF EXISTS "Users can manage meal images" ON public.meal_images;
EXCEPTION 
    WHEN undefined_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.meal_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_images_meal_id ON public.meal_images(meal_id);

COMMENT ON TABLE public.meal_images IS 'Images associated with meals';
COMMENT ON COLUMN public.meal_images.image_url IS 'URL of the meal image';

-- Enable RLS for meal_images
ALTER TABLE public.meal_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for meal_images
CREATE POLICY "Users can view meal images"
    ON public.meal_images FOR SELECT
    USING (
        meal_id IN (
            SELECT id FROM public.meals 
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can manage meal images"
    ON public.meal_images FOR ALL
    USING (
        meal_id IN (
            SELECT id FROM public.meals 
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_tags_updated_at ON public.tags;

CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON public.tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
