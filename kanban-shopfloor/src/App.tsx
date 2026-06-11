import { ReactNode, useMemo, useRef, useState } from 'react';
import { Board } from './types';
import { createBoard, homeOrg, liveCards } from './lib/board';
import {
  clearLocal, downloadBoard, loadLocal, openAndMerge, parseFile, saveLocal, summaryText,
} from './lib/persist';
import { loadPrefs, Mode, savePrefs, UiPrefs } from './lib/prefs';
import { buildDemo } from './lib/demo';
import Sidebar, { ViewId } from './components/Sidebar';
import ProjectView from './components/ProjectView';
import ObsView from './components/ObsView';
import ObsDiagram from './components/ObsDiagram';
import BoardView from './components/BoardView';
import SwimlaneView from './components/SwimlaneView';
import ReportView from './components/ReportView';
import CardModal from './components/CardModal';
import Metrics from './components/Metrics';
import Coach from './components/Coach';
import Footer from './components/Footer';
import Splash from './components/Splash';

const LOGO_URL = 'https://project-business.org/wp-content/uploads/PBF-Logo_wide_white_r_300.png';

function defaultActor(board: Board): string {
  const org = homeOrg(board);
  return org ? `${org.org_code ?? org.name} ▸ ⊘ anon` : 'anon';
}

// Per-view coaching copy (shown only in coached mode).
const COACH: Record<ViewId, ReactNode> = {
  project: <>Begin here. Name the project, pick how you <strong>estimate</strong>, set a <strong>WIP limit</strong>, and write your <strong>Definition of Ready / Done</strong>. Then move to step 2.</>,
  obs: <>Detail <strong>your own organization</strong> in full (units → people). Add <strong>contractors</strong> and <strong>subcontractors</strong> as opaque boxes — for those you only record the people you know.</>,
  diagram: <>A generated picture of the structure. Export it as <strong>PNG</strong>, or the whole project as a <strong>PDF / Word</strong> report.</>,
  board: <>Add cards and drag them across the flow. Assign each to an OBS node: an <strong>individual</strong> (own work), a <strong>unit/team</strong> (delegated), or an <strong>organization</strong> (procured).</>,
  swim: null,
  report: null,
};

export default function App() {
  const [board, setBoard] = useState<Board>(() => loadLocal() ?? createBoard({ name: 'New board' }));
  const [prefs, setPrefsState] = useState<UiPrefs>(() => loadPrefs());
  const [view, setView] = useState<ViewId>('project');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [obsFocus, setObsFocus] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Jump to the Organization step and focus a node for editing (from diagrams).
  const editNode = (id: string) => { setObsFocus(id); setView('obs'); setDrawerOpen(false); };

  const apply = (fn: (b: Board) => Board) => setBoard(b => { const next = fn(b); saveLocal(next); return next; });
  const setPrefs = (patch: Partial<UiPrefs>) => setPrefsState(p => { const next = { ...p, ...patch }; savePrefs(next); return next; });
  const actor = useMemo(() => defaultActor(board), [board]);
  const openCard = openId ? liveCards(board).find(c => c.id === openId) ?? null : null;

  const hasWork = liveCards(board).length > 0 || (board.name && board.name !== 'New board') || homeOrg(board)?.name !== 'My Organization';

  function onLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(text => {
      try {
        const result = openAndMerge(board, parseFile(text));
        apply(() => result.board);
        setMsg(result.incomingIsStale ? `Merged an older file (kept your newer board). ${summaryText(result)}` : `Merged. ${summaryText(result)}`);
      } catch (err) { setMsg((err as Error).message); }
    });
    e.target.value = '';
  }
  function reset() {
    if (!confirm('Start a new empty board? Your current board is only kept if you saved it to a file.')) return;
    clearLocal();
    apply(() => createBoard({ name: 'New board' }));
    setPrefs({ splash_seen: false });
    setMsg('');
  }
  function loadDemo() {
    apply(() => buildDemo());
    setPrefs({ splash_seen: true });
    setView('board');
  }
  function enter(mode: Mode) { setPrefs({ mode, splash_seen: true }); setView('project'); }
  const go = (v: ViewId) => { setView(v); setDrawerOpen(false); };
  const dismissCoach = (id: string) => setPrefs({ coached_dismissed: { ...prefs.coached_dismissed, [id]: true } });

  if (!prefs.splash_seen) {
    return (
      <div className="app-shell">
        <Splash
          hasWork={!!hasWork}
          projectName={board.name}
          currentMode={prefs.mode}
          onEnter={enter}
          onLoadDemo={loadDemo}
          onBack={() => setPrefs({ splash_seen: true })}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <button className="hamburger" aria-label="Menu" onClick={() => setDrawerOpen(o => !o)}>☰</button>
        <button className="app-id app-id-btn" onClick={() => setPrefs({ splash_seen: false })} title="Start page">
          <div className="name-row"><h1>Kanban Shopfloor</h1><span className="type-badge">v1.7</span></div>
          <span className="subtitle">{board.name || 'Cross-corporate Kanban board'}</span>
        </button>
        <div className="spacer" />
        <div className="actions">
          <button className="mode-pill" onClick={() => setPrefs({ mode: prefs.mode === 'coached' ? 'open' : 'coached' })} title="Toggle coaching">
            {prefs.mode === 'coached' ? '🎯 Coached' : '📝 Open'}
          </button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => downloadBoard(board, actor)}>Save JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => fileInput.current?.click()}>Load JSON</button>
          <button className="btn btn-ghost-light btn-sm" onClick={reset}>Reset</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onLoadFile} />
        </div>
        <img className="pbf-logo-img" src={LOGO_URL} alt="Project Business Foundation" />
      </header>

      {msg && <div className="msg-bar">{msg} <button className="btn btn-secondary btn-sm" onClick={() => setMsg('')}>dismiss</button></div>}

      <div className="body-row">
        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
        <aside className={`sidebar${drawerOpen ? ' open' : ''}`}><Sidebar view={view} onNavigate={go} /></aside>

        <main className="view-main">
          {view !== 'diagram' && view !== 'swim' && view !== 'report' && (
            <div className="coach-slot"><Coach id={view} mode={prefs.mode} dismissed={prefs.coached_dismissed} onDismiss={dismissCoach}>{COACH[view]}</Coach></div>
          )}
          {view === 'project' && <ProjectView board={board} actor={actor} apply={apply} />}
          {view === 'obs' && <ObsView board={board} actor={actor} apply={apply} focusId={obsFocus} onFocusHandled={() => setObsFocus(null)} />}
          {view === 'diagram' && <ObsDiagram board={board} mode={prefs.mode} dismissed={prefs.coached_dismissed} onDismiss={dismissCoach} onEditNode={editNode} />}
          {view === 'board' && <BoardView board={board} actor={actor} apply={apply} onOpenCard={setOpenId} onShowMetrics={() => setShowMetrics(true)} />}
          {view === 'swim' && <SwimlaneView board={board} mode={prefs.mode} dismissed={prefs.coached_dismissed} onDismiss={dismissCoach} onOpenCard={setOpenId} onEditNode={editNode} />}
          {view === 'report' && <ReportView board={board} mode={prefs.mode} dismissed={prefs.coached_dismissed} onDismiss={dismissCoach} />}
        </main>
      </div>

      <Footer />

      {openCard && <CardModal board={board} card={openCard} actor={actor} apply={apply} onClose={() => setOpenId(null)} onOpenCard={setOpenId} />}
      {showMetrics && <Metrics board={board} onClose={() => setShowMetrics(false)} />}
    </div>
  );
}
