-- Create trigger to automatically create user_settings on signup
-- This ensures every new user has default settings with all meal categories

CREATE OR REPLACE FUNCTION create_user_settings_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (
        user_id,
        snack_enabled,
        second_breakfast_enabled,
        lunch_enabled,
        dinner_enabled
    )
    VALUES (
        NEW.id,
        false, -- snack_enabled: false by default
        true,  -- second_breakfast_enabled: true by default
        true,  -- lunch_enabled: true by default
        true   -- dinner_enabled: true by default
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires when new user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_settings_on_signup();
