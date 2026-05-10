/*
  # v1.1 Fixes: triggers, rate limit, storage buckets and policies

  1. New Functions & Triggers
    - `set_updated_at()` trigger function
    - Triggers on brand_kits, presets, projects, slides
  2. New Tables
    - `generation_log` for AI rate limiting (30/hour per user)
  3. Storage
    - `carousel-photos` bucket (private, user-scoped RLS)
    - `fonts` bucket (private, user-scoped RLS)
  4. Security
    - RLS on generation_log (users see own rows only)
    - Storage policies by user_id folder prefix
*/

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brand_kits_updated_at ON brand_kits;
CREATE TRIGGER trg_brand_kits_updated_at BEFORE UPDATE ON brand_kits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_presets_updated_at ON presets;
CREATE TRIGGER trg_presets_updated_at BEFORE UPDATE ON presets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_slides_updated_at ON slides;
CREATE TRIGGER trg_slides_updated_at BEFORE UPDATE ON slides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_log_user_time ON generation_log(user_id, created_at DESC);

ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own log" ON generation_log;
CREATE POLICY "Users view own log" ON generation_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('carousel-photos', 'carousel-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp']::text[]),
  ('fonts', 'fonts', false, 5242880, ARRAY['font/woff2','font/woff','font/ttf','font/otf','application/octet-stream']::text[])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "photos select own" ON storage.objects;
DROP POLICY IF EXISTS "photos insert own" ON storage.objects;
DROP POLICY IF EXISTS "photos update own" ON storage.objects;
DROP POLICY IF EXISTS "photos delete own" ON storage.objects;

CREATE POLICY "photos select own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'carousel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'carousel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'carousel-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'carousel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'carousel-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "fonts select own" ON storage.objects;
DROP POLICY IF EXISTS "fonts insert own" ON storage.objects;
DROP POLICY IF EXISTS "fonts update own" ON storage.objects;
DROP POLICY IF EXISTS "fonts delete own" ON storage.objects;

CREATE POLICY "fonts select own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fonts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "fonts insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fonts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "fonts update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fonts' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'fonts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "fonts delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fonts' AND (storage.foldername(name))[1] = auth.uid()::text);
