-- =====================================================
-- MEAL PLANNER - DATABASE SCHEMA
-- Compatible with Supabase PostgreSQL
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES (User Extension)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. HOUSEHOLDS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_households_created_by ON public.households(created_by);

-- =====================================================
-- 3. HOUSEHOLD_USERS (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.household_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_household_user UNIQUE(household_id, user_id)
);

CREATE INDEX idx_household_users_household_id ON public.household_users(household_id);
CREATE INDEX idx_household_users_user_id ON public.household_users(user_id);

-- =====================================================
-- 4. PRODUCTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    kcal_per_unit NUMERIC(8,2) NOT NULL CHECK (kcal_per_unit >= 0),
    unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('100g', 'piece', 'tablespoon', 'teaspoon')),
    image_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_household_id ON public.products(household_id);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_household_name ON public.products(household_id, name);

-- =====================================================
-- 5. MEALS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    is_shared BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meals_household_id ON public.meals(household_id);
CREATE INDEX idx_meals_user_id ON public.meals(user_id);
CREATE INDEX idx_meals_household_shared ON public.meals(household_id, is_shared);

-- =====================================================
-- 6. MEAL_ITEMS (Meal Ingredients)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    unit_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_meal_product UNIQUE(meal_id, product_id)
);

CREATE INDEX idx_meal_items_meal_id ON public.meal_items(meal_id);
CREATE INDEX idx_meal_items_product_id ON public.meal_items(product_id);

-- =====================================================
-- 7. MEAL_IMAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meal_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_images_meal_id ON public.meal_images(meal_id);

-- =====================================================
-- 8. MEAL_PLAN
-- =====================================================

CREATE TABLE IF NOT EXISTS public.meal_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    notes TEXT,
    planned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_date ON public.meal_plan(date);
CREATE INDEX idx_meal_plan_user_date ON public.meal_plan(user_id, date);
CREATE INDEX idx_meal_plan_household_date ON public.meal_plan(household_id, date);
CREATE INDEX idx_meal_plan_meal_id ON public.meal_plan(meal_id);

-- =====================================================
-- 9. CONSUMED_MEALS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.consumed_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID REFERENCES public.meal_plan(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    actual_calories NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumed_meals_user_id ON public.consumed_meals(user_id);
CREATE INDEX idx_consumed_meals_consumed_at ON public.consumed_meals(consumed_at);
CREATE INDEX idx_consumed_meals_user_consumed ON public.consumed_meals(user_id, consumed_at DESC);
CREATE INDEX idx_consumed_meals_meal_plan_id ON public.consumed_meals(meal_plan_id);

-- =====================================================
-- 10. SHOPPING_LIST_ITEMS (REAL-TIME)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name VARCHAR(200),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    unit_type VARCHAR(20),
    is_checked BOOLEAN NOT NULL DEFAULT false,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_product_or_name CHECK (product_id IS NOT NULL OR name IS NOT NULL)
);

-- Critical indexes for real-time performance
CREATE INDEX idx_shopping_list_household_id ON public.shopping_list_items(household_id);
CREATE INDEX idx_shopping_list_is_checked ON public.shopping_list_items(is_checked);
CREATE INDEX idx_shopping_list_household_checked ON public.shopping_list_items(household_id, is_checked);
CREATE INDEX idx_shopping_list_product_id ON public.shopping_list_items(product_id);
CREATE INDEX idx_shopping_list_updated_at ON public.shopping_list_items(updated_at);

-- =====================================================
-- 11. BODY_MEASUREMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.body_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight NUMERIC(5,2) CHECK (weight > 0 AND weight < 500),
    waist NUMERIC(5,2) CHECK (waist > 0 AND waist < 300),
    hips NUMERIC(5,2) CHECK (hips > 0 AND hips < 300),
    thigh NUMERIC(5,2) CHECK (thigh > 0 AND thigh < 200),
    biceps NUMERIC(5,2) CHECK (biceps > 0 AND biceps < 100),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_measurement_date UNIQUE(user_id, date)
);

CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, date DESC);

-- =====================================================
-- 12. DAILY_NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    note TEXT,
    mood VARCHAR(20) CHECK (mood IN ('great', 'good', 'neutral', 'bad', 'terrible')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_note_date UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_notes_user_date ON public.daily_notes(user_id, date DESC);

-- =====================================================
-- 13. BOWEL_MOVEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.bowel_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bristol_scale SMALLINT NOT NULL CHECK (bristol_scale BETWEEN 1 AND 7),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bowel_movements_user_timestamp ON public.bowel_movements(user_id, timestamp DESC);
CREATE INDEX idx_bowel_movements_user_date ON public.bowel_movements(user_id, date);

-- =====================================================
-- TRIGGERS: AUTO UPDATE updated_at
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_households_updated_at
    BEFORE UPDATE ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meals_updated_at
    BEFORE UPDATE ON public.meals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_list_items_updated_at
    BEFORE UPDATE ON public.shopping_list_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_body_measurements_updated_at
    BEFORE UPDATE ON public.body_measurements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_notes_updated_at
    BEFORE UPDATE ON public.daily_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumed_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowel_movements ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Get user's household IDs
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_household_ids(user_uuid UUID)
RETURNS TABLE(household_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT hu.household_id
    FROM public.household_users hu
    WHERE hu.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- ================== PROFILES ==================
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ================== HOUSEHOLDS ==================
CREATE POLICY "Users can view their households"
    ON public.households FOR SELECT
    USING (
        id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Users can create households"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Household owners can update"
    ON public.households FOR UPDATE
    USING (
        id IN (
            SELECT household_id FROM public.household_users
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- ================== HOUSEHOLD_USERS ==================
CREATE POLICY "Users can view their household memberships"
    ON public.household_users FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Household owners can manage members"
    ON public.household_users FOR ALL
    USING (
        household_id IN (
            SELECT household_id FROM public.household_users
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- ================== PRODUCTS ==================
CREATE POLICY "Users can view household products"
    ON public.products FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Users can manage household products"
    ON public.products FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

-- ================== MEALS ==================
CREATE POLICY "Users can view household meals"
    ON public.meals FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
        AND (is_shared = true OR user_id = auth.uid())
    );

CREATE POLICY "Users can manage own meals"
    ON public.meals FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
        AND user_id = auth.uid()
    );

-- ================== MEAL_ITEMS ==================
CREATE POLICY "Users can view meal items"
    ON public.meal_items FOR SELECT
    USING (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE household_id IN (SELECT get_user_household_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can manage meal items"
    ON public.meal_items FOR ALL
    USING (
        meal_id IN (
            SELECT id FROM public.meals
            WHERE user_id = auth.uid()
        )
    );

-- ================== MEAL_IMAGES ==================
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
            WHERE user_id = auth.uid()
        )
    );

-- ================== MEAL_PLAN ==================
CREATE POLICY "Users can view household meal plans"
    ON public.meal_plan FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Users can manage household meal plans"
    ON public.meal_plan FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

-- ================== CONSUMED_MEALS ==================
CREATE POLICY "Users can view own consumed meals"
    ON public.consumed_meals FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own consumed meals"
    ON public.consumed_meals FOR ALL
    USING (user_id = auth.uid());

-- ================== SHOPPING_LIST_ITEMS (REAL-TIME) ==================
CREATE POLICY "Users can view household shopping list"
    ON public.shopping_list_items FOR SELECT
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

CREATE POLICY "Users can manage household shopping list"
    ON public.shopping_list_items FOR ALL
    USING (
        household_id IN (SELECT get_user_household_ids(auth.uid()))
    );

-- ================== BODY_MEASUREMENTS ==================
CREATE POLICY "Users can view own measurements"
    ON public.body_measurements FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own measurements"
    ON public.body_measurements FOR ALL
    USING (user_id = auth.uid());

-- ================== DAILY_NOTES ==================
CREATE POLICY "Users can view own daily notes"
    ON public.daily_notes FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own daily notes"
    ON public.daily_notes FOR ALL
    USING (user_id = auth.uid());

-- ================== BOWEL_MOVEMENTS ==================
CREATE POLICY "Users can view own bowel movements"
    ON public.bowel_movements FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own bowel movements"
    ON public.bowel_movements FOR ALL
    USING (user_id = auth.uid());

-- =====================================================
-- ENABLE REALTIME FOR SHOPPING LIST
-- =====================================================

-- Enable realtime on shopping_list_items table
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list_items;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profile extension data';
COMMENT ON TABLE public.households IS 'Shared spaces for users (family/couple)';
COMMENT ON TABLE public.household_users IS 'Many-to-many relationship between users and households';
COMMENT ON TABLE public.products IS 'Food products database with calories';
COMMENT ON TABLE public.meals IS 'Meal templates/recipes';
COMMENT ON TABLE public.meal_items IS 'Ingredients of meals with amounts';
COMMENT ON TABLE public.meal_images IS 'Photos of meals';
COMMENT ON TABLE public.meal_plan IS 'Planned meals for specific days';
COMMENT ON TABLE public.consumed_meals IS 'History of consumed meals';
COMMENT ON TABLE public.shopping_list_items IS 'Real-time synchronized shopping list';
COMMENT ON TABLE public.body_measurements IS 'User body measurements tracking';
COMMENT ON TABLE public.daily_notes IS 'User daily journal notes';
COMMENT ON TABLE public.bowel_movements IS 'Bowel movement tracking (Bristol scale)';

-- =====================================================
-- DONE! Database schema created successfully
-- =====================================================
