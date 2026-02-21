-- =========================================
-- MEAL ITEM OVERRIDES SYSTEM
-- =========================================
-- This migration adds support for user-specific meal item overrides
-- allowing different household members to have customized ingredient
-- lists for the same meal

-- =========================================
-- 1. CREATE meal_item_overrides TABLE
-- =========================================
-- Stores user-specific overrides for meal items
-- When a user has overrides, these replace the default meal_items

CREATE TABLE IF NOT EXISTS meal_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  unit_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one override per meal-user-product combination
  UNIQUE(meal_id, user_id, product_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_meal_item_overrides_meal_id ON meal_item_overrides(meal_id);
CREATE INDEX idx_meal_item_overrides_user_id ON meal_item_overrides(user_id);
CREATE INDEX idx_meal_item_overrides_meal_user ON meal_item_overrides(meal_id, user_id);

-- =========================================
-- 2. ROW LEVEL SECURITY POLICIES
-- =========================================

-- Enable RLS
ALTER TABLE meal_item_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view overrides for meals in their household
CREATE POLICY "Users can view meal item overrides in their household"
ON meal_item_overrides
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meals m
    JOIN household_users hu ON hu.household_id = m.household_id
    WHERE m.id = meal_item_overrides.meal_id
    AND hu.user_id = auth.uid()
  )
);

-- Policy: Users can create overrides for themselves
CREATE POLICY "Users can create their own meal item overrides"
ON meal_item_overrides
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM meals m
    JOIN household_users hu ON hu.household_id = m.household_id
    WHERE m.id = meal_item_overrides.meal_id
    AND hu.user_id = auth.uid()
  )
);

-- Policy: Users can update their own overrides
CREATE POLICY "Users can update their own meal item overrides"
ON meal_item_overrides
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own overrides
CREATE POLICY "Users can delete their own meal item overrides"
ON meal_item_overrides
FOR DELETE
USING (user_id = auth.uid());

-- =========================================
-- 3. TRIGGERS FOR UPDATED_AT
-- =========================================

CREATE OR REPLACE FUNCTION update_meal_item_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meal_item_overrides_updated_at
BEFORE UPDATE ON meal_item_overrides
FOR EACH ROW
EXECUTE FUNCTION update_meal_item_overrides_updated_at();

-- =========================================
-- 4. HELPER FUNCTIONS (Optional)
-- =========================================

-- Function to check if a user has any overrides for a meal
CREATE OR REPLACE FUNCTION user_has_meal_overrides(p_meal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM meal_item_overrides
    WHERE meal_id = p_meal_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_meal_overrides TO authenticated;

-- =========================================
-- MIGRATION COMPLETE
-- =========================================
-- To use this system:
-- 1. When displaying a meal, first check if current user has overrides
-- 2. If overrides exist, use meal_item_overrides instead of meal_items
-- 3. If no overrides, fall back to default meal_items
-- 4. In the UI, show all household members and allow creating overrides per member
