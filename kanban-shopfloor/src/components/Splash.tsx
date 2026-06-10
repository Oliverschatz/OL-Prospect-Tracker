import { Mode } from '../lib/prefs';

const LOGO_URL = 'https://project-business.org/wp-content/uploads/PBF-Logo_wide_white_r_300.png';

export default function Splash({
  hasWork, projectName, currentMode, onEnter, onLoadDemo, onBack,
}: {
  hasWork: boolean;
  projectName: string;
  currentMode: Mode;
  onEnter: (mode: Mode) => void;
  onLoadDemo: () => void;
  onBack: () => void;
}) {
  return (
    <div className="splash-container">
      <div className="splash-content">
        {hasWork && (
          <div className="splash-back-link">
            <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back to {projectName || 'your project'}</button>
          </div>
        )}

        <img className="splash-logo" src={LOGO_URL} alt="Project Business Foundation" />
        <h1 className="splash-title">Kanban Shopfloor</h1>
        <p className="splash-tagline">
          A cross-corporate Kanban board for the work that gets done across organizations —
          own teams, internal units, and contractors down the chain. Runs entirely in your browser.
        </p>

        {!hasWork && (
          <div className="splash-begin">
            <button className="btn btn-accent btn-large" onClick={() => onEnter(currentMode)}>Start a new board →</button>
            <p className="splash-begin-hint">Or load the sample project below to explore a fully populated board first.</p>
          </div>
        )}

        <div className="splash-example">
          <div className="splash-example-icon">📘</div>
          <div className="splash-example-text">
            <strong>See an example — a castle becomes a hotel</strong>
            <p>A populated cross-corporate board: an owner, a general contractor with units and people, three specialist contractors and their subcontractors, heritage constraints, and cards spread across the flow — including one stuck in approval and one nobody owns.</p>
          </div>
          <button className="splash-example-go" onClick={onLoadDemo} title="Load the sample project">→</button>
        </div>

        <h2 className="splash-section-heading">Working styles</h2>
        <p className="splash-section-text">Choose how much guidance you want. You can switch any time from the header.</p>
        <div className="splash-modes">
          <div className={`splash-mode-card${currentMode === 'coached' ? ' splash-mode-current' : ''}`} onClick={() => onEnter('coached')}>
            <div className="splash-mode-icon">🎯</div>
            <h3>Coached</h3>
            <p>Step-by-step prompts at each stage. Best for your first board, or returning after a break.</p>
          </div>
          <div className={`splash-mode-card${currentMode === 'open' ? ' splash-mode-current' : ''}`} onClick={() => onEnter('open')}>
            <div className="splash-mode-icon">📝</div>
            <h3>Open</h3>
            <p>All steps, no prompts. For people who already know the flow.</p>
          </div>
        </div>

        <div className="splash-footer">
          <div className="splash-footer-block">
            Kanban Shopfloor is a free tool from the <strong>Project Business Foundation</strong> — a non-profit think tank focused on cross-corporate project management. See also{' '}
            <a href="https://project-business.org/tools/free-tools-and-templates/" target="_blank" rel="noopener noreferrer">other free tools</a>.
          </div>
          <details className="splash-disclosure">
            <summary>🔒 Privacy &amp; data — what happens in your browser stays in your browser</summary>
            <p>All board data is stored in your browser's local storage. Nothing is sent to any server; every calculation and export runs locally. Clearing your browser data or using Reset deletes everything permanently. Share a board by exporting JSON and sending the file.</p>
          </details>
        </div>
      </div>
      <div className="splash-base-footer">
        Kanban Shopfloor — Open Source (MIT) by Oliver F. Lehmann / <a href="https://project-business.org" target="_blank" rel="noopener noreferrer">Project Business Foundation</a>
      </div>
    </div>
  );
}
