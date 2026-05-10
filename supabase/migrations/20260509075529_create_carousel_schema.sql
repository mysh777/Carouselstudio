/*
  # Instagram Carousel Builder Schema

  1. New Tables
    - `brand_kits` - Brand visual settings (colors, fonts, logo)
      - `id`, `user_id`, `name`, `logo_url`, `colors` (jsonb), `fonts` (jsonb), timestamps
    - `presets` - Slide design templates linked to brand kit
      - `id`, `user_id`, `brand_kit_id`, `name`, `width`, `height`, `safe_zones` (jsonb),
        `text_styles` (jsonb), `background_overlay` (jsonb), `margins` (jsonb),
        `logo_settings` (jsonb), `indicator_settings` (jsonb)
    - `projects` - Carousel projects
      - `id`, `user_id`, `name`, `brand_kit_id`, `preset_id`, `idea_text`,
        `carousel_type`, `status`, `archived`, timestamps
    - `slides` - Individual slides within a project
      - `id`, `project_id`, `order_index`, `photo_url`, `headline`, `body`,
        `caption`, `overrides` (jsonb)

  2. Security
    - RLS enabled on all tables
    - Users can only access their own data
    - Separate policies for SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Brand',
  logo_url text DEFAULT '',
  colors jsonb NOT NULL DEFAULT '{"primary":"#0F172A","secondary":"#64748B","accent":"#0EA5E9","text":"#0F172A","textOnDark":"#FFFFFF","textOnLight":"#0F172A"}'::jsonb,
  fonts jsonb NOT NULL DEFAULT '{"headline":"Inter","body":"Inter","accent":"Inter"}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Untitled Preset',
  width integer NOT NULL DEFAULT 1080,
  height integer NOT NULL DEFAULT 1350,
  safe_zones jsonb NOT NULL DEFAULT '{"position":"bottom","x":8,"y":60,"w":84,"h":34}'::jsonb,
  text_styles jsonb NOT NULL DEFAULT '{"headline":{"size":72,"color":"#FFFFFF","align":"left","weight":700,"maxChars":60},"body":{"size":36,"color":"#FFFFFF","align":"left","weight":400,"maxChars":180},"caption":{"size":28,"color":"#FFFFFF","align":"left","weight":500,"maxChars":40}}'::jsonb,
  background_overlay jsonb NOT NULL DEFAULT '{"type":"gradient","color":"#000000","opacity":0.55,"direction":"to top"}'::jsonb,
  margins jsonb NOT NULL DEFAULT '{"top":60,"right":60,"bottom":60,"left":60,"gap":20}'::jsonb,
  logo_settings jsonb NOT NULL DEFAULT '{"position":"top-left","size":80,"opacity":1,"visible":false}'::jsonb,
  indicator_settings jsonb NOT NULL DEFAULT '{"visible":true,"position":"top-right","style":"dots"}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Project',
  brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL,
  preset_id uuid REFERENCES presets(id) ON DELETE SET NULL,
  idea_text text DEFAULT '',
  carousel_type text DEFAULT 'educational',
  status text DEFAULT 'draft',
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  photo_url text DEFAULT '',
  headline text DEFAULT '',
  body text DEFAULT '',
  caption text DEFAULT '',
  overrides jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON brand_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_presets_user ON presets(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_slides_project ON slides(project_id);

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own brand kits" ON brand_kits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own brand kits" ON brand_kits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own brand kits" ON brand_kits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own brand kits" ON brand_kits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view own presets" ON presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own presets" ON presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own presets" ON presets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own presets" ON presets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view own slides" ON slides FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = slides.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users insert own slides" ON slides FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = slides.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users update own slides" ON slides FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = slides.project_id AND projects.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = slides.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users delete own slides" ON slides FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = slides.project_id AND projects.user_id = auth.uid()));
