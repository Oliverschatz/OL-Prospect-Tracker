// ─── Kanban Shopfloor — domain model (v2) ───────────────────────────────────
// Pure data; the whole board is a single JSON document that lives in the
// browser and travels as a file. Every mergeable entity carries
// (rev, actor, updated_at) for last-writer-wins merging; deletes are tombstones.
//
// v2 reworks the OBS into an asymmetric tree (one detailed "home" organization;
// other organizations are opaque boxes with only the people you know), promotes
// user stories to first-class entities (many cards per story), adds card
// decomposition (subtasks), board-level Definition of Ready / Done, and an
// extensible per-card constraints list.

export const SCHEMA = 'kanban-shopfloor' as const;
export const FILE_VERSION = 2;

export interface Versioned {
  rev: number;
  actor: string;
  updated_at: string;
  deleted?: boolean;
}

// ─── Estimation ──────────────────────────────────────────────────────────────
export type EstimateMethod = 'tshirt5' | 'tshirt7' | 'points' | 'three_point';
export const TSHIRT5 = ['XS', 'S', 'M', 'L', 'XL'] as const;
export const TSHIRT7 = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type TshirtSize = (typeof TSHIRT7)[number];
export interface ThreePoint { o: number; m: number; p: number; }
export interface Estimate {
  size?: TshirtSize | null;
  points?: number | null;
  time?: ThreePoint | null;
  workload?: ThreePoint | null;
  cost?: ThreePoint | null;
}

// ─── OBS (Organizational Breakdown Structure) ───────────────────────────────
// Three node kinds joined into one tree. The edge to a node's parent is a
// "contract" when the node is an organization (crosses an org boundary) and an
// "internal agreement" (assignment / self-assignment) otherwise.
//
// Exactly one organization is the "home" org: only it and its descendants get
// the full unit→sub-unit→individual breakdown. Every other organization is
// opaque — a box plus whatever individuals you happen to know.
export type ObsKind = 'organization' | 'unit' | 'individual';
export type UnitType = 'unit' | 'managed_team' | 'scrum_team';
export type ObsTreatment = 'solid' | 'dashed' | 'dotted' | 'double' | 'monogram';

export interface Contact {
  email?: string;
  phone?: string;     // phone / WhatsApp
  linkedin?: string;
}

export interface ObsNode extends Versioned {
  id: string;
  kind: ObsKind;
  name: string;
  parent_id: string | null;
  is_home?: boolean;        // organizations: exactly one is the own ("home") org
  org_code?: string;        // organizations: short label shown on pills
  contract_label?: string;  // external orgs: the contract/PO they were engaged under
  unit_type?: UnitType;     // units
  color?: string;
  treatment?: ObsTreatment; // organizations: non-colour cue
  contact?: Contact;        // contact person details
  info?: string;            // free-text catch-all (esp. for external individuals)
}

// An assignee is an ObsNode id. Assigning to a unit/organization means "someone
// in there" (anonymous); assigning to an individual names the person.
export type Assignee = string;

// ─── User stories (one story → many cards) ──────────────────────────────────
export interface Story extends Versioned {
  id: string;
  title: string;
  role: string;
  goal: string;
  benefit: string;
  acceptance: string[];
}

// ─── Cards (work packages) ───────────────────────────────────────────────────
export type CardType = 'task' | 'story' | 'bug';
export interface CardLink { id: string; label: string; url: string; }

export type CardEventType =
  | 'created' | 'moved' | 'assigned' | 'unassigned'
  | 'estimated' | 'edited' | 'split' | 'cloned' | 'decomposed';

export interface CardEvent {
  id: string;
  type: CardEventType;
  from?: string;
  to?: string;
  at: string;
  by: string;
}

// An active constraint on a card; `id` references a BoardSettings.constraints def.
export interface CardConstraint { id: string; note: string; }

export interface Card extends Versioned {
  id: string;
  type: CardType;
  title: string;
  column: string;
  sort_order: number;       // position within column → priority (1 = top)
  body: string;
  story_id?: string | null; // link to a Story (many cards may share one)
  parent_id?: string | null;// decomposition: this card is a subtask of parent_id
  estimate?: Estimate | null;
  deadline?: string | null; // ISO date — latest acceptable
  milestone?: string | null;// ISO date — planned / expected
  assignees: Assignee[];
  links: CardLink[];
  constraints: CardConstraint[];
  events: CardEvent[];
}

// ─── Board ─────────────────────────────────────────────────────────────────
export interface Column { id: string; label: string; }
export interface ConstraintDef { id: string; label: string; }

export interface BoardSettings {
  estimate_method: EstimateMethod;
  wip_column_id: string;
  wip_limit: number | null;
  columns: Column[];
  definition_of_ready: string[];
  definition_of_done: string[];
  constraints: ConstraintDef[];
}

export interface Board extends Versioned {
  id: string;
  name: string;
  subtitle: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  settings: BoardSettings;
  obs: ObsNode[];
  stories: Story[];
  cards: Card[];
}

export interface BoardFile {
  schema: typeof SCHEMA;
  file_version: number;
  exported_at: string;
  exported_by: string;
  base_hash?: string;
  board: Board;
}

export const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', label: 'To do' },
  { id: 'wip', label: 'WIP' },
  { id: 'review', label: 'For review' },
  { id: 'done', label: 'Done' },
];

// Flow-metric clock anchors (board-wide):
//   lead time  = enters first column ("todo") → enters "done"
//   cycle time = enters "wip"                 → enters "done"
export const COMMIT_COLUMN = 'todo';
export const START_COLUMN = 'wip';
export const DONE_COLUMN = 'done';

export const DEFAULT_CONSTRAINTS: ConstraintDef[] = [
  { id: 'safety_critical', label: 'Safety-critical' },
  { id: 'no_ai', label: 'No AI development' },
];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  unit: 'Unit',
  managed_team: 'Managed team',
  scrum_team: 'Self-managed (Scrum) team',
};
