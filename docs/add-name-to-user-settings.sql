-- Add name column to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Add comment to the column
COMMENT ON COLUMN public.user_settings.name IS 'User display name for household member identification';
