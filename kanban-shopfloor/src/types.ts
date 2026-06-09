// ─── Kanban Shopfloor — domain model ───────────────────────────────────────
// Pure data. The whole board is a single JSON document that lives in the
// browser and travels as a file. Every mergeable entity carries (rev, actor,
// updated_at) for last-writer-wins merging, and deletes leave a tombstone so
// re-importing an old file can never resurrect removed items.

export const SCHEMA = 'kanban-shopfloor' as const;
export const FILE_VERSION = 1;

// ─── Merge metadata mixed into every mergeable entity ───────────────────────
export interface Versioned {
  rev: number;          // Lamport-style counter, bumped on each local change
  actor: string;        // OBS path of who made the change (e.g. "ACME ▸ Anna")
  updated_at: string;   // ISO timestamp (merge tiebreaker after rev)
  deleted?: boolean;    // tombstone
}

// ─── Estimation ─────────────────────────────────────────────────────────────
export type EstimateMethod = 'tshirt5' | 'tshirt7' | 'points' | 'three_point';

export const TSHIRT5 = ['XS', 'S', 'M', 'L', 'XL'] as const;
export const TSHIRT7 = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type TshirtSize = (typeof TSHIRT7)[number];

// One PERT triple. expected = (o + 4m + p) / 6.
export interface ThreePoint { o: number; m: number; p: number; }

// A card stores whatever the board's active method needs; unused fields stay null.
export interface Estimate {
  size?: TshirtSize | null;     // tshirt5 / tshirt7
  points?: number | null;       // story points (Fibonacci)
  time?: ThreePoint | null;     // 3-point duration
  workload?: ThreePoint | null; // 3-point effort
  cost?: ThreePoint | null;     // 3-point cost
}

// ─── OBS (Organizational Breakdown Structure) ───────────────────────────────
// A tree of two node kinds. Orgs nest; resources are named leaves under one org.
// Each org has an implicit "anonymous" assignee referenced as `anon:<orgId>`.
export type ObsKind = 'org' | 'resource';

// Non-colour cue so orgs are distinguishable in greyscale / for colour-blind users.
export type ObsTreatment = 'solid' | 'dashed' | 'dotted' | 'double' | 'monogram';

export interface ObsNode extends Versioned {
  id: string;
  kind: ObsKind;
  name: string;
  org_code?: string;            // orgs only — short label shown on pills (e.g. "ACME")
  parent_id: string | null;     // resource → org; org → parent org or null (root)
  color?: string;
  treatment?: ObsTreatment;     // orgs only
}

export const ANON_PREFIX = 'anon:';
export type Assignee = string; // an ObsNode id, or `anon:<orgId>`

// ─── Cards ───────────────────────────────────────────────────────────────────
export type CardType = 'task' | 'story' | 'bug';

export interface Story {
  role: string;
  goal: string;
  benefit: string;
  acceptance: string[];
}

export interface CardLink { id: string; label: string; url: string; }

export type CardEventType =
  | 'created' | 'moved' | 'assigned' | 'unassigned'
  | 'estimated' | 'edited' | 'split' | 'cloned';

// Append-only, machine-readable — the substrate for flow metrics. Merged by union.
export interface CardEvent {
  id: string;
  type: CardEventType;
  from?: string;     // e.g. previous column id
  to?: string;       // e.g. new column id / assignee
  at: string;        // ISO timestamp
  by: string;        // actor OBS path
}

export interface Card extends Versioned {
  id: string;
  type: CardType;
  title: string;
  column: string;                 // column id
  sort_order: number;             // position within column → priority (1 = top)
  body: string;
  story?: Story | null;
  estimate?: Estimate | null;
  deadline?: string | null;       // ISO date — latest acceptable
  milestone?: string | null;      // ISO date — planned / expected
  assignees: Assignee[];
  contract?: { name: string; url?: string } | null;
  links: CardLink[];
  split_group?: string | null;    // links split siblings (clones leave this null)
  events: CardEvent[];
}

// ─── Board ─────────────────────────────────────────────────────────────────
export interface Column { id: string; label: string; }

export interface BoardSettings {
  estimate_method: EstimateMethod;
  wip_column_id: string;          // which column the WIP limit applies to
  wip_limit: number | null;       // null = no limit
  columns: Column[];
  theme?: string;
}

export interface Board extends Versioned {
  id: string;
  name: string;
  subtitle: string;
  created_at: string;
  settings: BoardSettings;
  obs: ObsNode[];
  cards: Card[];
}

// ─── The file envelope written to / read from disk ──────────────────────────
export interface BoardFile {
  schema: typeof SCHEMA;
  file_version: number;
  exported_at: string;
  exported_by: string;            // actor OBS path
  base_hash?: string;             // hash of the ancestor this file derived from
  board: Board;
}

export const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', label: 'To do' },
  { id: 'wip', label: 'WIP' },
  { id: 'review', label: 'For review' },
  { id: 'done', label: 'Done' },
];

// Flow-metric clock anchors (standard definitions, board-wide):
//   lead time  = enters first column ("todo") → enters "done"
//   cycle time = enters "wip"                 → enters "done"
export const COMMIT_COLUMN = 'todo';
export const START_COLUMN = 'wip';
export const DONE_COLUMN = 'done';
