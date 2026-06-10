import { Board } from '../types';
import { assigneeLabel, cardsInColumn, liveCards, nodeById, orgOf, organizations } from '../lib/board';
import { pointsTotal, threePointTotals, tshirtDistribution } from '../lib/estimate';
import { cardWarnings } from '../lib/dates';

const round = (n: number) => Math.round(n * 100) / 100;

// Resolve the organization an assignee (an ObsNode id) belongs to.
function orgIdOfAssignee(board: Board, a: string): string | null {
  const node = nodeById(board, a);
  if (!node) return null;
  return orgOf(board, node)?.id ?? null;
}

export default function Metrics({ board, onClose }: { board: Board; onClose: () => void }) {
  const cards = liveCards(board).filter(c => !c.parent_id); // top-level work for rollups
  const method = board.settings.estimate_method;
  const cols = board.settings.columns;
  const maxCol = Math.max(1, ...cols.map(c => cardsInColumn(board, c.id).length));
  const warned = liveCards(board).filter(c => cardWarnings(c).length > 0).length;

  const orgs = organizations(board);
  const orgLoad = new Map<string, number>(orgs.map(o => [o.id, 0]));
  let unassigned = 0;
  for (const c of liveCards(board)) {
    if (c.assignees.length === 0) { unassigned++; continue; }
    const touched = new Set<string>();
    for (const a of c.assignees) { const oid = orgIdOfAssignee(board, a); if (oid) touched.add(oid); }
    for (const oid of touched) orgLoad.set(oid, (orgLoad.get(oid) ?? 0) + 1);
  }
  const tp = threePointTotals(cards);
  const total = liveCards(board).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>Board metrics</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">
          <div className="metric-grid">
            <div className="stat"><span className="stat-num">{total}</span><span className="stat-lbl">cards</span></div>
            <div className="stat"><span className="stat-num">{cardsInColumn(board, board.settings.wip_column_id).length}{board.settings.wip_limit != null ? ` / ${board.settings.wip_limit}` : ''}</span><span className="stat-lbl">in WIP</span></div>
            <div className="stat"><span className="stat-num">{cardsInColumn(board, 'done').length}</span><span className="stat-lbl">done</span></div>
            <div className={`stat${warned ? ' stat-danger' : ''}`}><span className="stat-num">{warned}</span><span className="stat-lbl">schedule warnings</span></div>
          </div>

          <h3 className="metric-h">Flow distribution</h3>
          <div className="bars">
            {cols.map(col => {
              const n = cardsInColumn(board, col.id).length;
              return (
                <div className="bar-row" key={col.id}>
                  <span className="bar-label">{col.label}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(n / maxCol) * 100}%` }} /></span>
                  <span className="bar-val">{n}</span>
                </div>
              );
            })}
          </div>

          <h3 className="metric-h">Estimate rollup ({method})</h3>
          {method === 'points' && <p className="metric-line">Total story points: <strong>{pointsTotal(cards)}</strong></p>}
          {method === 'three_point' && <p className="metric-line">Expected (PERT) — time <strong>{round(tp.time)}</strong> · workload <strong>{round(tp.workload)}</strong> · cost <strong>{round(tp.cost)}</strong></p>}
          {(method === 'tshirt5' || method === 'tshirt7') && (
            <div className="bars">
              {tshirtDistribution(cards, method).map(d => (
                <div className="bar-row" key={d.size}>
                  <span className="bar-label">{d.size}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.count / Math.max(1, cards.length)) * 100}%` }} /></span>
                  <span className="bar-val">{d.count}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="metric-h">Workload by organization</h3>
          <div className="bars">
            {orgs.map(o => (
              <div className="bar-row" key={o.id}>
                <span className="bar-label">{o.org_code ?? o.name}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${((orgLoad.get(o.id) ?? 0) / Math.max(1, total)) * 100}%`, background: o.color }} /></span>
                <span className="bar-val">{orgLoad.get(o.id) ?? 0}</span>
              </div>
            ))}
            {unassigned > 0 && (
              <div className="bar-row">
                <span className="bar-label muted">Unassigned</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(unassigned / Math.max(1, total)) * 100}%`, background: '#aab2c0' }} /></span>
                <span className="bar-val">{unassigned}</span>
              </div>
            )}
          </div>

          {total > 0 && (
            <p className="metric-foot muted">
              Top assignee:{' '}
              {(() => {
                const counts = new Map<string, number>();
                for (const c of liveCards(board)) for (const a of c.assignees) counts.set(a, (counts.get(a) ?? 0) + 1);
                const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
                return top ? `${assigneeLabel(board, top[0])} (${top[1]})` : '—';
              })()}
            </p>
          )}
        </div>
        <div className="modal-foot"><span className="spacer" /><button className="btn btn-primary btn-sm" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
