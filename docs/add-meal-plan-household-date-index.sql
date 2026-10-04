-- Index for range queries over a household's plan (week progress, shopping list
-- generation for several members): WHERE household_id = ? AND date BETWEEN ? AND ?
-- The existing meal_plan_user_date_idx (user_id, date) does not help these.

CREATE INDEX IF NOT EXISTS meal_plan_household_date_idx
  ON public.meal_plan (household_id, date);
