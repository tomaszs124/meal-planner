-- Tabela: user_settings (ustawienia użytkownika)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snack_enabled BOOLEAN NOT NULL DEFAULT false,
    breakfast_kcal INTEGER NOT NULL DEFAULT 500 CHECK (breakfast_kcal >= 0 AND breakfast_kcal <= 3000),
    second_breakfast_kcal INTEGER NOT NULL DEFAULT 300 CHECK (second_breakfast_kcal >= 0 AND second_breakfast_kcal <= 3000),
    lunch_kcal INTEGER NOT NULL DEFAULT 700 CHECK (lunch_kcal >= 0 AND lunch_kcal <= 3000),
    dinner_kcal INTEGER NOT NULL DEFAULT 600 CHECK (dinner_kcal >= 0 AND dinner_kcal <= 3000),
    snack_kcal INTEGER NOT NULL DEFAULT 200 CHECK (snack_kcal >= 0 AND snack_kcal <= 3000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_settings UNIQUE(user_id)
);

CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

-- Trigger do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- RLS Policy dla user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi tylko swoje ustawienia
CREATE POLICY "Users can view own settings"
    ON public.user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Użytkownik może wstawiać swoje ustawienia
CREATE POLICY "Users can insert own settings"
    ON public.user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Użytkownik może aktualizować swoje ustawienia
CREATE POLICY "Users can update own settings"
    ON public.user_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Użytkownik może usuwać swoje ustawienia
CREATE POLICY "Users can delete own settings"
    ON public.user_settings
    FOR DELETE
    USING (auth.uid() = user_id);
