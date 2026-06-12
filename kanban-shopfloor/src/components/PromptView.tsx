import { useMemo, useState } from 'react';
import { Board } from '../types';
import { childrenOf, homeOrg, organizations, unitTypeLabel } from '../lib/board';
import { importSourcing } from '../lib/mutations';

type Props = {
  board: Board;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
  onClose: () => void;
  onImported: () => void;
};

// Same set + brand colours as Charter Forge's Prompt Engine.
const AI_TARGETS = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/', color: '#10A37F', icon: '🟢' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new', color: '#8B5CF6', icon: '🟣' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app', color: '#4285F4', icon: '🔵' },
  { id: 'copilot', label: 'Copilot', url: 'https://copilot.microsoft.com/', color: '#E67E22', icon: '🟡' },
];

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
  return organizations(board).filter(o => !o.is_home).map(o => `- ${o.name}${o.industry ? ` (${o.industry})` : ''}`).join('\n');
}

function parseAI(text: string): { data?: { contractors?: unknown }; error?: string } {
  const c = text.trim().replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const f = c.indexOf('{'), l = c.lastIndexOf('}');
  if (f === -1 || l <= f) return { error: 'No JSON object found in the pasted text.' };
  const js = c.substring(f, l + 1);
  try { return { data: JSON.parse(js) }; }
  catch (e1) {
    try {
      let fx = js.replace(/,\s*([}\]])/g, '$1');
      const ob = (fx.match(/\[/g) || []).length - (fx.match(/\]/g) || []).length;
      const oc = (fx.match(/\{/g) || []).length - (fx.match(/\}/g) || []).length;
      for (let i = 0; i < ob; i++) fx += ']';
      for (let i = 0; i < oc; i++) fx += '}';
      return { data: JSON.parse(fx) };
    } catch { return { error: 'Malformed JSON: ' + (e1 as Error).message }; }
  }
}

export default function PromptModal({ board, actor, apply, onClose, onImported }: Props) {
  const [summary, setSummary] = useState(board.description ?? '');
  const [deliverables, setDeliverables] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [inHouse, setInHouse] = useState(() => inHouseFromBoard(board));
  const [constraints, setConstraints] = useState(() => board.settings.constraints.map(c => c.label).join(', '));
  const [existing, setExisting] = useState(() => existingContractors(board));
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<{ ok?: string; err?: string } | null>(null);

  const prompt = useMemo(() => {
    const L = (label: string, val: string) => (val.trim() ? `${label}:\n${val.trim()}\n` : '');
    return `You are an expert in cross-corporate project management and procurement (project business), advising via the Project Business Foundation's Kanban Shopfloor tool (project-business.org).

PROJECT
- Name: ${board.name || '[not specified]'}
${L('Summary', summary)}${L('Deliverables / scope', deliverables)}${L('Location / jurisdiction', location)}${L('Sector / type of work', sector)}${L('What we can do in-house (do NOT propose contractors for these)', inHouse)}${L('Constraints to respect', constraints)}${L('Contractors already engaged (do NOT re-propose; you may add subcontractors under them)', existing)}
TASK: Recommend the contractors we need beyond our in-house capabilities, the concrete work packages each should deliver, and where they would likely engage subcontractors.

Respond with ONLY a JSON object — no markdown fences, no commentary. Use this shape:
{
  "contractors": [
    {
      "name": "short company type or name",
      "industry": "what they do (industry / function)",
      "workPackages": ["concrete task 1", "concrete task 2"],
      "subcontractors": [
        { "name": "...", "industry": "...", "workPackages": ["..."] }
      ]
    }
  ]
}
Be specific to this project; avoid generic boilerplate. Omit "subcontractors" where none apply.`;
  }, [board.name, summary, deliverables, location, sector, inHouse, constraints, existing]);

  function copyPrompt(then?: () => void) {
    const done = () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); then?.(); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(prompt).then(done).catch(() => fallbackCopy(prompt, done));
    else fallbackCopy(prompt, done);
  }
  function sendTo(t: typeof AI_TARGETS[number]) {
    copyPrompt(() => { window.open(t.url, '_blank', 'noopener'); setSentTo(t.label); });
  }
  function runImport(text: string) {
    const r = parseAI(text);
    if (r.error || !r.data) { setResult({ err: r.error || 'Could not read the response.' }); return; }
    const res = importSourcing(board, r.data, actor);
    if (res.orgs === 0) { setResult({ err: 'No contractors found in the JSON.' }); return; }
    apply(() => res.board);
    setResult({ ok: `Imported ${res.orgs} organization(s) and ${res.cards} task(s) into the OBS and board.` });
  }
  function pasteImport() {
    setResult(null);
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then(t => { if (!t || t.trim().length < 10) setResult({ err: 'Clipboard empty — use manual paste below.' }); else runImport(t); })
        .catch(() => setResult({ err: 'Clipboard read denied — use manual paste below.' }));
    } else setResult({ err: 'Clipboard not available — use manual paste below.' });
  }

  const field = 'view-input';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>⚡ Prompt Engine</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>Describe your project; build a prompt for your AI to suggest which contractors you need and what work they should do — then paste the answer back to import it. Nothing is sent from here.</p>

          <div className="field"><label>Project summary</label><textarea rows={2} className={field} value={summary} onChange={e => setSummary(e.target.value)} placeholder="What is this project about?" /></div>
          <div className="field"><label>Deliverables / scope</label><textarea rows={2} className={field} value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="What must be produced or built?" /></div>
          <div className="field-2">
            <div className="field"><label>Location / jurisdiction</label><input className={field} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bavaria, Germany" /></div>
            <div className="field"><label>Sector / type of work</label><input className={field} value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. heritage building conversion" /></div>
          </div>
          <div className="field"><label>What we can do in-house</label><textarea rows={2} className={field} value={inHouse} onChange={e => setInHouse(e.target.value)} /></div>
          <div className="field"><label>Constraints to respect</label><textarea rows={1} className={field} value={constraints} onChange={e => setConstraints(e.target.value)} /></div>
          <div className="field"><label>Contractors already engaged</label><textarea rows={1} className={field} value={existing} onChange={e => setExisting(e.target.value)} placeholder="(none yet)" /></div>

          <div className="prompt-sub">
            <strong>Send to AI</strong>
            <button className="btn btn-secondary btn-sm" onClick={() => copyPrompt()}>{copied ? '✓ Copied' : 'Copy prompt'}</button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>Copies the prompt to your clipboard and opens the AI in a new tab.</p>
          <div className="ai-targets">
            {AI_TARGETS.map(t => (
              <button key={t.id} className="ai-target" style={{ borderColor: t.color }} onClick={() => sendTo(t)}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div className="privacy-note"><span>🔒</span> Communication goes openly over your clipboard — no data is sent from this tool to any server or AI service.</div>
          <details className="prompt-preview"><summary>Preview / edit the prompt</summary>
            <textarea className="prompt-out" readOnly rows={12} value={prompt} onFocus={e => e.currentTarget.select()} />
          </details>

          <div className="prompt-sub"><strong>Paste &amp; import the AI's answer</strong></div>
          <p className="muted small" style={{ marginTop: 0 }}>{sentTo ? `Prompt copied — ${sentTo} opened. ` : ''}When the AI replies, copy its full JSON, then:</p>
          <button className="btn btn-primary btn-sm" onClick={pasteImport}>📋 Paste from clipboard &amp; import</button>
          {result?.ok && <div className="import-ok">✓ {result.ok} <button className="linklike" onClick={onImported}>Go to Organization →</button></div>}
          {result?.err && <div className="import-err">⚠ {result.err}</div>}
          <details className="prompt-preview"><summary>Clipboard not working? Paste manually</summary>
            <textarea className="prompt-out" rows={8} value={manual} onChange={e => setManual(e.target.value)} placeholder="Paste the AI's JSON response here…" />
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => runImport(manual)}>Import</button>
          </details>
        </div>
        <div className="modal-foot"><span className="spacer" /><button className="btn btn-primary btn-sm" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch { /* ignore */ }
  document.body.removeChild(ta);
}
