-- Add meal category settings to user_settings table
-- This allows users to customize which meal categories appear in their meal plan

BEGIN;

-- Add new columns to user_settings
ALTER TABLE user_settings
ADD COLUMN second_breakfast_enabled BOOLEAN DEFAULT true,
ADD COLUMN lunch_enabled BOOLEAN DEFAULT true,
ADD COLUMN dinner_enabled BOOLEAN DEFAULT true;

-- For existing users, set snack_enabled to false by default (if not already set)
UPDATE user_settings SET snack_enabled = false WHERE snack_enabled IS NULL;

-- Add constraints to ensure default values
ALTER TABLE user_settings
ALTER COLUMN second_breakfast_enabled SET DEFAULT true,
ALTER COLUMN lunch_enabled SET DEFAULT true,
ALTER COLUMN dinner_enabled SET DEFAULT true,
ALTER COLUMN snack_enabled SET DEFAULT false;

COMMIT;
