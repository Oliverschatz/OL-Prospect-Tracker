import { useMemo, useRef, useState } from 'react';
import { Board } from './types';
import { createBoard, homeOrg, liveCards } from './lib/board';
import {
  clearLocal, downloadBoard, loadLocal, openAndMerge, parseFile, saveLocal, summaryText,
} from './lib/persist';
import Sidebar, { ViewId } from './components/Sidebar';
import ProjectView from './components/ProjectView';
import ObsView from './components/ObsView';
import BoardView from './components/BoardView';
import CardModal from './components/CardModal';
import Metrics from './components/Metrics';

// Act as the home organization's anonymous resource (OBS-driven act-as is later).
function defaultActor(board: Board): string {
  const org = homeOrg(board);
  return org ? `${org.org_code ?? org.name} ▸ ⊘ anon` : 'anon';
}

export default function App() {
  const [board, setBoard] = useState<Board>(() => loadLocal() ?? createBoard({ name: 'New board' }));
  const [view, setView] = useState<ViewId>('project');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const apply = (fn: (b: Board) => Board) => setBoard(b => { const next = fn(b); saveLocal(next); return next; });
  const actor = useMemo(() => defaultActor(board), [board]);
  const openCard = openId ? liveCards(board).find(c => c.id === openId) ?? null : null;

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
      } catch (err) { setMsg((err as Error).message); }
    });
    e.target.value = '';
  }
  function reset() {
    if (!confirm('Start a new empty board? Your current board is only kept if you saved it to a file.')) return;
    clearLocal();
    apply(() => createBoard({ name: 'New board' }));
    setMsg('');
  }
  const go = (v: ViewId) => { setView(v); setDrawerOpen(false); };

  return (
    <div className="app-shell">
      <header className="app-bar">
        <button className="hamburger" aria-label="Menu" onClick={() => setDrawerOpen(o => !o)}>☰</button>
        <div className="app-id">
          <div className="name-row"><h1>Kanban Shopfloor</h1><span className="type-badge">Beta</span></div>
          <span className="subtitle">{board.name || 'Cross-corporate Kanban board'}</span>
        </div>
        <div className="spacer" />
        <div className="actions">
          <button className="btn btn-ghost-light btn-sm" onClick={() => downloadBoard(board, actor)}>Save JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => fileInput.current?.click()}>Load JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={reset}>Reset</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onLoadFile} />
        </div>
        <div className="pbf-logo"><strong>Project Business</strong>Foundation</div>
      </header>

      {msg && <div className="msg-bar">{msg} <button className="btn btn-secondary btn-sm" onClick={() => setMsg('')}>dismiss</button></div>}

      <div className="body-row">
        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
        <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
          <Sidebar view={view} onNavigate={go} />
        </aside>

        <main className="view-main">
          {view === 'project' && <ProjectView board={board} actor={actor} apply={apply} />}
          {view === 'obs' && <ObsView board={board} actor={actor} apply={apply} />}
          {view === 'board' && (
            <BoardView board={board} actor={actor} apply={apply} onOpenCard={setOpenId} onShowMetrics={() => setShowMetrics(true)} />
          )}
        </main>
      </div>

      {openCard && <CardModal board={board} card={openCard} actor={actor} apply={apply} onClose={() => setOpenId(null)} onOpenCard={setOpenId} />}
      {showMetrics && <Metrics board={board} onClose={() => setShowMetrics(false)} />}
    </div>
  );
}
