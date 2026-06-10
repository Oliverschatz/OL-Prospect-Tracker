import { useState } from 'react';
import { Board, EstimateMethod } from '../types';
import {
  addConstraintDef, patchBoardMeta, removeConstraintDef, updateConstraintDef, updateSettings,
} from '../lib/mutations';

const METHODS: { id: EstimateMethod; label: string }[] = [
  { id: 'tshirt5', label: 'T-shirt (5)' },
  { id: 'tshirt7', label: 'T-shirt (7)' },
  { id: 'points', label: 'Story points' },
  { id: 'three_point', label: '3-point (PERT)' },
];

type Common = { board: Board; actor: string; apply: (fn: (b: Board) => Board) => void };

// Editable list of short text lines (Definition of Ready / Done).
function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      {items.map((it, i) => (
        <div className="link-row" key={i}>
          <input value={it} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="icon-btn danger" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="link-row">
        <input placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } }} />
        <button className="btn btn-secondary btn-sm" onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(''); } }}>Add</button>
      </div>
    </div>
  );
}

export default function ProjectView({ board, actor, apply }: Common) {
  const s = board.settings;
  const [newConstraint, setNewConstraint] = useState('');

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => apply(b => patchBoardMeta(b, { image: String(reader.result) }, actor));
    reader.readAsDataURL(f);
    e.target.value = '';
  }

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Project setup</h2>
        <p className="muted">Start here: name the project, choose how you estimate, set the work-in-progress limit, and write your Definition of Ready / Done.</p>
      </div>

      <section className="panel">
        <div className="field"><label>Project name</label><input value={board.name} onChange={e => apply(b => patchBoardMeta(b, { name: e.target.value }, actor))} /></div>
        <div className="field"><label>Description</label><textarea rows={2} value={board.description ?? ''} onChange={e => apply(b => patchBoardMeta(b, { description: e.target.value }, actor))} /></div>
        <div className="field">
          <label>Project picture (shown in reports)</label>
          <div className="img-field">
            <input className="img-url" placeholder="Image URL, or choose a file →" value={board.image ?? ''} onChange={e => apply(b => patchBoardMeta(b, { image: e.target.value || undefined }, actor))} />
            <label className="btn btn-secondary btn-sm img-pick">Choose file<input type="file" accept="image/*" hidden onChange={onPickImage} /></label>
            {board.image && <button className="btn btn-secondary btn-sm" onClick={() => apply(b => patchBoardMeta(b, { image: undefined }, actor))}>Remove</button>}
          </div>
          {board.image && <img className="img-preview" src={board.image} alt="Project picture" />}
        </div>
        <div className="field-2">
          <div className="field"><label>Start date</label><input type="date" value={board.start_date ?? ''} onChange={e => apply(b => patchBoardMeta(b, { start_date: e.target.value || null }, actor))} /></div>
          <div className="field"><label>End date</label><input type="date" value={board.end_date ?? ''} onChange={e => apply(b => patchBoardMeta(b, { end_date: e.target.value || null }, actor))} /></div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Estimation method</label>
            <select value={s.estimate_method} onChange={e => apply(b => updateSettings(b, { estimate_method: e.target.value as EstimateMethod }, actor))}>
              {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>WIP limit (In Progress)</label>
            <input type="number" min={0} placeholder="∞" value={s.wip_limit ?? ''}
              onChange={e => apply(b => updateSettings(b, { wip_limit: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }, actor))} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="field-2">
          <div className="field"><label>Definition of Ready</label>
            <StringList items={s.definition_of_ready} placeholder="A card is ready when…" onChange={next => apply(b => updateSettings(b, { definition_of_ready: next }, actor))} />
          </div>
          <div className="field"><label>Definition of Done</label>
            <StringList items={s.definition_of_done} placeholder="A card is done when…" onChange={next => apply(b => updateSettings(b, { definition_of_done: next }, actor))} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Constraint flags</h3></div>
        <p className="muted small">Per-card checkboxes (with an explanation). Add your own as needed.</p>
        {s.constraints.map(c => (
          <div className="link-row" key={c.id}>
            <input value={c.label} onChange={e => apply(b => updateConstraintDef(b, c.id, e.target.value, actor))} />
            <button className="icon-btn danger" aria-label="Remove" onClick={() => apply(b => removeConstraintDef(b, c.id, actor))}>✕</button>
          </div>
        ))}
        <div className="link-row">
          <input placeholder="New constraint, e.g. Export-controlled" value={newConstraint} onChange={e => setNewConstraint(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newConstraint.trim()) { apply(b => addConstraintDef(b, newConstraint, actor)); setNewConstraint(''); } }} />
          <button className="btn btn-secondary btn-sm" onClick={() => { if (newConstraint.trim()) { apply(b => addConstraintDef(b, newConstraint, actor)); setNewConstraint(''); } }}>Add</button>
        </div>
      </section>
    </div>
  );
}
