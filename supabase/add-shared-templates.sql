-- Create the `shared_templates` table used by the admin "Shared Templates"
-- editor and exposed read-only to every brand ambassador.
--
-- This migration is idempotent and can be re-run safely. It exists as a
-- standalone file because a previous production database was created before
-- the `shared_templates` section was added to `add-admin-email-templates.sql`,
-- causing "Could not find the table 'public.shared_templates' in the schema
-- cache" when admins tried to save a new shared template.

CREATE TABLE IF NOT EXISTS shared_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  body       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_templates ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read shared templates.
-- Writes go via the admin API (service role), so no write policy is needed.
DROP POLICY IF EXISTS "Authenticated read shared templates" ON shared_templates;
CREATE POLICY "Authenticated read shared templates" ON shared_templates
  FOR SELECT USING (auth.role() = 'authenticated');
