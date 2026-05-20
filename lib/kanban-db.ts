import { supabase } from './supabase';
import type { Card, Panel, Worker } from './kanban-types';
import { DEFAULT_WORKER_COLORS } from './kanban-types';

const BUCKET = 'kanban';

// ─── Workers ─────────────────────────────────────────────────────────────

export async function listWorkers(userId: string): Promise<Worker[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_workers')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Seed "Oliver" the first time the user opens the board.
  if (!data || data.length === 0) {
    const seeded = await createWorker(userId, 'Oliver');
    return [seeded];
  }
  return data as Worker[];
}

export async function createWorker(userId: string, name: string): Promise<Worker> {
  if (!supabase) throw new Error('Supabase not configured');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Worker name is required');

  const { data: existing } = await supabase
    .from('kanban_workers')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length ? (existing[0].sort_order ?? 0) + 1 : 0;
  const color = DEFAULT_WORKER_COLORS[nextOrder % DEFAULT_WORKER_COLORS.length];

  const { data, error } = await supabase
    .from('kanban_workers')
    .insert({ user_id: userId, name: trimmed, color, sort_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data as Worker;
}

export async function updateWorker(id: string, patch: Partial<Worker>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_workers').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteWorker(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_workers').delete().eq('id', id);
  if (error) throw error;
}

// ─── Cards ───────────────────────────────────────────────────────────────

export async function listCards(userId: string): Promise<Card[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Card[];
}

export async function createCard(
  userId: string,
  partial: Partial<Card> & { title: string }
): Promise<Card> {
  if (!supabase) throw new Error('Supabase not configured');
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    title: partial.title,
    split_group: partial.split_group ?? null,
    split_number: partial.split_number ?? 1,
    explanation: partial.explanation ?? '',
    body: partial.body ?? '',
    panel: partial.panel ?? 'todo',
    sort_order: partial.sort_order ?? 0,
    workers: partial.workers ?? [],
    eco_domain: partial.eco_domain ?? null,
    eco_task: partial.eco_task ?? null,
    eco_enabler: partial.eco_enabler ?? null,
    lit_book: partial.lit_book ?? null,
    lit_chapter: partial.lit_chapter ?? null,
    lit_page: partial.lit_page ?? null,
    links: partial.links ?? [],
    files: partial.files ?? [],
    history: partial.history ?? [{ at: now, by: 'system', what: 'Card created' }],
  };
  const { data, error } = await supabase.from('kanban_cards').insert(row).select().single();
  if (error) throw error;
  return data as Card;
}

export async function updateCard(id: string, patch: Partial<Card>): Promise<Card> {
  if (!supabase) throw new Error('Supabase not configured');
  const next = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('kanban_cards')
    .update(next)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Card;
}

export async function deleteCard(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_cards').delete().eq('id', id);
  if (error) throw error;
}

// ─── Storage helpers ─────────────────────────────────────────────────────

export async function uploadFile(
  userId: string,
  cardId: string,
  file: File
): Promise<{ path: string; size: number }> {
  if (!supabase) throw new Error('Supabase not configured');
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${userId}/${cardId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, size: file.size };
}

export async function signedUrl(path: string, expiresSec = 3600): Promise<string> {
  if (!supabase) return '';
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeStorageObject(path: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
