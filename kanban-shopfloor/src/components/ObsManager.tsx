import { Board, ObsTreatment } from '../types';
import { organizations, resources } from '../lib/board';
import { addObs, deleteObs, updateObs } from '../lib/mutations';

const TREATMENTS: ObsTreatment[] = ['solid', 'dashed', 'dotted', 'double', 'monogram'];

export default function ObsManager({
  board, actor, apply, onClose,
}: {
  board: Board;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
  onClose: () => void;
}) {
  const orgs = organizations(board);
  const res = resources(board);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Organizational Breakdown Structure</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Organizations group resources. Colour is a hint only — each org keeps a text
            <strong> code</strong> and a non-colour <strong>treatment</strong> for accessibility.
          </p>

          {orgs.map(org => (
            <div className="obs-org" key={org.id}>
              <div className="obs-row">
                <input
                  type="color"
                  value={org.color ?? '#1a2744'}
                  onChange={e => apply(b => updateObs(b, org.id, { color: e.target.value }, actor))}
                  title="Colour"
                />
                <input
                  className="obs-code"
                  value={org.org_code ?? ''}
                  placeholder="CODE"
                  onChange={e => apply(b => updateObs(b, org.id, { org_code: e.target.value.toUpperCase() }, actor))}
                />
                <input
                  className="obs-name"
                  value={org.name}
                  onChange={e => apply(b => updateObs(b, org.id, { name: e.target.value }, actor))}
                />
                <select
                  value={org.treatment ?? 'solid'}
                  onChange={e => apply(b => updateObs(b, org.id, { treatment: e.target.value as ObsTreatment }, actor))}
                  title="Non-colour treatment"
                >
                  {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'resource', parent_id: org.id }, actor))}>+ resource</button>
                <button className="icon-btn danger" title="Delete organization" onClick={() => apply(b => deleteObs(b, org.id, actor))}>✕</button>
              </div>

              {res.filter(r => r.parent_id === org.id).map(r => (
                <div className="obs-row obs-child" key={r.id}>
                  <input
                    type="color"
                    value={r.color ?? '#6b7686'}
                    onChange={e => apply(b => updateObs(b, r.id, { color: e.target.value }, actor))}
                    title="Colour"
                  />
                  <input
                    className="obs-name"
                    value={r.name}
                    onChange={e => apply(b => updateObs(b, r.id, { name: e.target.value }, actor))}
                  />
                  <button className="icon-btn danger" title="Delete resource" onClick={() => apply(b => deleteObs(b, r.id, actor))}>✕</button>
                </div>
              ))}
            </div>
          ))}

          {orgs.length === 0 && <p className="muted">No organizations yet.</p>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'org', parent_id: null }, actor))}>+ Add organization</button>
          <span className="spacer" />
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
