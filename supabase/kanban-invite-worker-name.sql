-- OL Kanban — link an invited person to a worker chip
-- Adds the worker name an invitation is tied to. When the invitee logs in,
-- the board defaults their "Acting as" selection to this worker.
-- Run after supabase/kanban-projects-schema.sql.

ALTER TABLE kanban_project_members
  ADD COLUMN IF NOT EXISTS worker_name TEXT NOT NULL DEFAULT '';
