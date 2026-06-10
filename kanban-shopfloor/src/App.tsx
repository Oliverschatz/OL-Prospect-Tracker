import { useMemo, useRef, useState } from 'react';
import { Board, Card, EstimateMethod } from './types';
import {
  assigneeLabel, canEnterWip, cardsInColumn, createBoard, liveCards, organizations,
  priorityOf, stamp, uid, wipCount, wipIsFull,
} from './lib/board';
import { cardWarnings } from './lib/dates';
import { formatEstimate } from './lib/estimate';
import {
  clearLocal, downloadBoard, loadLocal, openAndMerge, parseFile, saveLocal, summaryText,
} from './lib/persist';
import { placeCard, renameBoard, updateSettings } from './lib/mutations';
import CardModal from './components/CardModal';
import ObsManager from './components/ObsManager';
import ObsLegend from './components/ObsLegend';
import Metrics from './components/Metrics';

const METHODS: { id: EstimateMethod; label: string }[] = [
  { id: 'tshirt5', label: 'T-shirt (5)' },
  { id: 'tshirt7', label: 'T-shirt (7)' },
  { id: 'points', label: 'Story points' },
  { id: 'three_point', label: '3-point (PERT)' },
];

// OBS-driven actor selection: act as the first organization's anonymous resource.
function defaultActor(board: Board): string {
  const org = organizations(board)[0];
  return org ? `${org.org_code ?? org.name} ▸ ⊘ anon` : 'anon';
}

type DropTarget = { column: string; beforeId: string | null } | null;

export default function App() {
  const [board, setBoard] = useState<Board>(() => loadLocal() ?? createBoard({ name: 'New board' }));
  const [newTitle, setNewTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showObs, setShowObs] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Persist on every change.
  const apply = (fn: (b: Board) => Board) => setBoard(b => { const next = fn(b); saveLocal(next); return next; });

  const actor = useMemo(() => defaultActor(board), [board]);
  const columns = board.settings.columns;
  const openCard = openId ? liveCards(board).find(c => c.id === openId) ?? null : null;

  function addCard() {
    const title = newTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const card: Card = stamp({
      id: uid(), type: 'task', title, column: 'todo',
      sort_order: Date.now(), body: '', assignees: [], links: [],
      events: [{ id: uid(), type: 'created', at: now, by: actor }],
      rev: 0, actor, updated_at: now,
    } as Card, actor);
    apply(b => ({ ...stamp(b, actor), cards: [...b.cards, card] }));
    setNewTitle('');
  }

  function tryPlace(id: string, toColumn: string, beforeId: string | null) {
    const card = liveCards(board).find(c => c.id === id);
    if (!card) return;
    if (!canEnterWip(board, card, toColumn)) {
      setMsg(`WIP limit reached (${board.settings.wip_limit}). Finish or move a card out of WIP first.`);
      return;
    }
    apply(b => placeCard(b, id, toColumn, beforeId, actor));
  }

  function onDrop(toColumn: string, beforeId: string | null) {
    if (dragId) tryPlace(dragId, toColumn, beforeId);
    setDragId(null);
    setDropTarget(null);
  }

  function onLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(text => {
      try {
        const result = openAndMerge(board, parseFile(text));
        apply(() => result.board);
        setMsg(result.incomingIsStale
          ? `Merged an older file (kept your newer board where they differ). ${summaryText(result)}`
          : `Merged. ${summaryText(result)}`);
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
    e.target.value = '';
  }

  function reset() {
    if (!confirm('Start a new empty board? Your current board is only kept if you saved it to a file.')) return;
    clearLocal();
    apply(() => createBoard({ name: 'New board' }));
    setMsg('');
  }

  return (
    <div>
      <header className="app-bar">
        <div className="app-id">
          <div className="name-row">
            <h1>Kanban Shopfloor</h1>
            <span className="type-badge">Beta</span>
          </div>
          <span className="subtitle">Cross-corporate Kanban board</span>
        </div>
        <div className="spacer" />
        <div className="actions">
          <button className="btn btn-ghost-light btn-sm" onClick={() => setShowMetrics(true)}>Metrics</button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => downloadBoard(board, actor)}>Save JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => fileInput.current?.click()}>Load JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={reset}>Reset</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onLoadFile} />
        </div>
        <div className="pbf-logo">
          <strong>Project Business</strong>
          Foundation
        </div>
      </header>

      <div className="toolbar">
        <input
          className="board-name"
          value={board.name}
          onChange={e => apply(b => renameBoard(b, e.target.value, actor))}
          title="Board name"
        />
        <label className="ctl">
          Estimates
          <select
            value={board.settings.estimate_method}
            onChange={e => apply(b => updateSettings(b, { estimate_method: e.target.value as EstimateMethod }, actor))}
          >
            {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="ctl">
          WIP limit
          <input
            type="number" min={0} style={{ width: 64 }}
            value={board.settings.wip_limit ?? ''}
            placeholder="∞"
            onChange={e => apply(b => updateSettings(b, { wip_limit: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }, actor))}
          />
        </label>
        <div className="spacer" />
        <input value={newTitle} placeholder="New card title"
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCard(); }} style={{ width: 200 }} />
        <button className="btn btn-primary btn-sm" onClick={addCard}>+ Add card</button>
      </div>

      <div className="legend-bar">
        <ObsLegend board={board} onManage={() => setShowObs(true)} />
      </div>

      {msg && (
        <div className="msg-bar">
          {msg} <button className="btn btn-secondary btn-sm" onClick={() => setMsg('')}>dismiss</button>
        </div>
      )}

      <div className="board">
        {columns.map(col => {
          const cards = cardsInColumn(board, col.id);
          const isWip = col.id === board.settings.wip_column_id;
          const full = isWip && wipIsFull(board);
          const colDragOver = dropTarget?.column === col.id && dragId != null;
          return (
            <section
              className={`column${colDragOver ? ' drag-over' : ''}`}
              key={col.id}
              onDragOver={e => { if (dragId) { e.preventDefault(); setDropTarget({ column: col.id, beforeId: null }); } }}
              onDrop={e => { if (dragId) { e.preventDefault(); onDrop(col.id, null); } }}
            >
              <div className="column-head">
                <span className="label">{col.label}</span>
                <span className={`column-count${full ? ' full' : ''}`}>
                  {isWip && board.settings.wip_limit != null ? `${wipCount(board)} / ${board.settings.wip_limit}` : cards.length}
                </span>
              </div>

              {cards.map(card => {
                const warns = cardWarnings(card);
                const sibs = card.split_group ? liveCards(board).filter(c => c.split_group === card.split_group).length - 1 : 0;
                const showLine = dropTarget?.column === col.id && dropTarget.beforeId === card.id && dragId && dragId !== card.id;
                return (
                  <article
                    className={`kard${dragId === card.id ? ' dragging' : ''}${showLine ? ' drop-before' : ''}`}
                    key={card.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(card.id); }}
                    onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                    onDragOver={e => { if (dragId) { e.preventDefault(); e.stopPropagation(); setDropTarget({ column: col.id, beforeId: card.id }); } }}
                    onDrop={e => { if (dragId) { e.preventDefault(); e.stopPropagation(); onDrop(col.id, card.id); } }}
                    onClick={() => setOpenId(card.id)}
                  >
                    <div className="title-row">
                      <div className="title">
                        <span className="prio">{priorityOf(board, card)}</span>{card.title}
                      </div>
                    </div>
                    {card.assignees.length > 0 && (
                      <div className="kard-pills">
                        {card.assignees.map(a => <span key={a} className="pill">{assigneeLabel(board, a)}</span>)}
                      </div>
                    )}
                    <div className="kard-meta">
                      <span>{formatEstimate(card.estimate, board.settings.estimate_method)}</span>
                      {sibs > 0 && <span className="badge-split">split ·{sibs + 1}</span>}
                      {card.links.length > 0 && <span title={`${card.links.length} link(s)`}>🔗 {card.links.length}</span>}
                      {warns.map(w => <span key={w.kind} title={w.message} className="warn-ico">⚠</span>)}
                    </div>
                  </article>
                );
              })}
              {cards.length === 0 && <div className="empty-col">Drop cards here.</div>}
            </section>
          );
        })}
      </div>

      <footer className="app-footer">
        Kanban Shopfloor is a free tool from the Project Business Foundation —{' '}
        <a href="https://project-business.org" target="_blank" rel="noopener noreferrer">project-business.org</a>
      </footer>

      {openCard && (
        <CardModal board={board} card={openCard} actor={actor} apply={apply} onClose={() => setOpenId(null)} />
      )}
      {showObs && <ObsManager board={board} actor={actor} apply={apply} onClose={() => setShowObs(false)} />}
      {showMetrics && <Metrics board={board} onClose={() => setShowMetrics(false)} />}
    </div>
  );
}
