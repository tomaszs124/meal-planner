-- meal_plan table - stores user's planned meals for specific dates
CREATE TABLE IF NOT EXISTS public.meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack')),
  is_consumed BOOLEAN DEFAULT false NOT NULL,
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  
  UNIQUE(user_id, date, meal_type)
);

-- RLS policies
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;

-- Users can only see their own meal plans
CREATE POLICY "Users can view own meal plans"
  ON public.meal_plan
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own meal plans
CREATE POLICY "Users can insert own meal plans"
  ON public.meal_plan
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own meal plans
CREATE POLICY "Users can update own meal plans"
  ON public.meal_plan
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own meal plans
CREATE POLICY "Users can delete own meal plans"
  ON public.meal_plan
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups by user and date
CREATE INDEX IF NOT EXISTS meal_plan_user_date_idx ON public.meal_plan(user_id, date);
CREATE INDEX IF NOT EXISTS meal_plan_household_idx ON public.meal_plan(household_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.meal_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
