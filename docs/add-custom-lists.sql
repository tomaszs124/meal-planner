-- Custom lists (e.g. "Rossmann", "Castorama") independent of meal-based shopping list
CREATE TABLE IF NOT EXISTS custom_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  visible_to uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity text,
  is_checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_lists_household_access" ON custom_lists
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM household_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "custom_list_items_access" ON custom_list_items
  FOR ALL USING (
    list_id IN (
      SELECT cl.id FROM custom_lists cl
      JOIN household_users hu ON hu.household_id = cl.household_id
      WHERE hu.user_id = auth.uid()
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE custom_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_list_items;
