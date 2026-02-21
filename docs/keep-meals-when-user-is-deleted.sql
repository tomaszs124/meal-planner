-- =====================================================
-- KEEP MEALS AFTER USER DELETION
-- =====================================================
-- Goal: deleting auth.users row should NOT delete meals created by that user.
-- We change meals.user_id FK from ON DELETE CASCADE to ON DELETE SET NULL.

BEGIN;

ALTER TABLE public.meals
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.meals
  DROP CONSTRAINT IF EXISTS meals_user_id_fkey;

ALTER TABLE public.meals
  ADD CONSTRAINT meals_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

COMMIT;
