'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Card, HistoryEntry, Panel, Worker } from '@/lib/kanban-types';
import { PANELS } from '@/lib/kanban-types';
import {
  createCard, createWorker, deleteCard as dbDeleteCard,
  listCards, listWorkers, updateCard,
} from '@/lib/kanban-db';
import KanbanCardModal from './KanbanCardModal';
import { RichTextView } from './KanbanRichText';

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
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentWorker, setCurrentWorker] = useState<string>('Oliver');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showWorkerManager, setShowWorkerManager] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [w, c] = await Promise.all([listWorkers(user.id), listCards(user.id)]);
        setWorkers(w);
        setCards(c);
        if (w.length && !w.find(x => x.name === currentWorker)) {
          setCurrentWorker(w[0].name);
        }
      } catch (e) {
        setError((e as Error).message);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

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

  // ─── Card actions ────────────────────────────────────────────────────
  async function handleAddCard() {
    const title = newCardTitle.trim();
    if (!title) return;
    try {
      const c = await createCard(user.id, {
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

  // Move a card to a different panel. Records assignment per the spec:
  //   • leaving "todo" by a worker = current worker is assigned (if not already)
  //   • returning to "todo"        = clear assignments
  async function moveCard(cardId: string, toPanel: Panel) {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.panel === toPanel) return;

    const now = new Date().toISOString();
    const history: HistoryEntry[] = [...card.history,
      { at: now, by: currentWorker, what: `Moved from ${PANELS.find(p => p.id === card.panel)?.label} to ${PANELS.find(p => p.id === toPanel)?.label}` }];

    let workers = card.workers.slice();
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
      // Joining an already-active card from one non-todo panel to another.
      workers = [...workers, currentWorker];
      history.push({ at: now, by: currentWorker, what: `${currentWorker} joined` });
    }

    const patch: Partial<Card> = {
      panel: toPanel,
      workers,
      history,
      sort_order: Date.now(),
    };
    try {
      const saved = await updateCard(cardId, patch);
      setCards(curr => curr.map(c => (c.id === cardId ? saved : c)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ─── Split a card: original becomes "1", copy goes to "To do" as next number ──
  async function handleSplit(card: Card) {
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
      const copy = await createCard(user.id, {
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

  // ─── Workers ─────────────────────────────────────────────────────────
  async function handleAddWorker(name: string) {
    const w = await createWorker(user.id, name);
    setWorkers(curr => [...curr, w]);
  }

  // ─── DnD ─────────────────────────────────────────────────────────────
  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(panel: Panel) {
    if (dragId) moveCard(dragId, panel);
    setDragId(null);
  }

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen">Loading kanban…</div>;
  const openCard = cards.find(c => c.id === openCardId) || null;

  return (
    <div>
      <div className="app-header">
        <h1>Kanban Board <span>— OliverLehmann.com</span></h1>
        <div className="header-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            <span>Acting as:</span>
            <select value={currentWorker} onChange={e => setCurrentWorker(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', padding: '4px 8px' }}>
              {workers.map(w => <option key={w.id} value={w.name} style={{ color: '#1a2744' }}>{w.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => setShowWorkerManager(s => !s)}>Workers</button>
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

      {showWorkerManager && (
        <WorkerManager
          workers={workers} userId={user.id}
          onClose={() => setShowWorkerManager(false)}
          onChange={(next) => setWorkers(next)}
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
            onDrop={() => onDrop(p.id)}
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

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => onDragStart(card.id)}
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
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {card.title || 'Untitled'} <span style={{ color: 'var(--pbf-muted)', fontWeight: 400 }}>#{card.split_number}</span>
                    </div>
                    <button
                      className="btn-ghost btn-sm"
                      title="Split card"
                      onClick={e => { e.stopPropagation(); handleSplit(card); }}
                      style={{ padding: '0 6px' }}
                    >⎘</button>
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
          userId={user.id}
          currentWorker={currentWorker}
          onSetCurrentWorker={setCurrentWorker}
          onAddWorker={handleAddWorker}
          onClose={() => setOpenCardId(null)}
          onSave={handleSaveCard}
          onDelete={() => handleDeleteCard(openCard.id)}
        />
      )}
    </div>
  );
}

// ─── Worker manager popover ─────────────────────────────────────────────

function WorkerManager({
  workers, userId, onClose, onChange,
}: {
  workers: Worker[];
  userId: string;
  onClose: () => void;
  onChange: (next: Worker[]) => void;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  async function add() {
    setErr('');
    try {
      const w = await createWorker(userId, name);
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

// Hint to silence the unused-import linter if RichTextView isn't used directly here.
void RichTextView;
