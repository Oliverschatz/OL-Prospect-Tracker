import {
  ANON_PREFIX, Assignee, Board, Card, Column, DEFAULT_COLUMNS, ObsNode, Versioned,
} from '../types';

// ─── Ids & versioning ───────────────────────────────────────────────────────
export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Stamp a mutation: bump the Lamport rev and record who/when.
export function stamp<T extends Versioned>(entity: T, actor: string): T {
  return { ...entity, rev: entity.rev + 1, actor, updated_at: new Date().toISOString() };
}

// ─── Columns & priority ─────────────────────────────────────────────────────
export function liveCards(board: Board): Card[] {
  return board.cards.filter(c => !c.deleted);
}

export function cardsInColumn(board: Board, columnId: string): Card[] {
  return liveCards(board)
    .filter(c => c.column === columnId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

// Position within its column → priority (1 = top = highest).
export function priorityOf(board: Board, card: Card): number {
  return cardsInColumn(board, card.column).findIndex(c => c.id === card.id) + 1;
}

// ─── WIP limit ───────────────────────────────────────────────────────────────
export function wipCount(board: Board): number {
  return cardsInColumn(board, board.settings.wip_column_id).length;
}

export function wipIsFull(board: Board): boolean {
  const { wip_limit } = board.settings;
  return wip_limit != null && wipCount(board) >= wip_limit;
}

// Whether a card may move INTO the WIP column (reordering within WIP is fine).
export function canEnterWip(board: Board, card: Card, toColumn: string): boolean {
  if (toColumn !== board.settings.wip_column_id) return true;
  if (card.column === board.settings.wip_column_id) return true;
  return !wipIsFull(board);
}

// ─── OBS resolution ──────────────────────────────────────────────────────────
export function nodeById(board: Board, id: string): ObsNode | undefined {
  return board.obs.find(n => n.id === id && !n.deleted);
}

export function orgOf(board: Board, node: ObsNode): ObsNode | undefined {
  if (node.kind === 'org') return node;
  return node.parent_id ? nodeById(board, node.parent_id) : undefined;
}

// Human label for an assignee id, incl. the implicit `anon:<orgId>` form.
// e.g. "ACME ▸ Anna" or "ACME ▸ ⊘ anon".
export function assigneeLabel(board: Board, assignee: Assignee): string {
  if (assignee.startsWith(ANON_PREFIX)) {
    const org = nodeById(board, assignee.slice(ANON_PREFIX.length));
    return `${org?.org_code ?? org?.name ?? '??'} ▸ ⊘ anon`;
  }
  const node = nodeById(board, assignee);
  if (!node) return '??';
  if (node.kind === 'org') return `${node.org_code ?? node.name} ▸ ⊘ anon`;
  const org = orgOf(board, node);
  return `${org?.org_code ?? org?.name ?? '—'} ▸ ${node.name}`;
}

export function resources(board: Board): ObsNode[] {
  return board.obs.filter(n => n.kind === 'resource' && !n.deleted);
}
export function organizations(board: Board): ObsNode[] {
  return board.obs.filter(n => n.kind === 'org' && !n.deleted);
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createBoard(
  opts: { name?: string; subtitle?: string } = {},
): Board {
  const now = new Date().toISOString();
  const org: ObsNode = {
    id: uid(), kind: 'org', name: 'My Organization', org_code: 'ORG',
    parent_id: null, color: '#1a2744', treatment: 'solid',
    rev: 1, actor: 'system', updated_at: now,
  };
  const columns: Column[] = DEFAULT_COLUMNS.map(c => ({ ...c }));
  return {
    id: uid(),
    name: opts.name ?? 'New board',
    subtitle: opts.subtitle ?? 'Cross-corporate Kanban board',
    created_at: now,
    settings: {
      estimate_method: 'tshirt5',
      wip_column_id: 'wip',
      wip_limit: null,
      columns,
    },
    obs: [org],
    cards: [],
    rev: 1, actor: 'system', updated_at: now,
  };
}
