import { useEffect, useMemo, useRef, useState } from 'react';
import { Board, Card } from './types';
import {
  assigneeLabel, canEnterWip, cardsInColumn, createBoard, organizations,
  priorityOf, stamp, uid, wipCount, wipIsFull,
} from './lib/board';
import { cardWarnings } from './lib/dates';
import { formatEstimate } from './lib/estimate';
import {
  clearLocal, downloadBoard, loadLocal, openAndMerge, parseFile, saveLocal, summaryText,
} from './lib/persist';

// OBS-driven actor selection lands in the next increment; for now act as the
// first organization's anonymous resource.
function defaultActor(board: Board): string {
  const org = organizations(board)[0];
  return org ? `${org.org_code ?? org.name} ▸ ⊘ anon` : 'anon';
}

export default function App() {
  const [board, setBoard] = useState<Board>(() => loadLocal() ?? createBoard({ name: 'New board' }));
  const [newTitle, setNewTitle] = useState('');
  const [msg, setMsg] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { saveLocal(board); }, [board]);

  const actor = useMemo(() => defaultActor(board), [board]);
  const columns = board.settings.columns;

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
    setBoard(b => ({ ...stamp(b, actor), cards: [...b.cards, card] }));
    setNewTitle('');
  }

  function moveCard(card: Card, toColumn: string) {
    if (toColumn === card.column) return;
    if (!canEnterWip(board, card, toColumn)) {
      setMsg(`WIP limit reached (${board.settings.wip_limit}). Finish or move a card out of WIP first.`);
      return;
    }
    const now = new Date().toISOString();
    setBoard(b => ({
      ...stamp(b, actor),
      cards: b.cards.map(c => c.id === card.id
        ? stamp({
            ...c, column: toColumn, sort_order: Date.now(),
            events: [...c.events, { id: uid(), type: 'moved', from: card.column, to: toColumn, at: now, by: actor }],
          }, actor)
        : c),
    }));
  }

  function onLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(text => {
      try {
        const file = parseFile(text);
        const result = openAndMerge(board, file);
        setBoard(result.board);
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
    setBoard(createBoard({ name: 'New board' }));
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
        <div className="note" style={{ flex: 1, minWidth: 280 }}>
          Runs entirely in your browser — your data never leaves this device. Share a board by
          <strong> Save JSON</strong> → send the file → <strong>Load JSON</strong> merges it safely (no overwrites).
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newTitle} placeholder="New card title"
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCard(); }} style={{ width: 220 }} />
          <button className="btn btn-primary btn-sm" onClick={addCard}>+ Add card</button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '8px 20px', background: '#fff', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          {msg} <button className="btn btn-secondary btn-sm" onClick={() => setMsg('')}>dismiss</button>
        </div>
      )}

      <div className="board">
        {columns.map(col => {
          const cards = cardsInColumn(board, col.id);
          const isWip = col.id === board.settings.wip_column_id;
          const full = isWip && wipIsFull(board);
          return (
            <section className="column" key={col.id}>
              <div className="column-head">
                <span className="label">{col.label}</span>
                <span className={`column-count${full ? ' full' : ''}`}>
                  {isWip && board.settings.wip_limit != null ? `${wipCount(board)} / ${board.settings.wip_limit}` : cards.length}
                </span>
              </div>
              {cards.map(card => {
                const warns = cardWarnings(card);
                return (
                  <article className="kard" key={card.id}>
                    <div className="title-row">
                      <div className="title">
                        <span className="prio">{priorityOf(board, card)}</span>{card.title}
                      </div>
                    </div>
                    {card.assignees.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {card.assignees.map(a => <span key={a} className="pill">{assigneeLabel(board, a)}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                      <span>{formatEstimate(card.estimate, board.settings.estimate_method)}</span>
                      {warns.map(w => (
                        <span key={w.kind} title={w.message} style={{ color: 'var(--danger)' }}>⚠ {w.message}</span>
                      ))}
                      <span style={{ flex: 1 }} />
                      <select value={card.column} onChange={e => moveCard(card, e.target.value)}
                        title="Move to column" style={{ fontSize: 11, padding: '2px 4px' }}>
                        {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </article>
                );
              })}
              {cards.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '14px 0' }}>No cards.</div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="app-footer">
        Kanban Shopfloor is a free tool from the Project Business Foundation —{' '}
        <a href="https://project-business.org" target="_blank" rel="noopener noreferrer">project-business.org</a>
      </footer>
    </div>
  );
}
