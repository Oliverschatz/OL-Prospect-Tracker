import { supabase } from './supabase';
import type {
  Card, Panel, ProjectDocument, DocumentKind, Worker, Project, ProjectMember,
} from './kanban-types';
import { DEFAULT_WORKER_COLORS, DEFAULT_PROJECT_NAME } from './kanban-types';

const BUCKET = 'kanban';

// ─── Projects ────────────────────────────────────────────────────────────
// RLS returns every project the current user owns or has been added to as a
// member, so a plain select is already scoped correctly.

export async function listProjects(userId: string): Promise<Project[]> {
  if (!supabase) return [];
  // Pick up any pending invitations addressed to this account first, so the
  // shared projects show up in the same load.
  await claimInvites();

  const { data, error } = await supabase
    .from('kanban_projects')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Brand-new board: seed the first project with the canonical name.
  if (!data || data.length === 0) {
    const seeded = await createProject(userId, DEFAULT_PROJECT_NAME);
    return [seeded];
  }
  return data as Project[];
}

export async function createProject(userId: string, name: string): Promise<Project> {
  if (!supabase) throw new Error('Supabase not configured');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name is required');

  const { data, error } = await supabase
    .from('kanban_projects')
    .insert({ owner_id: userId, name: trimmed })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error(`A project named "${trimmed}" already exists`);
    }
    throw error;
  }
  const project = data as Project;

  // Record the owner as a member and seed the default worker.
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('kanban_project_members').insert({
    project_id: project.id, user_id: userId, email: (user?.email ?? '').toLowerCase(),
    role: 'owner', invited_by: userId, accepted_at: new Date().toISOString(),
  });
  await createWorker(project.id, 'Oliver');
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project> {
  if (!supabase) throw new Error('Supabase not configured');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name is required');
  const { data, error } = await supabase
    .from('kanban_projects').update({ name: trimmed }).eq('id', id).select().single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error(`A project named "${trimmed}" already exists`);
    }
    throw error;
  }
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_projects').delete().eq('id', id);
  if (error) throw error;
}

// Set (or clear, with null) the WIP column card limit. Owner-only via RLS.
export async function setWipLimit(id: string, limit: number | null): Promise<Project> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('kanban_projects').update({ wip_limit: limit }).eq('id', id).select().single();
  if (error) throw error;
  return data as Project;
}

// ─── Project members (invitations) ─────────────────────────────────────────

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ProjectMember[];
}

export async function inviteMember(
  projectId: string, email: string, invitedBy: string, workerName = ''
): Promise<ProjectMember> {
  if (!supabase) throw new Error('Supabase not configured');
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Please enter a valid email address');
  }
  const { data, error } = await supabase
    .from('kanban_project_members')
    .insert({ project_id: projectId, email: trimmed, worker_name: workerName.trim(), role: 'member', invited_by: invitedBy })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new Error(`${trimmed} has already been invited to this project`);
    }
    throw error;
  }
  return data as ProjectMember;
}

// The current user's membership row for a project (matched by account or the
// email the invitation was addressed to). Used to default "Acting as".
export async function getMyMember(projectId: string): Promise<ProjectMember | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const email = (user.email ?? '').toLowerCase();
  const { data, error } = await supabase
    .from('kanban_project_members')
    .select('*')
    .eq('project_id', projectId)
    .or(`user_id.eq.${user.id}${email ? `,email.eq.${email}` : ''}`)
    .limit(1);
  if (error) throw error;
  return (data && data[0]) ? (data[0] as ProjectMember) : null;
}

// Link (or unlink) an existing member to a worker chip after the fact.
// Owner-only via RLS (see kanban-member-owner-update.sql).
export async function setMemberWorker(id: string, workerName: string): Promise<ProjectMember> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('kanban_project_members')
    .update({ worker_name: workerName.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectMember;
}

export async function removeMember(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_project_members').delete().eq('id', id);
  if (error) throw error;
}

// Send the invitation notification email (best-effort; requires SMTP config).
export async function sendInviteEmail(projectId: string, email: string): Promise<void> {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/kanban/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      projectId, email,
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Failed to send invitation email');
  }
}

// Link any pending invitations addressed to the signed-in user's email to
// their account, so the shared projects become visible. Safe to call repeatedly.
export async function claimInvites(): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return;
  await supabase
    .from('kanban_project_members')
    .update({ user_id: user.id, accepted_at: new Date().toISOString() })
    .is('user_id', null)
    .eq('email', email);
}

// ─── Workers ─────────────────────────────────────────────────────────────

export async function listWorkers(projectId: string): Promise<Worker[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_workers')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Worker[];
}

export async function createWorker(projectId: string, name: string): Promise<Worker> {
  if (!supabase) throw new Error('Supabase not configured');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Worker name is required');

  const { data: existing } = await supabase
    .from('kanban_workers')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length ? (existing[0].sort_order ?? 0) + 1 : 0;
  const color = DEFAULT_WORKER_COLORS[nextOrder % DEFAULT_WORKER_COLORS.length];

  const { data, error } = await supabase
    .from('kanban_workers')
    .insert({ project_id: projectId, name: trimmed, color, sort_order: nextOrder })
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

export async function listCards(projectId: string): Promise<Card[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as Card[];
}

export async function createCard(
  projectId: string,
  partial: Partial<Card> & { title: string }
): Promise<Card> {
  if (!supabase) throw new Error('Supabase not configured');
  const now = new Date().toISOString();
  const row = {
    project_id: projectId,
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
// Objects are namespaced by project id so every project member can read them.

export async function uploadFile(
  projectId: string,
  cardId: string,
  file: File
): Promise<{ path: string; size: number }> {
  if (!supabase) throw new Error('Supabase not configured');
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${projectId}/${cardId}/${Date.now()}_${safeName}`;
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

// ─── Project documents (Internal / External) ────────────────────────────

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('kanban_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ProjectDocument[];
}

export async function createDocument(
  projectId: string, kind: DocumentKind, label: string, url: string
): Promise<ProjectDocument> {
  if (!supabase) throw new Error('Supabase not configured');
  const row = { project_id: projectId, kind, label: label.trim(), url: url.trim(), sort_order: Date.now() };
  const { data, error } = await supabase.from('kanban_documents').insert(row).select().single();
  if (error) throw error;
  return data as ProjectDocument;
}

export async function updateDocument(
  id: string, patch: Partial<Pick<ProjectDocument, 'label' | 'url' | 'kind' | 'sort_order'>>
): Promise<ProjectDocument> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('kanban_documents').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as ProjectDocument;
}

export async function deleteDocument(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('kanban_documents').delete().eq('id', id);
  if (error) throw error;
}
