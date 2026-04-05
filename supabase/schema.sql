-- OL Prospect Tracker — Supabase Schema (Multi-tenant)
-- Companies, contacts, activities, and message templates
-- Each row is scoped to a user via user_id (Supabase Auth)

-- Companies table
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  text TEXT NOT NULL DEFAULT ''
);

-- Message templates
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_companies_stage ON companies(stage);
CREATE INDEX idx_companies_parent_id ON companies(parent_id);
CREATE INDEX idx_templates_user_id ON templates(user_id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- RLS policies: each user can only access their own data
CREATE POLICY "Users see own companies" ON companies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own activities" ON activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own templates" ON templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
