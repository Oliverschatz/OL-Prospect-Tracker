-- OL Kanban — WIP column card limit
-- Optional per-project maximum number of cards allowed in the WIP column.
-- null = no limit. Run after supabase/kanban-projects-schema.sql.

ALTER TABLE kanban_projects
  ADD COLUMN IF NOT EXISTS wip_limit INT;
