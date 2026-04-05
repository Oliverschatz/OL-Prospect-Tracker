-- Migration: Add multi-tenancy (user_id) to existing tables
-- Run this in Supabase SQL Editor BEFORE deploying the new code
-- ============================================================

-- 1. Add user_id column to all tables (nullable first for existing data)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add indexes for user_id
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- 3. Drop old "Allow all" policies
DROP POLICY IF EXISTS "Allow all" ON companies;
DROP POLICY IF EXISTS "Allow all" ON contacts;
DROP POLICY IF EXISTS "Allow all" ON activities;
DROP POLICY IF EXISTS "Allow all" ON templates;

-- 4. Create new RLS policies scoped by user
CREATE POLICY "Users see own companies" ON companies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own activities" ON activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own templates" ON templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTE: After running this migration:
-- - Existing rows have user_id = NULL and will NOT be visible to any user
-- - If you want to assign existing data to a specific user, run:
--   UPDATE companies SET user_id = '<user-uuid>' WHERE user_id IS NULL;
--   UPDATE contacts SET user_id = '<user-uuid>' WHERE user_id IS NULL;
--   UPDATE activities SET user_id = '<user-uuid>' WHERE user_id IS NULL;
--   UPDATE templates SET user_id = '<user-uuid>' WHERE user_id IS NULL;
-- - You can find user UUIDs in the Supabase Dashboard > Authentication > Users
