'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Card, DocumentKind, HistoryEntry, Panel, Project, ProjectDocument, ProjectMember, Worker } from '@/lib/kanban-types';
import { PANELS } from '@/lib/kanban-types';
import {
  createCard, createDocument, createWorker, deleteCard as dbDeleteCard,
  deleteDocument, listCards, listDocuments, listWorkers,
  updateCard, updateDocument,
  listProjects, createProject, renameProject, deleteProject,
  listMembers, inviteMember, removeMember, sendInviteEmail, getMyMember,
} from '@/lib/kanban-db';
import KanbanCardModal from './KanbanCardModal';
import { RichTextView } from './KanbanRichText';
import UrlTransferMenu from './UrlTransferMenu';

type Props = {
  user: User;
  onLogout?: () => void;
};

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function blendColors(hexes: string[]): string {
  if (hexes.length === 0) return '#ffffff';
  let r = 0, g = 0, b = 0;
  for (const h of hexes) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!m) continue;
    r += parseInt(m[1], 16);
    g += parseInt(m[2], 16);
    b += parseInt(m[3], 16);
  }
  const n = hexes.length;
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

function tintBg(hex: string): string {
  // Soft tint by blending with white at ~78%
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '#ffffff';
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c * 0.22 + 255 * 0.78);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export default function KanbanBoard({ user, onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWorker, setCurrentWorker] = useState<string>('Oliver');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ cardId: string; position: 'before' | 'after'; panel: Panel } | null>(null);
  const [showWorkerManager, setShowWorkerManager] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [newCardTitle, setNewCardTitle] = useState('');

  const project = useMemo(
    () => projects.find(p => p.id === projectId) ?? null,
    [projects, projectId]
  );
  const isOwner = project?.owner_id === user.id;

  // Load the list of projects the user can access; select the first one.
  useEffect(() => {
    (async () => {
      try {
        const ps = await listProjects(user.id);
        setProjects(ps);
        setProjectId(prev => (prev && ps.some(p => p.id === prev) ? prev : ps[0]?.id ?? null));
      } catch (e) {
        setError((e as Error).message);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Load the board (workers / cards / documents) for the selected project.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setBoardLoading(true);
    setOpenCardId(null);
    (async () => {
      try {
        const [w, c, d, me] = await Promise.all([
          listWorkers(projectId), listCards(projectId), listDocuments(projectId), getMyMember(projectId),
        ]);
        if (cancelled) return;
        setWorkers(w);
        setCards(c);
        setDocuments(d);
        // Default "Acting as" to the worker this account was invited as, if any.
        const mine = me?.worker_name && w.find(x => x.name === me.worker_name) ? me.worker_name : null;
        setCurrentWorker(cur => mine ?? (w.find(x => x.name === cur) ? cur : (w[0]?.name ?? 'Oliver')));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
      if (!cancelled) setBoardLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const workerByName = useMemo(() => {
    const m = new Map<string, Worker>();
    for (const w of workers) m.set(w.name, w);
    return m;
  }, [workers]);

  const grouped = useMemo(() => {
    const out: Record<Panel, Card[]> = { todo: [], wip: [], review: [], done: [] };
    for (const c of cards) out[c.panel].push(c);
    for (const k of Object.keys(out) as Panel[]) {
      out[k].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    }
    return out;
  }, [cards]);

  const counts = useMemo(() => ({
    total: cards.length,
    todo: grouped.todo.length,
    wip: grouped.wip.length,
    review: grouped.review.length,
    done: grouped.done.length,
  }), [cards.length, grouped]);

  // ─── Project actions ──────────────────────────────────────────────────
  async function handleNewProject() {
    const name = window.prompt('Name for the new project');
    if (!name || !name.trim()) return;
    try {
      const p = await createProject(user.id, name);
      setProjects(curr => [...curr, p]);
      setProjectId(p.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRenameProject() {
    if (!project || !isOwner) return;
    const name = window.prompt('Rename project', project.name);
    if (name === null || !name.trim() || name.trim() === project.name) return;
    try {
      const saved = await renameProject(project.id, name);
      setProjects(curr => curr.map(p => (p.id === saved.id ? saved : p)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeleteProject() {
    if (!project || !isOwner) return;
    if (projects.filter(p => p.owner_id === user.id).length <= 1) {
      setError('You must keep at least one project of your own.');
      return;
    }
    if (!window.confirm(`Delete project "${project.name}" and all its cards, workers and documents? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
      const remaining = projects.filter(p => p.id !== project.id);
      setProjects(remaining);
      setProjectId(remaining[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Invite a worker: record the membership and make sure the matching worker
  // chip exists on the board so the invitee shows up by name.
  async function handleInvite(email: string, workerName: string): Promise<ProjectMember> {
    if (!project) throw new Error('No project selected');
    const m = await inviteMember(project.id, email, user.id, workerName);
    const name = workerName.trim();
    if (name && !workers.some(w => w.name === name)) {
      const w = await createWorker(project.id, name);
      setWorkers(curr => [...curr, w]);
    }
    return m;
  }

  // ─── Card actions ────────────────────────────────────────────────────
  async function handleAddCard() {
    const title = newCardTitle.trim();
    if (!title || !projectId) return;
    try {
      const c = await createCard(projectId, {
        title, panel: 'todo', split_number: 1,
        sort_order: (grouped.todo[grouped.todo.length - 1]?.sort_order ?? 0) + 1,
      });
      setCards(curr => [...curr, c]);
      setNewCardTitle('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSaveCard(next: Card) {
    try {
      const saved = await updateCard(next.id, next);
      setCards(curr => curr.map(c => (c.id === saved.id ? saved : c)));
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }

  async function handleDeleteCard(id: string) {
    if (!window.confirm('Delete this card permanently?')) return;
    try {
      await dbDeleteCard(id);
      setCards(curr => curr.filter(c => c.id !== id));
      setOpenCardId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Move a card to a different panel or reorder within a panel.
  //   • targetSortOrder lets the caller place the card precisely; if
  //     omitted the card is appended to the end of the destination panel.
  //   • Cross-panel moves still apply the worker-assignment rules.
  async function moveCard(cardId: string, toPanel: Panel, targetSortOrder?: number) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const samePanel = card.panel === toPanel;
    if (samePanel && targetSortOrder === undefined) return;

    const now = new Date().toISOString();
    const history: HistoryEntry[] = [...card.history];
    let workers = card.workers.slice();
    if (!samePanel) {
      history.push({ at: now, by: currentWorker, what: `Moved from ${PANELS.find(p => p.id === card.panel)?.label} to ${PANELS.find(p => p.id === toPanel)?.label}` });
      if (card.panel === 'todo' && toPanel !== 'todo') {
        if (!workers.includes(currentWorker)) {
          workers = [...workers, currentWorker];
          history.push({ at: now, by: currentWorker, what: `${currentWorker} assigned` });
        }
      } else if (toPanel === 'todo' && card.panel !== 'todo') {
        if (workers.length) {
          history.push({ at: now, by: currentWorker, what: `Sent back to To do — assignments cleared (${workers.join(', ')})` });
        }
        workers = [];
      } else if (toPanel !== 'todo' && !workers.includes(currentWorker)) {
        workers = [...workers, currentWorker];
        history.push({ at: now, by: currentWorker, what: `${currentWorker} joined` });
      }
    }

    const newSortOrder = targetSortOrder ?? Date.now();
    const patch: Partial<Card> = {
      panel: toPanel,
      workers,
      history,
      sort_order: newSortOrder,
    };
    try {
      const saved = await updateCard(cardId, patch);
      setCards(curr => curr.map(c => (c.id === cardId ? saved : c)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Compute a sort_order that places `draggedId` immediately before/after `targetId`.
  // Uses fractional indexing (midpoint between neighbors); rebalances the column if
  // neighbors collide.
  async function computeDropSortOrder(
    draggedId: string, targetCardId: string, position: 'before' | 'after', toPanel: Panel
  ): Promise<number | null> {
    const panelCards = grouped[toPanel].filter(c => c.id !== draggedId);
    const targetIdx = panelCards.findIndex(c => c.id === targetCardId);
    if (targetIdx === -1) return null;
    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
    const prev = panelCards[insertIdx - 1];
    const next = panelCards[insertIdx];
    const prevSO = prev ? prev.sort_order : 0;
    const nextSO = next ? next.sort_order : (prev ? prev.sort_order + 2_000_000 : Date.now());
    if (next && nextSO - prevSO <= 1) {
      // Neighbors too close — rebalance the whole column with spaced values.
      const reordered = [...panelCards];
      reordered.splice(insertIdx, 0, { id: draggedId } as Card);
      const base = Date.now();
      await Promise.all(reordered.map((c, i) =>
        c.id === draggedId ? Promise.resolve() : updateCard(c.id, { sort_order: base + (i + 1) * 1000 })
      ));
      // Update local state for siblings; the dragged card itself is handled by moveCard.
      setCards(curr => curr.map(c => {
        const idx = reordered.findIndex(r => r.id === c.id);
        return idx === -1 || c.id === draggedId ? c : { ...c, sort_order: base + (idx + 1) * 1000 };
      }));
      const insertPos = reordered.findIndex(r => r.id === draggedId);
      return base + (insertPos + 1) * 1000;
    }
    return Math.floor((prevSO + nextSO) / 2);
  }

  // ─── Split a card: original becomes "1", copy goes to "To do" as next number ──
  async function handleSplit(card: Card) {
    if (!projectId) return;
    try {
      const group = card.split_group ?? uuid();

      // Find current max split_number across siblings (including the source).
      const siblings = cards.filter(c => (c.split_group ?? c.id) === (card.split_group ?? card.id));
      const maxN = siblings.reduce((acc, c) => Math.max(acc, c.split_number), 0);
      const nextN = Math.max(maxN, 1) + 1;

      // 1. Mark original (and any siblings missing group) with split_group.
      if (!card.split_group) {
        const saved = await updateCard(card.id, { split_group: group, split_number: 1 });
        setCards(curr => curr.map(c => (c.id === saved.id ? saved : c)));
      }

      // 2. Create the copy in "To do" — content is copied, files/links re-linked by reference,
      //    history starts fresh with a "split from #N" entry.
      const copy = await createCard(projectId, {
        title: card.title,
        split_group: card.split_group ?? group,
        split_number: nextN,
        explanation: card.explanation,
        body: card.body,
        panel: 'todo',
        sort_order: Date.now(),
        workers: [],
        eco_domain: card.eco_domain,
        eco_task: card.eco_task,
        eco_enabler: card.eco_enabler,
        lit_book: card.lit_book,
        lit_chapter: card.lit_chapter,
        lit_page: card.lit_page,
        links: card.links.map(l => ({ ...l, id: uid() })),
        files: [], // version chains stay with the original; copy starts empty
        history: [{
          at: new Date().toISOString(),
          by: currentWorker,
          what: `Split from "${card.title} #${card.split_number}" by ${currentWorker}`,
        }],
      });
      setCards(curr => [...curr, copy]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ─── Clone a card: independent duplicate in the same column ───────────
  // Unlike Split (which links siblings via split_group/number), a clone is a
  // standalone copy — handy for slicing one task into several by cloning then
  // trimming or deleting parts of each copy.
  async function handleClone(card: Card) {
    if (!projectId) return;
    try {
      const clone = await createCard(projectId, {
        title: card.title,
        split_group: null,
        split_number: 1,
        explanation: card.explanation,
        body: card.body,
        panel: card.panel,
        sort_order: Date.now(),
        workers: card.workers.slice(),
        eco_domain: card.eco_domain,
        eco_task: card.eco_task,
        eco_enabler: card.eco_enabler,
        lit_book: card.lit_book,
        lit_chapter: card.lit_chapter,
        lit_page: card.lit_page,
        links: card.links.map(l => ({ ...l, id: uid() })),
        files: [], // version chains stay with the original; clone starts empty
        history: [{
          at: new Date().toISOString(),
          by: currentWorker,
          what: `Cloned from "${card.title} #${card.split_number}" by ${currentWorker}`,
        }],
      });
      setCards(curr => [...curr, clone]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ─── Workers ─────────────────────────────────────────────────────────
  async function handleAddWorker(name: string) {
    if (!projectId) return;
    const w = await createWorker(projectId, name);
    setWorkers(curr => [...curr, w]);
  }

  // ─── URL transfer helpers (used by card modal & documents panel) ─────
  async function addLinkToCard(targetCardId: string, label: string, url: string) {
    const target = cards.find(c => c.id === targetCardId);
    if (!target) throw new Error('Target card not found');
    const newLink = { id: uid(), label, url };
    const now = new Date().toISOString();
    const patch: Partial<Card> = {
      links: [...target.links, newLink],
      history: [...target.history, { at: now, by: currentWorker, what: `Added link "${label}" (from transfer)` }],
    };
    const saved = await updateCard(targetCardId, patch);
    setCards(curr => curr.map(c => (c.id === targetCardId ? saved : c)));
  }

  async function addLinkToDocs(kind: DocumentKind, label: string, url: string) {
    if (!projectId) return;
    const doc = await createDocument(projectId, kind, label, url);
    setDocuments(curr => [...curr, doc]);
  }

  async function removeDocument(docId: string) {
    await deleteDocument(docId);
    setDocuments(curr => curr.filter(d => d.id !== docId));
  }

  // ─── DnD ─────────────────────────────────────────────────────────────
  function onDragStart(id: string) {
    setDragId(id);
    setDropIndicator(null);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDropPanel(panel: Panel) {
    if (dragId) moveCard(dragId, panel); // appended (no targetSortOrder)
    setDragId(null);
    setDropIndicator(null);
  }

  function onCardDragOver(e: React.DragEvent<HTMLDivElement>, cardId: string, panel: Panel) {
    if (!dragId || dragId === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator(prev =>
      prev && prev.cardId === cardId && prev.position === position && prev.panel === panel
        ? prev
        : { cardId, position, panel }
    );
  }

  async function onCardDrop(e: React.DragEvent<HTMLDivElement>, cardId: string, panel: Panel) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragId || dragId === cardId) {
      setDropIndicator(null);
      setDragId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const target = await computeDropSortOrder(dragId, cardId, position, panel);
    if (target !== null) {
      await moveCard(dragId, panel, target);
    }
    setDropIndicator(null);
    setDragId(null);
  }

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen">Loading kanban…</div>;
  const openCard = boardLoading ? null : (cards.find(c => c.id === openCardId) || null);

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="https://oliverlehmann.com/wp-content/uploads/2023/05/cropped-logo-ol.png"
            alt="Oliver F. Lehmann"
            className="app-logo"
          />
          <h1>Kanban Board <span>— OliverLehmann.com</span></h1>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            <span>Project:</span>
            <select value={projectId ?? ''} onChange={e => setProjectId(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', padding: '4px 8px', maxWidth: 200 }}>
              {projects.map(p => (
                <option key={p.id} value={p.id} style={{ color: '#1a2744' }}>
                  {p.name}{p.owner_id !== user.id ? ' (shared)' : ''}
                </option>
              ))}
            </select>
            <button className="btn-ghost btn-sm" title="New project" onClick={handleNewProject}
              style={{ color: 'white', padding: '2px 8px' }}>+</button>
            {isOwner && (
              <>
                <button className="btn-ghost btn-sm" title="Rename project" onClick={handleRenameProject}
                  style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Rename</button>
                <button className="btn-ghost btn-sm" title="Delete project" onClick={handleDeleteProject}
                  style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Delete</button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            <span>Acting as:</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', padding: '4px 8px' }}>
              {workers.map(w => <option key={w.id} value={w.name} style={{ color: '#1a2744' }}>{w.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => setShowMembers(s => !s)}>Invite</button>
          <button className="btn-secondary btn-sm" onClick={() => setShowDocuments(s => !s)}>Documents ({documents.length})</button>
          <button className="btn-secondary btn-sm" onClick={() => setShowWorkerManager(s => !s)}>Workers ({workers.length})</button>
          {onLogout && <button className="btn-ghost btn-sm" onClick={onLogout} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Logout</button>}
        </div>
      </div>

      {/* Overview bar */}
      <div style={{ padding: '12px 24px', background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 14, fontWeight: 700, color: 'var(--pbf-navy)' }}>
          Total: <span style={{ color: 'var(--pbf-blue)' }}>{counts.total}</span>
        </div>
        {PANELS.map(p => (
          <div key={p.id} style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--pbf-muted)' }}>{p.label}:</span>{' '}
            <strong>{counts[p.id]}</strong>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={newCardTitle}
            onChange={e => setNewCardTitle(e.target.value)}
            placeholder="New card title"
            onKeyDown={e => { if (e.key === 'Enter') handleAddCard(); }}
            style={{ width: 240 }}
          />
          <button className="btn-primary btn-sm" onClick={handleAddCard}>+ Add card</button>
        </div>
      </div>

      {showMembers && project && (
        <MembersPanel
          project={project}
          isOwner={isOwner}
          workers={workers}
          onInvite={handleInvite}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showWorkerManager && projectId && (
        <WorkerManager
          workers={workers} projectId={projectId}
          onClose={() => setShowWorkerManager(false)}
          onChange={(next) => setWorkers(next)}
        />
      )}

      {showDocuments && projectId && (
        <DocumentsPanel
          documents={documents}
          allCards={cards}
          projectId={projectId}
          onClose={() => setShowDocuments(false)}
          onChange={setDocuments}
          onAddLinkToCard={addLinkToCard}
          onAddLinkToDocs={addLinkToDocs}
          onRemoveDocument={removeDocument}
        />
      )}

      {error && (
        <div style={{ background: 'var(--pbf-red-bg)', color: 'var(--pbf-red)', padding: '8px 24px', fontSize: 13 }}>
          {error} <button className="btn-ghost btn-sm" onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      {/* Columns */}
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: 12, alignItems: 'start' }}>
        {PANELS.map(p => (
          <div
            key={p.id}
            onDragOver={onDragOver}
            onDrop={() => onDropPanel(p.id)}
            style={{
              background: 'var(--pbf-light)',
              border: '1px solid var(--pbf-border)',
              borderRadius: 6,
              padding: 8,
              minHeight: 200,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 8px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--pbf-navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</div>
              <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>{counts[p.id]}</div>
            </div>

            {grouped[p.id].map(card => {
              const cardColors = card.workers
                .map(n => workerByName.get(n)?.color)
                .filter(Boolean) as string[];
              const accent = cardColors.length ? blendColors(cardColors) : '#cbd5e0';
              const bg = cardColors.length ? tintBg(cardColors[0]) : 'var(--pbf-white)';

              const showBefore = dropIndicator?.cardId === card.id && dropIndicator.position === 'before' && dropIndicator.panel === p.id;
              const showAfter  = dropIndicator?.cardId === card.id && dropIndicator.position === 'after'  && dropIndicator.panel === p.id;
              const indicatorStyle: React.CSSProperties = {
                height: 3, background: 'var(--pbf-accent)', borderRadius: 2, margin: '4px 0',
              };
              return (
                <div key={card.id}>
                  {showBefore && <div style={indicatorStyle} />}
                  <div
                    draggable
                    onDragStart={() => onDragStart(card.id)}
                    onDragOver={(e) => onCardDragOver(e, card.id, p.id)}
                    onDrop={(e) => onCardDrop(e, card.id, p.id)}
                    onClick={() => setOpenCardId(card.id)}
                    style={{
                      background: bg,
                      borderLeft: `4px solid ${accent}`,
                      border: '1px solid var(--pbf-border)',
                      borderLeftWidth: 4,
                      borderLeftColor: accent,
                      borderRadius: 4,
                      padding: '8px 10px',
                      marginBottom: 8,
                      cursor: 'grab',
                      boxShadow: 'var(--shadow)',
                      opacity: dragId === card.id ? 0.4 : 1,
                    }}
                  >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {card.title || 'Untitled'} <span style={{ color: 'var(--pbf-muted)', fontWeight: 400 }}>#{card.split_number}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        className="btn-ghost btn-sm"
                        title="Clone card (independent copy)"
                        onClick={e => { e.stopPropagation(); handleClone(card); }}
                        style={{ padding: '0 6px' }}
                      >⧉</button>
                      <button
                        className="btn-ghost btn-sm"
                        title="Split card (linked sibling in To do)"
                        onClick={e => { e.stopPropagation(); handleSplit(card); }}
                        style={{ padding: '0 6px' }}
                      >⎘</button>
                    </div>
                  </div>
                  {card.explanation && (
                    <div style={{ fontSize: 12, color: 'var(--pbf-muted)', marginTop: 2 }}>
                      {card.explanation.length > 100 ? card.explanation.slice(0, 100) + '…' : card.explanation}
                    </div>
                  )}
                  {card.workers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {card.workers.map(name => {
                        const w = workerByName.get(name);
                        return (
                          <span key={name}
                            style={{
                              background: w?.color ?? '#cbd5e0',
                              color: '#1a2744',
                              borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                            }}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--pbf-muted)' }}>
                    {card.files.length > 0 && <span>📎 {card.files.length}</span>}
                    {card.links.length > 0 && <span>🔗 {card.links.length}</span>}
                    {card.history.length > 0 && <span>🕒 {new Date(card.history[card.history.length - 1].at).toLocaleDateString()}</span>}
                  </div>
                  </div>
                  {showAfter && <div style={indicatorStyle} />}
                </div>
              );
            })}

            {grouped[p.id].length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--pbf-muted)', fontSize: 12, padding: 20 }}>
                Drop cards here
              </div>
            )}
          </div>
        ))}
      </div>

      {openCard && (
        <KanbanCardModal
          card={openCard}
          workers={workers}
          allCards={cards}
          currentWorker={currentWorker}
          onSetCurrentWorker={setCurrentWorker}
          onAddWorker={handleAddWorker}
          onClose={() => setOpenCardId(null)}
          onSave={handleSaveCard}
          onDelete={() => handleDeleteCard(openCard.id)}
          onAddLinkToCard={addLinkToCard}
          onAddLinkToDocs={addLinkToDocs}
        />
      )}
    </div>
  );
}

// ─── Worker manager popover ─────────────────────────────────────────────

function WorkerManager({
  workers, projectId, onClose, onChange,
}: {
  workers: Worker[];
  projectId: string;
  onClose: () => void;
  onChange: (next: Worker[]) => void;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  async function add() {
    setErr('');
    try {
      const w = await createWorker(projectId, name);
      onChange([...workers, w]);
      setName('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div style={{ padding: '12px 24px', background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Workers</strong>
        <button className="btn-ghost btn-sm" onClick={onClose}>close</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {workers.map(w => (
          <span key={w.id} style={{
            background: w.color, color: '#1a2744',
            borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
          }}>{w.name}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, maxWidth: 360 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Add worker (first name)"
          onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button className="btn-primary btn-sm" onClick={add}>Add</button>
      </div>
      {err && <p style={{ color: 'var(--pbf-red)', fontSize: 12, marginTop: 6 }}>{err}</p>}
      <p style={{ fontSize: 11, color: 'var(--pbf-muted)', marginTop: 6 }}>
        First names only. Email notifications can be added later.
      </p>
    </div>
  );
}

// ─── Project documents panel ────────────────────────────────────────────

function DocumentsPanel({
  documents, allCards, projectId, onClose, onChange,
  onAddLinkToCard, onAddLinkToDocs, onRemoveDocument,
}: {
  documents: ProjectDocument[];
  allCards: Card[];
  projectId: string;
  onClose: () => void;
  onChange: (next: ProjectDocument[]) => void;
  onAddLinkToCard: (cardId: string, label: string, url: string) => Promise<void>;
  onAddLinkToDocs: (kind: DocumentKind, label: string, url: string) => Promise<void>;
  onRemoveDocument: (id: string) => Promise<void>;
}) {
  const [err, setErr] = useState('');
  const internal = documents.filter(d => d.kind === 'internal');
  const external = documents.filter(d => d.kind === 'external');

  async function transferDoc(doc: ProjectDocument, mode: 'move' | 'copy', target: { kind: 'doc'; docKind: DocumentKind } | { kind: 'card'; cardId: string }) {
    setErr('');
    try {
      if (target.kind === 'doc') {
        await onAddLinkToDocs(target.docKind, doc.label, doc.url);
      } else {
        await onAddLinkToCard(target.cardId, doc.label, doc.url);
      }
      if (mode === 'move') {
        await onRemoveDocument(doc.id);
        onChange(documents.filter(d => d.id !== doc.id));
      }
    } catch (e) {
      setErr((e as Error).message);
      throw e;
    }
  }

  async function add(kind: DocumentKind) {
    const label = window.prompt(`Label for the new ${kind} document`);
    if (!label || !label.trim()) return;
    const url = window.prompt(`URL (https://…)`);
    if (!url || !url.trim()) return;
    if (!/^(https?:|mailto:|tel:)/i.test(url.trim())) {
      setErr('URL must start with http://, https://, mailto: or tel:');
      return;
    }
    try {
      const doc = await createDocument(projectId, kind, label, url);
      onChange([...documents, doc]);
      setErr('');
    } catch (e) { setErr((e as Error).message); }
  }

  async function edit(doc: ProjectDocument) {
    const label = window.prompt('Label', doc.label);
    if (label === null) return;
    const url = window.prompt('URL', doc.url);
    if (url === null) return;
    try {
      const saved = await updateDocument(doc.id, { label: label.trim(), url: url.trim() });
      onChange(documents.map(d => (d.id === doc.id ? saved : d)));
      setErr('');
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove(doc: ProjectDocument) {
    if (!window.confirm(`Delete "${doc.label}"?`)) return;
    try {
      await deleteDocument(doc.id);
      onChange(documents.filter(d => d.id !== doc.id));
      setErr('');
    } catch (e) { setErr((e as Error).message); }
  }

  function List({ kind, items }: { kind: DocumentKind; items: ProjectDocument[] }) {
    return (
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <strong style={{ fontSize: 13, textTransform: 'capitalize' }}>{kind} documents</strong>
          <button className="btn-ghost btn-sm" onClick={() => add(kind)}>+ Add</button>
        </div>
        {items.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>None yet.</div>
        )}
        {items.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>{d.label}</a>
            <UrlTransferMenu
              label={d.label}
              url={d.url}
              source={{ kind: 'doc', docKind: d.kind }}
              cards={allCards}
              onMove={(t) => transferDoc(d, 'move', t)}
              onCopy={(t) => transferDoc(d, 'copy', t)}
            />
            <button className="btn-ghost btn-sm" type="button" onClick={() => edit(d)}>Edit</button>
            <button className="btn-danger btn-sm" type="button" onClick={() => remove(d)}>Delete</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 24px', background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Project documents</strong>
        <button className="btn-ghost btn-sm" onClick={onClose}>close</button>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <List kind="internal" items={internal} />
        <List kind="external" items={external} />
      </div>
      {err && <p style={{ color: 'var(--pbf-red)', fontSize: 12, marginTop: 6 }}>{err}</p>}
    </div>
  );
}

// ─── Members / invitations panel ────────────────────────────────────────

function MembersPanel({
  project, isOwner, workers, onInvite, onClose,
}: {
  project: Project;
  isOwner: boolean;
  workers: Worker[];
  onInvite: (email: string, workerName: string) => Promise<ProjectMember>;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [email, setEmail] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    (async () => {
      try { setMembers(await listMembers(project.id)); }
      catch (e) { setErr((e as Error).message); }
      setLoading(false);
    })();
  }, [project.id]);

  async function invite() {
    setErr(''); setInfo('');
    setBusy(true);
    try {
      const m = await onInvite(email, workerName);
      setMembers(curr => [...curr, m]);
      setEmail('');
      setWorkerName('');
      const asName = m.worker_name ? ` as worker "${m.worker_name}"` : '';
      // The invitation row is saved either way; the notification email is
      // best-effort (it needs SMTP configured).
      try {
        await sendInviteEmail(project.id, m.email);
        setInfo(`Invited ${m.email}${asName} — a notification email is on its way. They'll see this project once they log in with that address.`);
      } catch (mailErr) {
        setInfo(`Invited ${m.email}${asName}. They'll see this project once they log in with that address, but the notification email could not be sent (${(mailErr as Error).message}).`);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(m: ProjectMember) {
    if (m.role === 'owner') return;
    if (!window.confirm(`Remove ${m.email} from "${project.name}"?`)) return;
    try {
      await removeMember(m.id);
      setMembers(curr => curr.filter(x => x.id !== m.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div style={{ padding: '12px 24px', background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Team members — {project.name}</strong>
        <button className="btn-ghost btn-sm" onClick={onClose}>close</button>
      </div>

      {isOwner ? (
        <>
          <div style={{ display: 'flex', gap: 6, maxWidth: 560, marginBottom: 4, flexWrap: 'wrap' }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="worker@example.com"
              onKeyDown={e => { if (e.key === 'Enter' && !busy) invite(); }} style={{ flex: 2, minWidth: 200 }} />
            <input list="kanban-worker-names" value={workerName} onChange={e => setWorkerName(e.target.value)}
              placeholder="Worker name (e.g. Anna)"
              onKeyDown={e => { if (e.key === 'Enter' && !busy) invite(); }} style={{ flex: 1, minWidth: 140 }} />
            <datalist id="kanban-worker-names">
              {workers.map(w => <option key={w.id} value={w.name} />)}
            </datalist>
            <button className="btn-primary btn-sm" onClick={invite} disabled={busy}>Invite worker</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--pbf-muted)', marginBottom: 8 }}>
            The worker name links this person to a card chip; they&apos;ll act as it by default. New names create a new worker.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 8 }}>
          This project is shared with you. Only the owner can invite or remove members.
        </p>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>Loading members…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 480 }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>
                {m.email || '(owner)'}
                {m.worker_name && (
                  <span style={{ color: 'var(--pbf-muted)' }}> · worker “{m.worker_name}”</span>
                )}
                {m.role === 'owner' && <span style={{ color: 'var(--pbf-muted)' }}> — owner</span>}
                {m.role !== 'owner' && (
                  <span style={{ color: 'var(--pbf-muted)' }}>
                    {' '}— {m.accepted_at ? 'joined' : 'invited (pending)'}
                  </span>
                )}
              </span>
              {isOwner && m.role !== 'owner' && (
                <button className="btn-danger btn-sm" onClick={() => remove(m)}>Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {info && <p style={{ color: 'var(--pbf-green)', fontSize: 12, marginTop: 6 }}>{info}</p>}
      {err && <p style={{ color: 'var(--pbf-red)', fontSize: 12, marginTop: 6 }}>{err}</p>}
      <p style={{ fontSize: 11, color: 'var(--pbf-muted)', marginTop: 6 }}>
        Invited workers can view and edit this project's cards once they sign in with the invited email.
      </p>
    </div>
  );
}

// Hint to silence the unused-import linter if RichTextView isn't used directly here.
void RichTextView;
