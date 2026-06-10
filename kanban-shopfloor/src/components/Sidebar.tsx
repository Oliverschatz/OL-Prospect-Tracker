export type ViewId = 'project' | 'obs' | 'diagram' | 'board';

const STEPS: { id: ViewId; n: number; label: string; hint: string }[] = [
  { id: 'project', n: 1, label: 'Project', hint: 'Name, estimates, WIP, DoR / DoD' },
  { id: 'obs', n: 2, label: 'Organization', hint: 'Who does the work (OBS)' },
  { id: 'diagram', n: 3, label: 'OBS diagram', hint: 'Picture of the structure · export' },
  { id: 'board', n: 4, label: 'Kanban board', hint: 'The work, as cards' },
];

export default function Sidebar({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav className="sidebar-nav">
      <div className="sidebar-title">Steps</div>
      {STEPS.map(s => (
        <button
          key={s.id}
          className={`nav-step${view === s.id ? ' active' : ''}`}
          onClick={() => onNavigate(s.id)}
          aria-current={view === s.id}
        >
          <span className="nav-num">{s.n}</span>
          <span className="nav-text">
            <span className="nav-label">{s.label}</span>
            <span className="nav-hint">{s.hint}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
