-- OL Kanban Board — Multi-project + sharing migration
-- Adds named projects that can be shared with other people ("workers") as
-- full collaborators. Workers, cards and documents move from being scoped by
-- user_id to being scoped by project_id, and access is granted to every
-- member of a project (owner + invited workers).
--
-- Run this AFTER supabase/kanban-schema.sql. Safe to run once on an existing
-- board: existing data is migrated into a project named "New PMP Class".

-- ─── Projects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

-- ─── Project members (owner + invited collaborators) ─────────────────────────
-- An invitation is a row with the invitee's email and a null user_id; it is
-- linked to their account (user_id set) the first time they sign in with that
-- email. Every member — owner or accepted invitee — has full read/write access.
CREATE TABLE IF NOT EXISTS kanban_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS kanban_project_members_user_idx
  ON kanban_project_members (user_id);
CREATE INDEX IF NOT EXISTS kanban_project_members_email_idx
  ON kanban_project_members (lower(email));

-- ─── Access helper ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can check membership without tripping RLS recursion
-- when used inside policies on kanban_project_members itself.
CREATE OR REPLACE FUNCTION kanban_can_access(p_project UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM kanban_projects p
    WHERE p.id = p_project AND p.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM kanban_project_members m
    WHERE m.project_id = p_project AND m.user_id = auth.uid()
  );
$$;

-- ─── RLS: projects ───────────────────────────────────────────────────────────
ALTER TABLE kanban_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_projects read"   ON kanban_projects;
DROP POLICY IF EXISTS "kanban_projects insert" ON kanban_projects;
DROP POLICY IF EXISTS "kanban_projects update" ON kanban_projects;
DROP POLICY IF EXISTS "kanban_projects delete" ON kanban_projects;

CREATE POLICY "kanban_projects read" ON kanban_projects
  FOR SELECT USING (kanban_can_access(id));
CREATE POLICY "kanban_projects insert" ON kanban_projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "kanban_projects update" ON kanban_projects
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "kanban_projects delete" ON kanban_projects
  FOR DELETE USING (owner_id = auth.uid());

-- ─── RLS: members ────────────────────────────────────────────────────────────
ALTER TABLE kanban_project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_members read"   ON kanban_project_members;
DROP POLICY IF EXISTS "kanban_members insert" ON kanban_project_members;
DROP POLICY IF EXISTS "kanban_members claim"  ON kanban_project_members;
DROP POLICY IF EXISTS "kanban_members delete" ON kanban_project_members;

-- A user can see member rows for projects they belong to, plus invitations
-- addressed to their email (so pending invites are discoverable before accept).
CREATE POLICY "kanban_members read" ON kanban_project_members
  FOR SELECT USING (
    kanban_can_access(project_id)
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Only the project owner can invite.
CREATE POLICY "kanban_members insert" ON kanban_project_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM kanban_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- An invitee claims their pending invitation by linking it to their account.
CREATE POLICY "kanban_members claim" ON kanban_project_members
  FOR UPDATE USING (
    user_id IS NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- The owner can remove a member; a member can remove themselves.
CREATE POLICY "kanban_members delete" ON kanban_project_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM kanban_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- ─── Add project_id to the board tables ──────────────────────────────────────
ALTER TABLE kanban_workers   ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES kanban_projects(id) ON DELETE CASCADE;
ALTER TABLE kanban_cards     ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES kanban_projects(id) ON DELETE CASCADE;
ALTER TABLE kanban_documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES kanban_projects(id) ON DELETE CASCADE;

-- ─── Backfill: one "New PMP Class" project per existing board owner ──────────
DO $$
DECLARE
  uid UUID;
  pid UUID;
BEGIN
  FOR uid IN (
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM kanban_workers   WHERE project_id IS NULL
      UNION SELECT user_id FROM kanban_cards     WHERE project_id IS NULL
      UNION SELECT user_id FROM kanban_documents WHERE project_id IS NULL
    ) s
  ) LOOP
    -- Reuse an existing "New PMP Class" project for this owner if present.
    SELECT id INTO pid FROM kanban_projects
      WHERE owner_id = uid AND name = 'New PMP Class' LIMIT 1;
    IF pid IS NULL THEN
      INSERT INTO kanban_projects (owner_id, name) VALUES (uid, 'New PMP Class')
        RETURNING id INTO pid;
    END IF;

    INSERT INTO kanban_project_members (project_id, user_id, email, role, invited_by, accepted_at)
      SELECT pid, uid, lower(COALESCE(u.email, '')), 'owner', uid, now()
      FROM auth.users u WHERE u.id = uid
      ON CONFLICT (project_id, email) DO NOTHING;

    UPDATE kanban_workers   SET project_id = pid WHERE user_id = uid AND project_id IS NULL;
    UPDATE kanban_cards     SET project_id = pid WHERE user_id = uid AND project_id IS NULL;
    UPDATE kanban_documents SET project_id = pid WHERE user_id = uid AND project_id IS NULL;
  END LOOP;
END $$;

-- ─── Drop the old user_id-based policies before removing the column ──────────
DROP POLICY IF EXISTS "kanban_workers read own"     ON kanban_workers;
DROP POLICY IF EXISTS "kanban_workers insert own"   ON kanban_workers;
DROP POLICY IF EXISTS "kanban_workers update own"   ON kanban_workers;
DROP POLICY IF EXISTS "kanban_workers delete own"   ON kanban_workers;
DROP POLICY IF EXISTS "kanban_cards read own"       ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards insert own"     ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards update own"     ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards delete own"     ON kanban_cards;
DROP POLICY IF EXISTS "kanban_documents read own"   ON kanban_documents;
DROP POLICY IF EXISTS "kanban_documents insert own" ON kanban_documents;
DROP POLICY IF EXISTS "kanban_documents update own" ON kanban_documents;
DROP POLICY IF EXISTS "kanban_documents delete own" ON kanban_documents;

-- ─── Lock project_id in, drop the now-redundant user_id scoping ──────────────
ALTER TABLE kanban_workers   ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE kanban_cards     ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE kanban_documents ALTER COLUMN project_id SET NOT NULL;

-- Workers are now unique per project, not per user.
ALTER TABLE kanban_workers DROP CONSTRAINT IF EXISTS kanban_workers_user_id_name_key;
DO $$ BEGIN
  ALTER TABLE kanban_workers ADD CONSTRAINT kanban_workers_project_name_key UNIQUE (project_id, name);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS kanban_cards_user_panel_idx;
CREATE INDEX IF NOT EXISTS kanban_cards_project_panel_idx
  ON kanban_cards (project_id, panel, sort_order);
CREATE INDEX IF NOT EXISTS kanban_documents_project_kind_idx
  ON kanban_documents (project_id, kind, sort_order);

ALTER TABLE kanban_workers   DROP COLUMN IF EXISTS user_id;
ALTER TABLE kanban_cards     DROP COLUMN IF EXISTS user_id;
ALTER TABLE kanban_documents DROP COLUMN IF EXISTS user_id;

-- ─── RLS: board tables now keyed on project membership ───────────────────────
-- (the old user_id "*_own" policies were dropped above, before the column.)
DROP POLICY IF EXISTS "kanban_workers access"   ON kanban_workers;
DROP POLICY IF EXISTS "kanban_cards access"     ON kanban_cards;
DROP POLICY IF EXISTS "kanban_documents access" ON kanban_documents;

CREATE POLICY "kanban_workers access" ON kanban_workers
  FOR ALL USING (kanban_can_access(project_id))
  WITH CHECK (kanban_can_access(project_id));

CREATE POLICY "kanban_cards access" ON kanban_cards
  FOR ALL USING (kanban_can_access(project_id))
  WITH CHECK (kanban_can_access(project_id));

CREATE POLICY "kanban_documents access" ON kanban_documents
  FOR ALL USING (kanban_can_access(project_id))
  WITH CHECK (kanban_can_access(project_id));

-- ─── Storage: project members share attachments ─────────────────────────────
-- New uploads are namespaced by project id (see lib/kanban-db.uploadFile), so
-- access is granted to any member of that project. Legacy objects namespaced by
-- the uploader's user id remain readable by that uploader.
DROP POLICY IF EXISTS "kanban storage read own"   ON storage.objects;
DROP POLICY IF EXISTS "kanban storage insert own" ON storage.objects;
DROP POLICY IF EXISTS "kanban storage update own" ON storage.objects;
DROP POLICY IF EXISTS "kanban storage delete own" ON storage.objects;

CREATE POLICY "kanban storage read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kanban' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR kanban_can_access(NULLIF((storage.foldername(name))[1], '')::uuid)
  ));

CREATE POLICY "kanban storage insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kanban' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR kanban_can_access(NULLIF((storage.foldername(name))[1], '')::uuid)
  ));

CREATE POLICY "kanban storage update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kanban' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR kanban_can_access(NULLIF((storage.foldername(name))[1], '')::uuid)
  ));

CREATE POLICY "kanban storage delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kanban' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR kanban_can_access(NULLIF((storage.foldername(name))[1], '')::uuid)
  ));
