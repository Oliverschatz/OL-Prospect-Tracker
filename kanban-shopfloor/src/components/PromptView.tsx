import { useMemo, useState } from 'react';
import { Board } from '../types';
import { childrenOf, homeOrg, organizations, unitTypeLabel } from '../lib/board';
import { Mode } from '../lib/prefs';
import Coach from './Coach';
import Footer from './Footer';

type Props = {
  board: Board;
  mode: Mode;
  dismissed: Record<string, boolean>;
  onDismiss: (id: string) => void;
};

// Prefill "what we can do ourselves" from the home org's units.
function inHouseFromBoard(board: Board): string {
  const home = homeOrg(board);
  if (!home) return '';
  const lines: string[] = [];
  const walk = (parentId: string) => {
    for (const u of childrenOf(board, parentId).filter(n => n.kind === 'unit')) {
      lines.push(`- ${u.name} (${unitTypeLabel(u)})`);
      walk(u.id);
    }
  };
  walk(home.id);
  const head = `${home.name}${home.industry ? ` — ${home.industry}` : ''}`;
  return lines.length ? `${head}\nUnits:\n${lines.join('\n')}` : head;
}

function existingContractors(board: Board): string {
  const ext = organizations(board).filter(o => !o.is_home);
  return ext.map(o => `- ${o.name}${o.industry ? ` (${o.industry})` : ''}`).join('\n');
}

export default function PromptView({ board, mode, dismissed, onDismiss }: Props) {
  const [summary, setSummary] = useState(board.description ?? '');
  const [deliverables, setDeliverables] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [inHouse, setInHouse] = useState(() => inHouseFromBoard(board));
  const [constraints, setConstraints] = useState(() => board.settings.constraints.map(c => c.label).join(', '));
  const [existing, setExisting] = useState(() => existingContractors(board));
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const L = (label: string, val: string) => (val.trim() ? `${label}:\n${val.trim()}\n` : '');
    return `You are an expert in cross-corporate project management and procurement (project business).
Help me decide which contractors I need for the project below and what work each should do.

Project: ${board.name || '(unnamed)'}
${L('Summary', summary)}${L('Deliverables / scope', deliverables)}${L('Location / jurisdiction', location)}${L('Sector / type of work', sector)}${L('What we can do in-house (do not propose contractors for these)', inHouse)}${L('Constraints to respect', constraints)}${L('Contractors already engaged (do not re-propose, but you may suggest subcontractors under them)', existing)}
Please answer with:
1. The contractor types (trades / disciplines) I am likely to need beyond our in-house capabilities.
2. For each contractor: the concrete work packages they should deliver.
3. Where that contractor would likely engage subcontractors, and for what.
4. Any work that is safety-critical, regulated/heritage, or needs a customer decision.

Group the answer by contractor. For each, give: a short name/type, the industry/function, the work packages, and likely subcontractors. Be specific to this project; avoid generic boilerplate.`;
  }, [board.name, summary, deliverables, location, sector, inHouse, constraints, existing]);

  function copy() {
    const done = () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).then(done).catch(() => fallbackCopy(prompt, done));
    } else { fallbackCopy(prompt, done); }
  }

  const field = 'view-input';
  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Sourcing prompt</h2>
        <p className="muted">Describe your project; the tool builds a prompt you can paste into ChatGPT, Claude or another AI to brainstorm which contractors you need and what work they should do. Nothing is sent from here — the prompt stays in your browser until you copy it.</p>
      </div>

      <Coach id="prompt" mode={mode} dismissed={dismissed} onDismiss={onDismiss}>
        Fill in what you know (some fields are pre-filled from your project and OBS). Then <strong>Copy</strong> the generated prompt and paste it into your AI. Bring its answer back here to build the Organization (OBS) and the board.
      </Coach>

      <section className="panel">
        <div className="field"><label>Project summary</label><textarea rows={2} className={field} value={summary} onChange={e => setSummary(e.target.value)} placeholder="What is this project about?" /></div>
        <div className="field"><label>Deliverables / scope</label><textarea rows={2} className={field} value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="What must be produced or built?" /></div>
        <div className="field-2">
          <div className="field"><label>Location / jurisdiction</label><input className={field} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bavaria, Germany" /></div>
          <div className="field"><label>Sector / type of work</label><input className={field} value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. heritage building conversion" /></div>
        </div>
        <div className="field"><label>What we can do in-house</label><textarea rows={3} className={field} value={inHouse} onChange={e => setInHouse(e.target.value)} /></div>
        <div className="field"><label>Constraints to respect</label><textarea rows={2} className={field} value={constraints} onChange={e => setConstraints(e.target.value)} /></div>
        <div className="field"><label>Contractors already engaged</label><textarea rows={2} className={field} value={existing} onChange={e => setExisting(e.target.value)} placeholder="(none yet)" /></div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Generated prompt</h3>
          <span className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy prompt'}</button>
        </div>
        <textarea className="prompt-out" readOnly rows={16} value={prompt} onFocus={e => e.currentTarget.select()} />
      </section>

      <Footer />
    </div>
  );
}

function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch { /* ignore */ }
  document.body.removeChild(ta);
}
