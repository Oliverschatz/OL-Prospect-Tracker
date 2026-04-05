-- OL Prospect Tracker — Supabase Schema
-- Companies, contacts, activities, and message templates

-- Companies table
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hq TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Germany',
  employees TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT 'Mixed / Multi-discipline EPC',
  website TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'researching'
    CHECK (stage IN ('researching', 'qualified', 'contacted', 'dialogue', 'won', 'lost')),
  fit_scores JSONB NOT NULL DEFAULT '{}',
  pain_points TEXT NOT NULL DEFAULT '',
  entry_angle TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  follow_up_date DATE,
  parent_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Contacts table
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'target'
    CHECK (role IN ('target', 'champion', 'influencer', 'gatekeeper', 'referral')),
  notes TEXT NOT NULL DEFAULT ''
);

-- Activities table (company-level when contact_id is NULL, contact-level otherwise)
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  text TEXT NOT NULL DEFAULT ''
);

-- Message templates
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_companies_stage ON companies(stage);
CREATE INDEX idx_companies_parent_id ON companies(parent_id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user app, protected by app-level password)
CREATE POLICY "Allow all" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON templates FOR ALL USING (true) WITH CHECK (true);

-- Insert default template
INSERT INTO templates (id, name, body, sort_order) VALUES (
  'default-intro-de',
  'Erstansprache LinkedIn (DE)',
  'Hallo [Anrede] [Nachname],

ich bin Trainer aus München, spezialisiert auf Projektmanagement und Projektgeschäft – also Kundenprojekte. Ich würde mich freuen, mich mit Ihnen zu vernetzen, und, wenn es sich ergibt, vielleicht einmal für Ihr Unternehmen tätig zu werden.

Viele Grüße

Oliver Lehmann',
  0
);
