-- Adds opportunity fields and attachments to companies.
-- Run once in Supabase SQL editor.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
  ADD COLUMN IF NOT EXISTS probability    INT,
  ADD COLUMN IF NOT EXISTS expected_close DATE,
  ADD COLUMN IF NOT EXISTS attachments    JSONB NOT NULL DEFAULT '[]'::jsonb;
