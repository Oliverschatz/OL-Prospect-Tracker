import { useState } from 'react';
import { Board } from '../types';
import {
  assigneeLabel, canEnterWip, cardsInColumn, pointsRollup, priorityOf, storyById, subtasksOf,
  wipCount, wipIsFull,
} from '../lib/board';
import { cardWarnings } from '../lib/dates';
import { formatEstimate } from '../lib/estimate';
import { addCard, placeCard } from '../lib/mutations';
import ObsLegend from './ObsLegend';

type DropTarget = { column: string; beforeId: string | null } | null;

export default function BoardView({
  board, actor, apply, onOpenCard, onShowMetrics,
}: {
  board: Board;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
  onOpenCard: (id: string) => void;
  onShowMetrics: () => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [msg, setMsg] = useState('');
  const [showPolicies, setShowPolicies] = useState(false);

  const columns = board.settings.columns;
  const defLabel = (id: string) => board.settings.constraints.find(c => c.id === id)?.label ?? id;

  function add() {
    const t = newTitle.trim();
    if (!t) return;
    apply(b => addCard(b, { title: t, column: 'todo' }, actor));
    setNewTitle('');
  }
  function addWaiting() {
    apply(b => addCard(b, { title: 'New waiting activity', column: 'waiting' }, actor));
  }

  function tryPlace(id: string, toColumn: string, beforeId: string | null) {
    const card = board.cards.find(c => c.id === id && !c.deleted);
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

  const dor = board.settings.definition_of_ready;
  const dod = board.settings.definition_of_done;

  return (
    <div className="board-view">
      <div className="board-toolbar">
        <ObsLegend board={board} />
        <span className="spacer" />
        {(dor.length > 0 || dod.length > 0) && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPolicies(v => !v)}>
            {showPolicies ? 'Hide' : 'Show'} DoR / DoD
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={onShowMetrics}>Metrics</button>
        <input value={newTitle} placeholder="New card title" style={{ width: 200 }}
          onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button className="btn btn-primary btn-sm" onClick={add}>+ Add card</button>
      </div>

      {showPolicies && (
        <div className="policies">
          <div className="policy-col"><h4>Definition of Ready</h4>{dor.length ? <ul>{dor.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">—</p>}</div>
          <div className="policy-col"><h4>Definition of Done</h4>{dod.length ? <ul>{dod.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">—</p>}</div>
        </div>
      )}

      {msg && <div className="msg-bar">{msg} <button className="btn btn-secondary btn-sm" onClick={() => setMsg('')}>dismiss</button></div>}

      {/* Full-width, short holding area for activities that can't start yet. */}
      <section
        className={`wait-panel${dropTarget?.column === 'waiting' && dragId != null ? ' drag-over' : ''}`}
        onDragOver={e => { if (dragId) { e.preventDefault(); setDropTarget({ column: 'waiting', beforeId: null }); } }}
        onDrop={e => { if (dragId) { e.preventDefault(); onDrop('waiting', null); } }}
      >
        <div className="wait-head">
          <span className="label">⏸ Waiting</span>
          <span className="wait-hint">blocked until something happens — drag into “To do” when ready</span>
          <span className="spacer" />
          <span className="wait-count">{cardsInColumn(board, 'waiting').length}</span>
          <button className="btn btn-secondary btn-sm" onClick={addWaiting}>+ Add</button>
        </div>
        <div className="wait-track">
          {cardsInColumn(board, 'waiting').map(card => {
            const showLine = dropTarget?.column === 'waiting' && dropTarget.beforeId === card.id && dragId && dragId !== card.id;
            const warns = cardWarnings(card);
            return (
              <article
                className={`wait-card${dragId === card.id ? ' dragging' : ''}${showLine ? ' drop-before' : ''}`}
                key={card.id}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(card.id); }}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                onDragOver={e => { if (dragId) { e.preventDefault(); e.stopPropagation(); setDropTarget({ column: 'waiting', beforeId: card.id }); } }}
                onDrop={e => { if (dragId) { e.preventDefault(); e.stopPropagation(); onDrop('waiting', card.id); } }}
                onClick={() => onOpenCard(card.id)}
                title={card.title}
              >
                <span className="wait-card-title">{card.title}</span>
                <span className="wait-card-meta">
                  {formatEstimate(card.estimate, board.settings.estimate_method)}
                  {card.assignees.length > 0 && ` · ${card.assignees.length}👤`}
                  {warns.length > 0 && ' ⚠'}
                </span>
              </article>
            );
          })}
          {cardsInColumn(board, 'waiting').length === 0 && <span className="wait-empty">Nothing waiting. Drop activities here that can’t start yet.</span>}
        </div>
      </section>

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
                const story = storyById(board, card.story_id);
                const subs = subtasksOf(board, card.id);
                const subsDone = subs.filter(s => s.column === 'done').length;
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
                    onClick={() => onOpenCard(card.id)}
                  >
                    {story && <div className="kard-story" title="User story">📘 {story.title}</div>}
                    <div className="title-row">
                      <div className="title">
                        <span className="prio">{priorityOf(board, card)}</span>
                        {card.parent_id && <span className="sub-mark" title="Subtask">↳</span>}
                        {card.title}
                      </div>
                    </div>
                    {card.assignees.length > 0 && (
                      <div className="kard-pills">
                        {card.assignees.map(a => <span key={a} className="pill">{assigneeLabel(board, a)}</span>)}
                      </div>
                    )}
                    <div className="kard-meta">
                      <span>{board.settings.estimate_method === 'points' && subs.length > 0
                        ? `${pointsRollup(board, card) ?? 0} pts ⊞`
                        : formatEstimate(card.estimate, board.settings.estimate_method)}</span>
                      {subs.length > 0 && <span title="Subtasks done / total">⊟ {subsDone}/{subs.length}</span>}
                      {card.links.length > 0 && <span title={`${card.links.length} link(s)`}>🔗 {card.links.length}</span>}
                      {card.constraints.map(c => (
                        <span key={c.id} className="badge-constraint" title={c.note || defLabel(c.id)}>{defLabel(c.id)}</span>
                      ))}
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
    </div>
  );
}
