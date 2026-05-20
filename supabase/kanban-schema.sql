-- OL Kanban Board Widget — Supabase Schema
-- Independent from prospect tracker; runs on the same Supabase project.
-- Per-user board (RLS by user_id). Each user starts with worker "Oliver".

-- ─── Workers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e8a838',
  sort_order BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE kanban_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_workers read own" ON kanban_workers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kanban_workers insert own" ON kanban_workers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kanban_workers update own" ON kanban_workers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kanban_workers delete own" ON kanban_workers
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Cards ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identification
  title TEXT NOT NULL DEFAULT '',
  split_group UUID,                            -- groups split siblings together
  split_number INT NOT NULL DEFAULT 1,         -- shown as "Title 1", "Title 2", ...

  -- Content
  explanation TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',               -- safe markdown (parsed client-side, never injected as HTML)

  -- Panel
  panel TEXT NOT NULL DEFAULT 'todo'
    CHECK (panel IN ('todo', 'wip', 'review', 'done')),
  sort_order BIGINT NOT NULL DEFAULT 0,

  -- Workers (free-text first names; matches kanban_workers.name)
  workers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- ECO reference
  eco_domain TEXT,
  eco_task TEXT,
  eco_enabler TEXT,

  -- Literature reference
  lit_book TEXT,                               -- 'pmbok8' | 'apg' | null
  lit_chapter TEXT,
  lit_page TEXT,

  -- Inline hyperlinks under the text body: [{id, label, url}]
  links JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- File attachments grouped by filename (same name = versions):
  -- [{name, versions: [{path, uploaded_at, uploaded_by, size}]}]
  files JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Change history: [{at, by, what}]
  history JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_cards read own" ON kanban_cards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kanban_cards insert own" ON kanban_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kanban_cards update own" ON kanban_cards
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kanban_cards delete own" ON kanban_cards
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS kanban_cards_user_panel_idx
  ON kanban_cards (user_id, panel, sort_order);

-- ─── Storage bucket for card attachments & embedded images ───────────────
-- Run in Supabase SQL editor (or use the Storage UI):
INSERT INTO storage.buckets (id, name, public)
  VALUES ('kanban', 'kanban', false)
  ON CONFLICT (id) DO NOTHING;

-- Owner-only access. Object paths are namespaced by auth.uid() prefix.
CREATE POLICY "kanban storage read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kanban' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kanban storage insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kanban' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kanban storage update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kanban' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kanban storage delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kanban' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Project-level document lists (Internal / External) ─────────────────
CREATE TABLE IF NOT EXISTS kanban_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('internal', 'external')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kanban_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_documents read own"   ON kanban_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kanban_documents insert own" ON kanban_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kanban_documents update own" ON kanban_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kanban_documents delete own" ON kanban_documents FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS kanban_documents_user_kind_idx
  ON kanban_documents (user_id, kind, sort_order);
