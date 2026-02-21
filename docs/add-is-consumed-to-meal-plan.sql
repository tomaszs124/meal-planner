-- Add is_consumed column to meal_plan table
ALTER TABLE public.meal_plan 
ADD COLUMN IF NOT EXISTS is_consumed BOOLEAN DEFAULT false NOT NULL;
