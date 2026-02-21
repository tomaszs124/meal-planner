-- Migration: Remove calorie goal columns from user_settings table
-- Date: 2025
-- Description: Removes breakfast_kcal, second_breakfast_kcal, lunch_kcal, dinner_kcal, and snack_kcal columns
--              as the app now relies on per-member meal variants for calorie customization

-- Drop the calorie goal columns
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS breakfast_kcal,
DROP COLUMN IF EXISTS second_breakfast_kcal,
DROP COLUMN IF EXISTS lunch_kcal,
DROP COLUMN IF EXISTS dinner_kcal,
DROP COLUMN IF EXISTS snack_kcal;

-- Note: snack_enabled column is retained as it's still used to determine if snack meal is active
