-- Dodanie kategorii do posiłków
-- Kategoria główna i alternatywne dla planowania dnia

-- Dodaj kolumny do tabeli meals
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS alternative_categories TEXT[] DEFAULT '{}';

-- Sprawdź czy primary_category ma dozwolone wartości
ALTER TABLE public.meals 
ADD CONSTRAINT check_primary_category 
CHECK (primary_category IS NULL OR primary_category IN ('breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack'));

-- Index dla wyszukiwania po kategorii
CREATE INDEX IF NOT EXISTS idx_meals_primary_category ON public.meals(primary_category);
CREATE INDEX IF NOT EXISTS idx_meals_alternative_categories ON public.meals USING GIN(alternative_categories);
