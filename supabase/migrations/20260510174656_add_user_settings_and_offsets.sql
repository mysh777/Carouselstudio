/*
  # Add user_settings and slide position offsets

  1. New Tables
    - `user_settings` - per-user app settings (Claude API key)
      - `user_id` (uuid, PK, references auth.users)
      - `anthropic_api_key` (text, nullable)
      - `updated_at` (timestamptz)

  2. Schema notes
    - `slides.overrides` is already JSONB. We extend the TS shape to include
      `photo_offset_x/y`, `photo_scale`, `text_offset_x/y` — no column changes needed.

  3. Security
    - RLS enabled on `user_settings`
    - Users can only read/update/insert/delete their own row
*/

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_api_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can view own settings') THEN
    CREATE POLICY "Users can view own settings"
      ON user_settings FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can insert own settings') THEN
    CREATE POLICY "Users can insert own settings"
      ON user_settings FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can update own settings') THEN
    CREATE POLICY "Users can update own settings"
      ON user_settings FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can delete own settings') THEN
    CREATE POLICY "Users can delete own settings"
      ON user_settings FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;