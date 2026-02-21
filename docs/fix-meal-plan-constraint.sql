-- Fix meal_plan check constraint to include second_breakfast
ALTER TABLE public.meal_plan 
DROP CONSTRAINT IF EXISTS meal_plan_meal_type_check;

ALTER TABLE public.meal_plan
ADD CONSTRAINT meal_plan_meal_type_check 
CHECK (meal_type IN ('breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack'));
