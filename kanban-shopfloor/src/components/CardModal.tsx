import { useEffect, useState } from 'react';
import { Assignee, Board, Card, CardType, ObsNode, ThreePoint } from '../types';
import {
  assigneeLabel, childrenOf, liveStories, storyById, subtasksOf, uid,
} from '../lib/board';
import { pertExpected, pertStdDev, tshirtScaleFor } from '../lib/estimate';
import { cardWarnings } from '../lib/dates';
import {
  addStory, addSubtask, cloneCard, deleteCard, patchCard, setAssignees,
  setConstraintNote, splitCard, toggleConstraint, updateStory,
} from '../lib/mutations';

const EMPTY_TRI: ThreePoint = { o: 0, m: 0, p: 0 };
const CARD_TYPES: CardType[] = ['task', 'story', 'bug'];
const DIMENSIONS: { key: 'time' | 'workload' | 'cost'; label: string }[] = [
  { key: 'time', label: 'Time' }, { key: 'workload', label: 'Workload' }, { key: 'cost', label: 'Cost' },
];

const dateValue = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
const num = (v: string) => (v === '' ? 0 : Number(v));
const round = (n: number) => Math.round(n * 100) / 100;

export default function CardModal({
  board, card, actor, apply, onClose, onOpenCard,
}: {
  board: Board;
  card: Card;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
  onClose: () => void;
  onOpenCard: (id: string) => void;
}) {
  const [newSub, setNewSub] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const method = board.settings.estimate_method;
  const est = card.estimate ?? {};
  const story = storyById(board, card.story_id);
  const stories = liveStories(board);
  const subs = subtasksOf(board, card.id);
  const warns = cardWarnings(card);

  const set = (patch: Partial<Card>) => apply(b => patchCard(b, card.id, patch, actor));
  const setEst = (p: Partial<typeof est>) => set({ estimate: { ...est, ...p } });
  const setTri = (dim: 'time' | 'workload' | 'cost', key: keyof ThreePoint, v: number) =>
    setEst({ [dim]: { ...(est[dim] ?? EMPTY_TRI), [key]: v } });

  const toggleAssignee = (a: Assignee) => {
    const next = card.assignees.includes(a) ? card.assignees.filter(x => x !== a) : [...card.assignees, a];
    apply(b => setAssignees(b, card.id, next, actor));
  };

  const onStorySelect = (value: string) => {
    if (value === '__new__') {
      apply(b => {
        const r = addStory(b, actor, { title: 'New story' });
        return patchCard(r.board, card.id, { story_id: r.id }, actor);
      });
    } else {
      set({ story_id: value || null });
    }
  };

  // Render the OBS as an indented checkbox tree for assignment.
  const renderObs = (parentId: string | null, depth: number): JSX.Element[] =>
    childrenOf(board, parentId).flatMap((n: ObsNode) => [
      <label className="chk obs-pick" key={n.id} style={{ paddingLeft: depth * 16 }}>
        <input type="checkbox" checked={card.assignees.includes(n.id)} onChange={() => toggleAssignee(n.id)} />
        <span className={`obs-kind k-${n.kind}`}>{n.kind === 'organization' ? '▣' : n.kind === 'unit' ? '▤' : '•'}</span>
        {n.name || '(unnamed)'}
      </label>,
      ...renderObs(n.id, depth + 1),
    ]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <select className="type-select" value={card.type} onChange={e => set({ type: e.target.value as CardType })}>
            {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="title-input" value={card.title} onChange={e => set({ title: e.target.value })} />
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {warns.length > 0 && <div className="note note-danger">{warns.map(w => <div key={w.kind}>⚠ {w.message}</div>)}</div>}

          {/* User story (shared across cards) */}
          <div className="field">
            <label>User story</label>
            <select value={card.story_id ?? ''} onChange={e => onStorySelect(e.target.value)}>
              <option value="">— none —</option>
              {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              <option value="__new__">+ New story…</option>
            </select>
            {story && (
              <div className="story-box">
                <input className="story-title" value={story.title} onChange={e => apply(b => updateStory(b, story.id, { title: e.target.value }, actor))} placeholder="Story title" />
                <div className="story-grid">
                  <input placeholder="As a … (role)" value={story.role} onChange={e => apply(b => updateStory(b, story.id, { role: e.target.value }, actor))} />
                  <input placeholder="I want … (goal)" value={story.goal} onChange={e => apply(b => updateStory(b, story.id, { goal: e.target.value }, actor))} />
                  <input placeholder="so that … (benefit)" value={story.benefit} onChange={e => apply(b => updateStory(b, story.id, { benefit: e.target.value }, actor))} />
                </div>
                <div className="muted small">Shared by {board.cards.filter(c => !c.deleted && c.story_id === story.id).length} card(s).</div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={card.body} onChange={e => set({ body: e.target.value })} />
          </div>

          {/* Estimate */}
          <div className="field">
            <label>Estimate · {method}</label>
            {method === 'points' && (
              <input type="number" min={0} style={{ width: 120 }} value={est.points ?? ''} onChange={e => setEst({ points: e.target.value === '' ? null : num(e.target.value) })} />
            )}
            {(method === 'tshirt5' || method === 'tshirt7') && (
              <div className="seg">
                {tshirtScaleFor(method).map(s => (
                  <button key={s} className={`seg-btn${est.size === s ? ' active' : ''}`} onClick={() => setEst({ size: est.size === s ? null : s })}>{s}</button>
                ))}
              </div>
            )}
            {method === 'three_point' && (
              <table className="tri">
                <thead><tr><th></th><th>O</th><th>M</th><th>P</th><th>Expected</th></tr></thead>
                <tbody>
                  {DIMENSIONS.map(d => {
                    const tri = est[d.key] ?? null;
                    return (
                      <tr key={d.key}>
                        <td>{d.label}</td>
                        {(['o', 'm', 'p'] as const).map(k => (
                          <td key={k}><input type="number" min={0} value={tri ? tri[k] : ''} onChange={e => setTri(d.key, k, num(e.target.value))} /></td>
                        ))}
                        <td className="tri-exp">{tri ? `${round(pertExpected(tri))} ±${round(pertStdDev(tri))}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Dual dates */}
          <div className="field-2">
            <div className="field"><label>Milestone (planned)</label><input type="date" value={dateValue(card.milestone)} onChange={e => set({ milestone: e.target.value || null })} /></div>
            <div className="field"><label>Deadline (latest)</label><input type="date" value={dateValue(card.deadline)} onChange={e => set({ deadline: e.target.value || null })} /></div>
          </div>

          {/* Assignees (OBS) */}
          <div className="field">
            <label>Assigned to (OBS) — individual = own work · unit/org = delegated / procured</label>
            <div className="obs-tree">{renderObs(null, 0)}</div>
          </div>

          {/* Constraints */}
          <div className="field">
            <label>Constraints</label>
            {board.settings.constraints.map(def => {
              const active = card.constraints.find(x => x.id === def.id);
              return (
                <div className="constraint-row" key={def.id}>
                  <label className="chk">
                    <input type="checkbox" checked={!!active} onChange={() => apply(b => toggleConstraint(b, card.id, def.id, actor))} />
                    {def.label}
                  </label>
                  {active && (
                    <input className="constraint-note" placeholder="Explanation…" value={active.note}
                      onChange={e => apply(b => setConstraintNote(b, card.id, def.id, e.target.value, actor))} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Links */}
          <div className="field">
            <label>Links</label>
            {card.links.map(link => (
              <div className="link-row" key={link.id}>
                <input className="link-label" placeholder="Label" value={link.label} onChange={e => set({ links: card.links.map(l => (l.id === link.id ? { ...l, label: e.target.value } : l)) })} />
                <input placeholder="https://…" value={link.url} onChange={e => set({ links: card.links.map(l => (l.id === link.id ? { ...l, url: e.target.value } : l)) })} />
                <button className="icon-btn danger" aria-label="Remove link" onClick={() => set({ links: card.links.filter(l => l.id !== link.id) })}>✕</button>
              </div>
            ))}
            <button className="linklike" onClick={() => set({ links: [...card.links, { id: uid(), label: '', url: '' }] })}>+ Add link</button>
          </div>

          {/* Subtasks (decomposition) */}
          <div className="field">
            <label>Subtasks ({subs.length})</label>
            {subs.map(s => (
              <div className="sub-row" key={s.id} onClick={() => onOpenCard(s.id)}>
                <span className="sub-col">{board.settings.columns.find(c => c.id === s.column)?.label ?? s.column}</span>
                <span className="sub-title">{s.title}</span>
              </div>
            ))}
            <div className="link-row">
              <input placeholder="New subtask…" value={newSub} onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) { apply(b => addSubtask(b, card.id, newSub, actor)); setNewSub(''); } }} />
              <button className="btn btn-secondary btn-sm" onClick={() => { if (newSub.trim()) { apply(b => addSubtask(b, card.id, newSub, actor)); setNewSub(''); } }}>Add</button>
            </div>
          </div>

          {card.events.length > 0 && (
            <details className="history">
              <summary>Flow history ({card.events.length})</summary>
              <ul>
                {[...card.events].slice(-8).reverse().map(e => (
                  <li key={e.id}><span className="ev-type">{e.type}</span>{e.from && e.to ? ` ${e.from} → ${e.to}` : ''}<span className="muted"> · {new Date(e.at).toLocaleString()}</span></li>
                ))}
              </ul>
            </details>
          )}
          {card.assignees.length > 0 && (
            <p className="muted small">Assigned: {card.assignees.map(a => assigneeLabel(board, a)).join(', ')}</p>
          )}
          {card.parent_id && <p className="muted small">Subtask of: {board.cards.find(c => c.id === card.parent_id)?.title ?? '—'}</p>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-secondary btn-sm" onClick={() => apply(b => splitCard(b, card.id, actor))}>Split</button>
          <button className="btn btn-secondary btn-sm" onClick={() => apply(b => cloneCard(b, card.id, actor))}>Clone</button>
          <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Delete this card?')) { apply(b => deleteCard(b, card.id, actor)); onClose(); } }}>Delete</button>
          <span className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
