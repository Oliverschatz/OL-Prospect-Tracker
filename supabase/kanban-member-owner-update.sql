-- OL Kanban — let a project owner edit member rows (e.g. link a worker name)
-- The base schema only allowed an invitee to "claim" their own row. This adds
-- an owner UPDATE policy so the owner can set/change a member's worker_name.
-- Run after supabase/kanban-invite-worker-name.sql.

DROP POLICY IF EXISTS "kanban_members update owner" ON kanban_project_members;
CREATE POLICY "kanban_members update owner" ON kanban_project_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM kanban_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM kanban_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
