import { Board, Card, ObsNode } from '../types';
import { childrenOf, liveCards, pointsRollup } from '../lib/board';
import { formatEstimate } from '../lib/estimate';
import { Mode } from '../lib/prefs';
import Coach from './Coach';
import Footer from './Footer';

type Props = {
  board: Board;
  mode: Mode;
  dismissed: Record<string, boolean>;
  onDismiss: (id: string) => void;
  onOpenCard: (id: string) => void;
  onEditNode: (id: string) => void;
};

type Lane = { id: string; name: string; kind: ObsNode['kind'] | 'unassigned'; depth: number };

export default function SwimlaneView({ board, mode, dismissed, onDismiss, onOpenCard, onEditNode }: Props) {
  // Lanes: a depth-first walk of the OBS (orgs → business units → individuals).
  const lanes: Lane[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const n of childrenOf(board, parentId)) {
      lanes.push({ id: n.id, name: n.name || '(unnamed)', kind: n.kind, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  lanes.push({ id: '__unassigned__', name: 'Unassigned', kind: 'unassigned', depth: 0 });

  // Global priority order (decreasing): by column order, then position in column.
  // 'waiting' cards are not actionable yet, so they sort to the far right.
  const colIndex = new Map(board.settings.columns.map((c, i) => [c.id, i]));
  const rank = (c: Card) => (c.column === 'waiting' ? board.settings.columns.length : colIndex.get(c.column) ?? board.settings.columns.length);
  const ordered: Card[] = liveCards(board)
    .filter(c => !c.parent_id)
    .sort((a, b) => (rank(a) - rank(b)) || (a.sort_order - b.sort_order));

  const colLabel = (id: string) => (id === 'waiting' ? 'Waiting' : board.settings.columns.find(c => c.id === id)?.label ?? id);
  const estLabel = (c: Card) => (board.settings.estimate_method === 'points'
    ? `${pointsRollup(board, c) ?? 0} pts`
    : formatEstimate(c.estimate, board.settings.estimate_method));
  const inLane = (lane: Lane, t: Card) =>
    lane.kind === 'unassigned' ? t.assignees.length === 0 : t.assignees.includes(lane.id);

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Swimlanes</h2>
        <p className="muted">Each row is an organization, business unit or person. Within a lane the tasks are packed left→right in the expected order of completion (decreasing priority) — it is not a timeline.</p>
      </div>

      <Coach id="swim" mode={mode} dismissed={dismissed} onDismiss={onDismiss}>
        A task sits in the lane of every OBS node it's assigned to, ordered by priority within that lane. Assign work on the <strong>Kanban board</strong>; click a lane label to edit that node, or a chip to open the task.
      </Coach>

      {ordered.length === 0
        ? <div className="panel"><p className="muted">No tasks yet. Add cards on the Kanban board.</p></div>
        : (
          <div className="swim">
            {lanes.map(lane => {
              const laneTasks = ordered.filter(t => inLane(lane, t));
              const editable = lane.kind !== 'unassigned';
              return (
                <div className="swim-row" key={lane.id}>
                  <div
                    className={`swim-lane k-${lane.kind}${editable ? ' clickable' : ''}`}
                    style={{ paddingLeft: 8 + lane.depth * 16 }}
                    title={editable ? `${lane.name} — click to edit` : lane.name}
                    onClick={editable ? () => onEditNode(lane.id) : undefined}
                  >
                    <span className="swim-lane-mark">{lane.kind === 'organization' ? '▣' : lane.kind === 'unit' ? '▤' : lane.kind === 'individual' ? '•' : '∅'}</span>
                    {lane.name}
                  </div>
                  <div className="swim-track">
                    {laneTasks.length === 0
                      ? <span className="swim-empty">—</span>
                      : laneTasks.map((t, i) => (
                        <button className={`swim-chip${t.column === 'waiting' ? ' waiting' : ''}`} key={t.id} onClick={() => onOpenCard(t.id)} title={`${t.title} · ${colLabel(t.column)}`}>
                          <span className="swim-chip-prio">{t.column === 'waiting' ? '⏸' : i + 1}</span>
                          <span className="swim-chip-body">
                            <span className="swim-chip-title">{t.title}</span>
                            <span className="swim-chip-est">{estLabel(t)} · {colLabel(t.column)}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <Footer />
    </div>
  );
}
