import { useEffect } from 'react';
import {
  ANON_PREFIX, Assignee, Board, Card, CardType, Story, ThreePoint,
} from '../types';
import { liveCards, organizations, resources, uid } from '../lib/board';
import { pertExpected, pertStdDev, tshirtScaleFor } from '../lib/estimate';
import { cardWarnings } from '../lib/dates';
import { cloneCard, deleteCard, patchCard, setAssignees, splitCard } from '../lib/mutations';
import { pillClass } from './ObsLegend';

const EMPTY_STORY: Story = { role: '', goal: '', benefit: '', acceptance: [] };
const EMPTY_TRI: ThreePoint = { o: 0, m: 0, p: 0 };
const CARD_TYPES: CardType[] = ['task', 'story', 'bug'];
const DIMENSIONS: { key: 'time' | 'workload' | 'cost'; label: string }[] = [
  { key: 'time', label: 'Time' },
  { key: 'workload', label: 'Workload' },
  { key: 'cost', label: 'Cost' },
];

function dateValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}
function num(v: string): number {
  return v === '' ? 0 : Number(v);
}

export default function CardModal({
  board, card, actor, apply, onClose,
}: {
  board: Board;
  card: Card;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const method = board.settings.estimate_method;
  const story = card.story ?? EMPTY_STORY;
  const est = card.estimate ?? {};
  const orgs = organizations(board);
  const res = resources(board);
  const siblings = card.split_group
    ? liveCards(board).filter(c => c.split_group === card.split_group && c.id !== card.id)
    : [];
  const warns = cardWarnings(card);

  const set = (patch: Partial<Card>) => apply(b => patchCard(b, card.id, patch, actor));
  const setStory = (p: Partial<Story>) => set({ story: { ...story, ...p } });
  const setEst = (p: Partial<typeof est>) => set({ estimate: { ...est, ...p } });
  const setTri = (dim: 'time' | 'workload' | 'cost', key: keyof ThreePoint, v: number) =>
    setEst({ [dim]: { ...(est[dim] ?? EMPTY_TRI), [key]: v } });

  const toggleAssignee = (a: Assignee) => {
    const next = card.assignees.includes(a)
      ? card.assignees.filter(x => x !== a)
      : [...card.assignees, a];
    apply(b => setAssignees(b, card.id, next, actor));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <select className="type-select" value={card.type} onChange={e => set({ type: e.target.value as CardType })}>
            {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className="title-input"
            value={card.title}
            onChange={e => set({ title: e.target.value })}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {warns.length > 0 && (
            <div className="note note-danger">
              {warns.map(w => <div key={w.kind}>⚠ {w.message}</div>)}
            </div>
          )}

          {/* User story */}
          <div className="field">
            <label>User story</label>
            <div className="story-grid">
              <input placeholder="As a … (role)" value={story.role} onChange={e => setStory({ role: e.target.value })} />
              <input placeholder="I want … (goal)" value={story.goal} onChange={e => setStory({ goal: e.target.value })} />
              <input placeholder="so that … (benefit)" value={story.benefit} onChange={e => setStory({ benefit: e.target.value })} />
            </div>
          </div>

          {/* Acceptance criteria */}
          <div className="field">
            <label>Acceptance criteria</label>
            {story.acceptance.map((a, i) => (
              <div className="link-row" key={i}>
                <input
                  value={a}
                  onChange={e => setStory({ acceptance: story.acceptance.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <button className="icon-btn danger" aria-label="Remove" onClick={() => setStory({ acceptance: story.acceptance.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="linklike" onClick={() => setStory({ acceptance: [...story.acceptance, ''] })}>+ Add criterion</button>
          </div>

          {/* Notes / body */}
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={card.body} onChange={e => set({ body: e.target.value })} />
          </div>

          {/* Estimate (method-aware) */}
          <div className="field">
            <label>Estimate · {method}</label>
            {method === 'points' && (
              <input
                type="number" min={0} style={{ width: 120 }}
                value={est.points ?? ''}
                onChange={e => setEst({ points: e.target.value === '' ? null : num(e.target.value) })}
              />
            )}
            {(method === 'tshirt5' || method === 'tshirt7') && (
              <div className="seg">
                {tshirtScaleFor(method).map(s => (
                  <button
                    key={s}
                    className={`seg-btn${est.size === s ? ' active' : ''}`}
                    onClick={() => setEst({ size: est.size === s ? null : s })}
                  >{s}</button>
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
                          <td key={k}>
                            <input type="number" min={0} value={tri ? tri[k] : ''} onChange={e => setTri(d.key, k, num(e.target.value))} />
                          </td>
                        ))}
                        <td className="tri-exp">
                          {tri ? `${Math.round(pertExpected(tri) * 100) / 100} ±${Math.round(pertStdDev(tri) * 100) / 100}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Dual dates */}
          <div className="field-2">
            <div className="field">
              <label>Milestone (planned)</label>
              <input type="date" value={dateValue(card.milestone)} onChange={e => set({ milestone: e.target.value || null })} />
            </div>
            <div className="field">
              <label>Deadline (latest)</label>
              <input type="date" value={dateValue(card.deadline)} onChange={e => set({ deadline: e.target.value || null })} />
            </div>
          </div>

          {/* Assignees */}
          <div className="field">
            <label>Assignees (OBS)</label>
            {orgs.length === 0 && <p className="muted">No organizations yet — add some under “Manage OBS”.</p>}
            {orgs.map(org => {
              const anon = `${ANON_PREFIX}${org.id}`;
              return (
                <div className="assign-org" key={org.id}>
                  <span className={pillClass(org.treatment)} style={{ borderColor: org.color }}>
                    <strong>{org.org_code ?? '—'}</strong>&nbsp;{org.name}
                  </span>
                  <label className="chk">
                    <input type="checkbox" checked={card.assignees.includes(anon)} onChange={() => toggleAssignee(anon)} />
                    ⊘ anon
                  </label>
                  {res.filter(r => r.parent_id === org.id).map(r => (
                    <label className="chk" key={r.id}>
                      <input type="checkbox" checked={card.assignees.includes(r.id)} onChange={() => toggleAssignee(r.id)} />
                      {r.name}
                    </label>
                  ))}
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

          {/* Split linkage */}
          {siblings.length > 0 && (
            <div className="note">
              <strong>Split group</strong> — linked with {siblings.map((s, i) => <span key={s.id}>{i > 0 ? ', ' : ''}{s.title}</span>)}.
            </div>
          )}

          {/* Flow history */}
          {card.events.length > 0 && (
            <details className="history">
              <summary>Flow history ({card.events.length})</summary>
              <ul>
                {[...card.events].slice(-8).reverse().map(e => (
                  <li key={e.id}>
                    <span className="ev-type">{e.type}</span>
                    {e.from && e.to ? ` ${e.from} → ${e.to}` : ''}
                    <span className="muted"> · {new Date(e.at).toLocaleString()} · {e.by}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
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
