-- Personal dietary rules, free text, one per household member.
-- Shown in Settings ("Moje zasady") and read by the MCP connector so the assistant
-- respects them when proposing meals (e.g. "na śniadanie maks 2 jajka").

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS dietary_rules TEXT NULL;

COMMENT ON COLUMN public.user_settings.dietary_rules IS 'Free-text personal rules for meal planning (Polish), used by the MCP assistant. NULL = none.';
