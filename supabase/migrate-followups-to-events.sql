-- Migrate legacy follow_up_date / next_action fields into planned_events,
-- then drop the legacy columns. Run once on Supabase.

BEGIN;

-- Company-level legacy follow-ups -> planned_events
INSERT INTO planned_events (id, user_id, company_id, contact_id, event_date, title, description, done)
SELECT
  'legacy-co-' || c.id,
  c.user_id,
  c.id,
  NULL,
  c.follow_up_date,
  COALESCE(NULLIF(c.next_action, ''), 'Follow-up'),
  '',
  (c.stage IN ('won', 'lost'))
FROM companies c
WHERE c.follow_up_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM planned_events pe
    WHERE pe.company_id = c.id AND pe.contact_id IS NULL
  );

-- Contact-level legacy follow-ups -> planned_events
INSERT INTO planned_events (id, user_id, company_id, contact_id, event_date, title, description, done)
SELECT
  'legacy-ct-' || ct.id,
  ct.user_id,
  ct.company_id,
  ct.id,
  ct.follow_up_date,
  COALESCE(NULLIF(ct.next_action, ''), 'Follow-up'),
  '',
  false
FROM contacts ct
WHERE ct.follow_up_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM planned_events pe WHERE pe.contact_id = ct.id
  );

-- Drop legacy columns
ALTER TABLE companies DROP COLUMN IF EXISTS follow_up_date;
ALTER TABLE companies DROP COLUMN IF EXISTS next_action;
ALTER TABLE contacts  DROP COLUMN IF EXISTS follow_up_date;
ALTER TABLE contacts  DROP COLUMN IF EXISTS next_action;

COMMIT;
