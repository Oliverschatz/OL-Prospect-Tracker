import {
  Assignee, Board, Card, Column, DEFAULT_COLUMNS, DEFAULT_CONSTRAINTS,
  ObsNode, Story, UNIT_TYPE_LABELS, Versioned,
} from '../types';

// ─── Ids & versioning ───────────────────────────────────────────────────────
export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function stamp<T extends Versioned>(entity: T, actor: string): T {
  return { ...entity, rev: entity.rev + 1, actor, updated_at: new Date().toISOString() };
}

// ─── Cards: columns & priority ──────────────────────────────────────────────
export function liveCards(board: Board): Card[] {
  return board.cards.filter(c => !c.deleted);
}

export function cardsInColumn(board: Board, columnId: string): Card[] {
  return liveCards(board)
    .filter(c => c.column === columnId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

export function priorityOf(board: Board, card: Card): number {
  return cardsInColumn(board, card.column).findIndex(c => c.id === card.id) + 1;
}

export function subtasksOf(board: Board, cardId: string): Card[] {
  return liveCards(board).filter(c => c.parent_id === cardId);
}

// ─── WIP limit ───────────────────────────────────────────────────────────────
export function wipCount(board: Board): number {
  return cardsInColumn(board, board.settings.wip_column_id).length;
}
export function wipIsFull(board: Board): boolean {
  const { wip_limit } = board.settings;
  return wip_limit != null && wipCount(board) >= wip_limit;
}
export function canEnterWip(board: Board, card: Card, toColumn: string): boolean {
  if (toColumn !== board.settings.wip_column_id) return true;
  if (card.column === board.settings.wip_column_id) return true;
  return !wipIsFull(board);
}

// ─── Stories ──────────────────────────────────────────────────────────────────
export function liveStories(board: Board): Story[] {
  return board.stories.filter(s => !s.deleted);
}
export function storyById(board: Board, id: string | null | undefined): Story | undefined {
  return id ? board.stories.find(s => s.id === id && !s.deleted) : undefined;
}
export function cardsForStory(board: Board, storyId: string): Card[] {
  return liveCards(board).filter(c => c.story_id === storyId);
}

// ─── OBS resolution ──────────────────────────────────────────────────────────
export function liveObs(board: Board): ObsNode[] {
  return board.obs.filter(n => !n.deleted);
}
export function nodeById(board: Board, id: string): ObsNode | undefined {
  return board.obs.find(n => n.id === id && !n.deleted);
}
export function childrenOf(board: Board, parentId: string | null): ObsNode[] {
  return liveObs(board).filter(n => n.parent_id === parentId);
}
export function organizations(board: Board): ObsNode[] {
  return liveObs(board).filter(n => n.kind === 'organization');
}
export function homeOrg(board: Board): ObsNode | undefined {
  return organizations(board).find(o => o.is_home) ?? organizations(board)[0];
}

// The nearest organization at or above a node.
export function orgOf(board: Board, node: ObsNode): ObsNode | undefined {
  let cur: ObsNode | undefined = node;
  while (cur) {
    if (cur.kind === 'organization') return cur;
    cur = cur.parent_id ? nodeById(board, cur.parent_id) : undefined;
  }
  return undefined;
}

// True when a node belongs to the home organization (so it may be detailed with
// units / individuals). External orgs and their people are opaque.
export function isHomeSide(board: Board, node: ObsNode): boolean {
  const org = orgOf(board, node);
  return !!org?.is_home;
}

// The contract-vs-internal nature of the edge from a node to its parent.
export function edgeKindOf(node: ObsNode): 'contract' | 'internal' | null {
  if (!node.parent_id) return null;
  return node.kind === 'organization' ? 'contract' : 'internal';
}

export function nodePath(board: Board, id: string | null): string {
  if (!id) return '';
  const parts: string[] = [];
  let cur = nodeById(board, id);
  let guard = 0;
  while (cur && guard++ < 64) {
    parts.unshift(cur.name || '(unnamed)');
    cur = cur.parent_id ? nodeById(board, cur.parent_id) : undefined;
  }
  return parts.join(' ▸ ');
}

// The individual flagged as an organization's Project Manager, if any.
export function projectManagerOf(board: Board, org: ObsNode): ObsNode | undefined {
  return liveObs(board).find(n => n.kind === 'individual' && n.is_pm && orgOf(board, n)?.id === org.id);
}

// The topmost organization in the contract chain (the end customer / owner).
export function rootOrg(board: Board): ObsNode | undefined {
  let cur = homeOrg(board);
  let guard = 0;
  while (cur && cur.parent_id && guard++ < 64) {
    const parent = nodeById(board, cur.parent_id);
    if (!parent || parent.kind !== 'organization') break;
    cur = parent;
  }
  return cur;
}

// Tier of an organization: 0 = end customer/owner at the top of the chain,
// increasing by one with each contract step downward.
export function orgTier(board: Board, org: ObsNode): number {
  let tier = 0;
  let cur: ObsNode | undefined = org;
  let guard = 0;
  while (cur && cur.parent_id && guard++ < 64) {
    const parent = nodeById(board, cur.parent_id);
    if (!parent || parent.kind !== 'organization') break;
    tier += 1;
    cur = parent;
  }
  return tier;
}

// The organization ancestors of the home org, ordered top (root) → bottom.
export function ancestorsAboveHome(board: Board): ObsNode[] {
  const chain: ObsNode[] = [];
  let cur = homeOrg(board);
  let guard = 0;
  while (cur && cur.parent_id && guard++ < 64) {
    const parent = nodeById(board, cur.parent_id);
    if (!parent || parent.kind !== 'organization') break;
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

// Short, human label for an assignee: "ORG ▸ Name" (org/unit ⇒ "anonymous in").
export function assigneeLabel(board: Board, assignee: Assignee): string {
  const node = nodeById(board, assignee);
  if (!node) return '??';
  const org = orgOf(board, node);
  const prefix = org?.org_code || org?.name || '—';
  if (node.kind === 'individual') return `${prefix} ▸ ${node.name || '(unnamed)'}`;
  if (node.kind === 'organization') return `${node.org_code || node.name} ▸ ⊘ anon`;
  return `${prefix} ▸ ${node.name} ⊘`; // unit ⇒ someone in the unit
}

// Sourcing nature implied purely by what kind of node holds the work.
export function sourcingOf(board: Board, assignee: Assignee): 'own' | 'internal' | 'procured' | null {
  const node = nodeById(board, assignee);
  if (!node) return null;
  if (node.kind === 'individual') return isHomeSide(board, node) ? 'own' : 'procured';
  if (node.kind === 'unit') return 'internal';
  return node.is_home ? 'internal' : 'procured'; // organization
}

const OBS_COLORS = ['#1a2744', '#e07b2c', '#2f6fb0', '#2f9e6f', '#7a4fb0', '#b0532f', '#c0392b', '#1f8a8a'];
export function nextObsColor(board: Board): string {
  return OBS_COLORS[liveObs(board).length % OBS_COLORS.length];
}

export function unitTypeLabel(node: ObsNode): string {
  return node.unit_type ? UNIT_TYPE_LABELS[node.unit_type] : UNIT_TYPE_LABELS.other;
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createBoard(opts: { name?: string; subtitle?: string } = {}): Board {
  const now = new Date().toISOString();
  const home: ObsNode = {
    id: uid(), kind: 'organization', name: 'My Organization', org_code: 'ORG',
    parent_id: null, is_home: true, color: '#1a2744', treatment: 'solid',
    rev: 1, actor: 'system', updated_at: now,
  };
  const columns: Column[] = DEFAULT_COLUMNS.map(c => ({ ...c }));
  return {
    id: uid(),
    name: opts.name ?? 'New board',
    subtitle: opts.subtitle ?? 'Cross-corporate Kanban board',
    description: '',
    start_date: null,
    end_date: null,
    created_at: now,
    settings: {
      estimate_method: 'tshirt5',
      wip_column_id: 'wip',
      wip_limit: null,
      columns,
      definition_of_ready: [],
      definition_of_done: [],
      constraints: DEFAULT_CONSTRAINTS.map(c => ({ ...c })),
    },
    obs: [home],
    stories: [],
    cards: [],
    rev: 1, actor: 'system', updated_at: now,
  };
}

// ─── Migration / normalisation ───────────────────────────────────────────────
// Best-effort upgrade of older (v1) boards so the app never crashes on load or
// after merging an older file. Backfills new fields and renames legacy OBS kinds.
export function normalizeBoard(b: Board): Board {
  if (!b || typeof b !== 'object') return createBoard();
  const out: Board = { ...b };

  out.stories = Array.isArray(b.stories) ? b.stories : [];
  out.description = b.description ?? '';
  out.start_date = b.start_date ?? null;
  out.end_date = b.end_date ?? null;

  const s = (b.settings ?? {}) as Partial<Board['settings']>;
  out.settings = {
    estimate_method: s.estimate_method ?? 'tshirt5',
    wip_column_id: s.wip_column_id ?? 'wip',
    wip_limit: s.wip_limit ?? null,
    columns: Array.isArray(s.columns) && s.columns.length ? s.columns : DEFAULT_COLUMNS.map(c => ({ ...c })),
    definition_of_ready: Array.isArray(s.definition_of_ready) ? s.definition_of_ready : [],
    definition_of_done: Array.isArray(s.definition_of_done) ? s.definition_of_done : [],
    constraints: Array.isArray(s.constraints) && s.constraints.length ? s.constraints : DEFAULT_CONSTRAINTS.map(c => ({ ...c })),
  };

  // OBS: rename legacy kinds ('org' → organization, 'resource' → individual).
  const obs = Array.isArray(b.obs) ? b.obs : [];
  const validUnitTypes = ['division', 'department', 'subsidiary', 'managed_team', 'scrum_team', 'task_force', 'tribe', 'volunteer_team', 'other'];
  out.obs = obs.map(n => {
    const kind = (n.kind as string) === 'org' ? 'organization'
      : (n.kind as string) === 'resource' ? 'individual'
      : n.kind;
    const node = { ...n, kind } as ObsNode;
    if (kind === 'unit' && (!node.unit_type || !validUnitTypes.includes(node.unit_type))) node.unit_type = 'other';
    return node;
  });
  // Ensure at least one organization, and exactly one home org.
  const orgs = out.obs.filter(n => n.kind === 'organization' && !n.deleted);
  if (orgs.length === 0) {
    out.obs = [...out.obs, createBoard().obs[0]];
  } else if (!orgs.some(o => o.is_home)) {
    out.obs = out.obs.map(n => (n.id === orgs[0].id ? { ...n, is_home: true } : n));
  }

  // Cards: backfill new arrays/fields; drop any legacy embedded story object.
  const cards = Array.isArray(b.cards) ? b.cards : [];
  out.cards = cards.map(c => {
    const { story: _legacyStory, ...rest } = c as Card & { story?: unknown };
    return {
      ...rest,
      type: c.type ?? 'task',
      assignees: Array.isArray(c.assignees) ? c.assignees : [],
      links: Array.isArray(c.links) ? c.links : [],
      constraints: Array.isArray((c as Card).constraints) ? (c as Card).constraints : [],
      dor: Array.isArray((c as Card).dor) ? (c as Card).dor : [],
      dod: Array.isArray((c as Card).dod) ? (c as Card).dod : [],
      events: Array.isArray(c.events) ? c.events : [],
      story_id: c.story_id ?? null,
      parent_id: c.parent_id ?? null,
    } as Card;
  });

  return out;
}

// Effective story points: when a card has subtasks, its points are the sum of
// the subtasks' (recursively rolled-up) points; otherwise its own points.
export function pointsRollup(board: Board, card: Card): number | null {
  const subs = subtasksOf(board, card.id);
  if (subs.length) {
    return subs.reduce((sum, s) => sum + (pointsRollup(board, s) ?? 0), 0);
  }
  return card.estimate?.points ?? null;
}
