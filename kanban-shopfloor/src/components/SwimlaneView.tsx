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

  // Tasks (top-level) ordered left→right by decreasing priority:
  // by column order, then by position within the column.
  const colIndex = new Map(board.settings.columns.map((c, i) => [c.id, i]));
  const tasks: Card[] = liveCards(board)
    .filter(c => !c.parent_id)
    .sort((a, b) => (colIndex.get(a.column)! - colIndex.get(b.column)!) || (a.sort_order - b.sort_order));

  const colLabel = (id: string) => board.settings.columns.find(c => c.id === id)?.label ?? id;
  const estLabel = (c: Card) => (board.settings.estimate_method === 'points'
    ? `${pointsRollup(board, c) ?? 0} pts`
    : formatEstimate(c.estimate, board.settings.estimate_method));

  const inLane = (lane: Lane, t: Card) =>
    lane.kind === 'unassigned' ? t.assignees.length === 0 : t.assignees.includes(lane.id);

  const gridCols = `220px repeat(${tasks.length}, 150px)`;

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Swimlanes</h2>
        <p className="muted">Who is assigned what. Each row is an organization, business unit or person; each column is a task, ordered left→right by decreasing priority (not a timeline).</p>
      </div>

      <Coach id="swim" mode={mode} dismissed={dismissed} onDismiss={onDismiss}>
        A task appears in the lane of every OBS node it's assigned to. Assign work on the <strong>Kanban board</strong> (click a card) and it lands here. Click any chip to open the task.
      </Coach>

      {tasks.length === 0
        ? <div className="panel"><p className="muted">No tasks yet. Add cards on the Kanban board.</p></div>
        : (
          <div className="swim">
            <div className="swim-grid" style={{ gridTemplateColumns: gridCols }}>
              <div className="swim-corner">Lane \ priority →</div>
              {tasks.map((t, i) => (
                <div className="swim-head" key={t.id}><span className="swim-prio">#{i + 1}</span><span className="swim-col">{colLabel(t.column)}</span></div>
              ))}
              {lanes.map(lane => (
                <RowFragment key={lane.id} lane={lane} tasks={tasks} inLane={inLane} estLabel={estLabel} onOpenCard={onOpenCard} onEditNode={onEditNode} />
              ))}
            </div>
          </div>
        )}
      <Footer />
    </div>
  );
}

function RowFragment({
  lane, tasks, inLane, estLabel, onOpenCard, onEditNode,
}: {
  lane: Lane;
  tasks: Card[];
  inLane: (lane: Lane, t: Card) => boolean;
  estLabel: (c: Card) => string;
  onOpenCard: (id: string) => void;
  onEditNode: (id: string) => void;
}) {
  const editable = lane.kind !== 'unassigned';
  return (
    <>
      <div
        className={`swim-lane k-${lane.kind}${editable ? ' clickable' : ''}`}
        style={{ paddingLeft: 8 + lane.depth * 16 }}
        title={editable ? `${lane.name} — click to edit` : lane.name}
        onClick={editable ? () => onEditNode(lane.id) : undefined}
      >
        <span className="swim-lane-mark">{lane.kind === 'organization' ? '▣' : lane.kind === 'unit' ? '▤' : lane.kind === 'individual' ? '•' : '∅'}</span>
        {lane.name}
      </div>
      {tasks.map(t => (
        <div className="swim-cell" key={t.id}>
          {inLane(lane, t) && (
            <button className="swim-chip" onClick={() => onOpenCard(t.id)} title={t.title}>
              <span className="swim-chip-title">{t.title}</span>
              <span className="swim-chip-est">{estLabel(t)}</span>
            </button>
          )}
        </div>
      ))}
    </>
  );
}
