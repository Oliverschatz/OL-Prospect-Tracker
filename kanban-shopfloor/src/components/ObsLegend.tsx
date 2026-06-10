import { Board, ObsTreatment } from '../types';
import { organizations, resources } from '../lib/board';

// Map an org's non-colour treatment to its pill modifier class. Colour is never
// the only cue — the pill always shows the org code + name as text too.
export function pillClass(treatment?: ObsTreatment): string {
  switch (treatment) {
    case 'dashed': return 'pill t-dashed';
    case 'dotted': return 'pill t-dotted';
    case 'double': return 'pill t-double';
    default: return 'pill';
  }
}

export default function ObsLegend({ board, onManage }: { board: Board; onManage: () => void }) {
  const orgs = organizations(board);
  const res = resources(board);
  const countFor = (orgId: string) => res.filter(r => r.parent_id === orgId).length;

  return (
    <div className="obs-legend">
      <span className="legend-label">OBS</span>
      {orgs.map(o => (
        <span
          key={o.id}
          className={pillClass(o.treatment)}
          style={{ borderColor: o.color }}
          title={`${o.name} — ${countFor(o.id)} resource(s)`}
        >
          {o.treatment === 'monogram' && (
            <span className="mono" style={{ background: o.color }}>
              {(o.org_code ?? o.name).slice(0, 2).toUpperCase()}
            </span>
          )}
          <strong>{o.org_code ?? '—'}</strong>&nbsp;{o.name}
          <span className="legend-count">{countFor(o.id)}</span>
        </span>
      ))}
      {orgs.length === 0 && <span className="muted">No organizations yet.</span>}
      <button className="btn btn-secondary btn-sm" onClick={onManage}>Manage OBS</button>
    </div>
  );
}
