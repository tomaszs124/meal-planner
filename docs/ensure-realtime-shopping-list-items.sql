-- Ensure shopping_list_items sends realtime updates reliably

-- Include table in Supabase realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shopping_list_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list_items;
  END IF;
END $$;

-- For safer UPDATE payloads in realtime
ALTER TABLE public.shopping_list_items REPLICA IDENTITY FULL;
