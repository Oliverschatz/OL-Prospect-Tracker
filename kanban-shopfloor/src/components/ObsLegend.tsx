import { Board, ObsTreatment } from '../types';
import { organizations } from '../lib/board';

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

export default function ObsLegend({ board }: { board: Board }) {
  const orgs = organizations(board);
  if (orgs.length === 0) return null;
  return (
    <div className="obs-legend">
      <span className="legend-label">Orgs</span>
      {orgs.map(o => (
        <span key={o.id} className={pillClass(o.treatment)} style={{ borderColor: o.color }} title={o.name}>
          {o.treatment === 'monogram' && (
            <span className="mono" style={{ background: o.color }}>{(o.org_code ?? o.name).slice(0, 2).toUpperCase()}</span>
          )}
          <strong>{o.org_code ?? '—'}</strong>&nbsp;{o.name}
          {o.is_home && <span className="home-tag">home</span>}
        </span>
      ))}
    </div>
  );
}
