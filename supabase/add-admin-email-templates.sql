-- Admin email templates (sent by admin TO ambassadors, e.g. welcome, announcements)
-- and shared message templates (available to all ambassadors).
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS admin_email_templates (
  id         TEXT PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE admin_email_templates ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service role (used by admin API routes) can read/write.

CREATE TABLE IF NOT EXISTS shared_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  body       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shared_templates ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read shared templates.
-- Writes go via the admin API (service role), so no write policy is needed here.
DROP POLICY IF EXISTS "Authenticated read shared templates" ON shared_templates;
CREATE POLICY "Authenticated read shared templates" ON shared_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed a default welcome email template if none exists.
INSERT INTO admin_email_templates (id, slug, name, subject, body)
SELECT
  'welcome-default',
  'welcome',
  'Welcome to Prospect Tracker',
  'Welcome to the Oliver F. Lehmann Prospect Tracker',
  E'Hello [FullName],\n\nWelcome aboard! Your Prospect Tracker account has been created.\n\nLogin: [LoginUrl]\nEmail: [Email]\nTemporary password: [TempPassword]\n\nPlease sign in and change your password under Settings as soon as possible.\n\nBest regards,\n[AdminName]'
WHERE NOT EXISTS (SELECT 1 FROM admin_email_templates WHERE slug = 'welcome');
