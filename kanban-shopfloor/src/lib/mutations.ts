// ─── Merge-safe board mutations ─────────────────────────────────────────────
// Every mutation returns a NEW board and obeys the merge contract: bump the
// Lamport rev via stamp(), delete by tombstone, and append to the append-only
// card event log for structural/flow events. Field edits only stamp.

import {
  Assignee, Board, Card, CardConstraint, CardEvent, CardEventType,
  ConstraintDef, ObsKind, ObsNode, Story, UnitType,
} from '../types';
import { cardsInColumn, nextObsColor, stamp, uid } from './board';

function ev(type: CardEventType, by: string, extra: Partial<CardEvent> = {}): CardEvent {
  return { id: uid(), type, at: new Date().toISOString(), by, ...extra };
}

function sortOrderFor(board: Board, toColumn: string, beforeId: string | null, excludeId: string): number {
  const list = cardsInColumn(board, toColumn).filter(c => c.id !== excludeId);
  const idx = beforeId ? list.findIndex(c => c.id === beforeId) : list.length;
  const at = idx === -1 ? list.length : idx;
  const prev = at > 0 ? list[at - 1].sort_order : null;
  const next = at < list.length ? list[at].sort_order : null;
  if (prev == null && next == null) return Date.now();
  if (prev == null) return next! - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

// ─── Cards ─────────────────────────────────────────────────────────────────
export function addCard(board: Board, opts: { title: string; column?: string; parent_id?: string | null }, actor: string): Board {
  const now = new Date().toISOString();
  const card: Card = stamp({
    id: uid(), type: 'task', title: opts.title.trim() || 'Untitled', column: opts.column ?? 'todo',
    sort_order: Date.now(), body: '', story_id: null, parent_id: opts.parent_id ?? null,
    assignees: [], links: [], constraints: [], dor: [], dod: [],
    events: [ev('created', actor)], rev: 0, actor, updated_at: now,
  } as Card, actor);
  return { ...stamp(board, actor), cards: [...board.cards, card] };
}

export function patchCard(board: Board, id: string, patch: Partial<Card>, actor: string): Board {
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => (c.id === id ? stamp({ ...c, ...patch }, actor) : c)),
  };
}

export function placeCard(board: Board, id: string, toColumn: string, beforeId: string | null, actor: string): Board {
  const card = board.cards.find(c => c.id === id);
  if (!card) return board;
  const movedColumn = card.column !== toColumn;
  const sort_order = sortOrderFor(board, toColumn, beforeId, id);
  const events = movedColumn ? [...card.events, ev('moved', actor, { from: card.column, to: toColumn })] : card.events;
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => (c.id === id ? stamp({ ...c, column: toColumn, sort_order, events }, actor) : c)),
  };
}

export function setAssignees(board: Board, id: string, assignees: Assignee[], actor: string): Board {
  const card = board.cards.find(c => c.id === id);
  if (!card) return board;
  const added = assignees.some(a => !card.assignees.includes(a));
  const removed = card.assignees.some(a => !assignees.includes(a));
  const events = [...card.events];
  if (added) events.push(ev('assigned', actor));
  if (removed) events.push(ev('unassigned', actor));
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => (c.id === id ? stamp({ ...c, assignees, events }, actor) : c)),
  };
}

export function toggleConstraint(board: Board, cardId: string, defId: string, actor: string): Board {
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return board;
  const has = card.constraints.some(x => x.id === defId);
  const constraints: CardConstraint[] = has
    ? card.constraints.filter(x => x.id !== defId)
    : [...card.constraints, { id: defId, note: '' }];
  return patchCard(board, cardId, { constraints }, actor);
}

export function setConstraintNote(board: Board, cardId: string, defId: string, note: string, actor: string): Board {
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return board;
  const constraints = card.constraints.map(x => (x.id === defId ? { ...x, note } : x));
  return patchCard(board, cardId, { constraints }, actor);
}

function freshCopy(src: Card, actor: string, overrides: Partial<Card>): Card {
  const now = new Date().toISOString();
  return stamp({
    ...src, id: uid(), sort_order: src.sort_order + 0.5,
    events: [ev('created', actor)], rev: 0, actor, updated_at: now, ...overrides,
  } as Card, actor);
}

export function splitCard(board: Board, id: string, actor: string): Board {
  const src = board.cards.find(c => c.id === id);
  if (!src) return board;
  const sibling = freshCopy(src, actor, { title: `${src.title} (split)`, events: [ev('created', actor), ev('split', actor)] });
  return { ...stamp(board, actor), cards: [...board.cards, sibling] };
}

export function cloneCard(board: Board, id: string, actor: string): Board {
  const src = board.cards.find(c => c.id === id);
  if (!src) return board;
  const copy = freshCopy(src, actor, { title: `${src.title} (copy)`, events: [ev('created', actor), ev('cloned', actor)] });
  return { ...stamp(board, actor), cards: [...board.cards, copy] };
}

export function addSubtask(board: Board, parentId: string, title: string, actor: string): Board {
  const parent = board.cards.find(c => c.id === parentId);
  if (!parent) return board;
  const now = new Date().toISOString();
  const child: Card = stamp({
    id: uid(), type: 'task', title: title.trim() || 'Subtask', column: parent.column,
    sort_order: Date.now(), body: '', story_id: parent.story_id ?? null, parent_id: parentId,
    assignees: [], links: [], constraints: [], dor: [], dod: [],
    events: [ev('created', actor)], rev: 0, actor, updated_at: now,
  } as Card, actor);
  return {
    ...stamp(board, actor),
    cards: [...board.cards.map(c => (c.id === parentId ? stamp({ ...c, events: [...c.events, ev('decomposed', actor)] }, actor) : c)), child],
  };
}

// Delete a card; orphaned subtasks are promoted to top-level (parent_id cleared).
export function deleteCard(board: Board, id: string, actor: string): Board {
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => {
      if (c.id === id) return stamp({ ...c, deleted: true }, actor);
      if (c.parent_id === id) return stamp({ ...c, parent_id: null }, actor);
      return c;
    }),
  };
}

// ─── Stories ─────────────────────────────────────────────────────────────────
export function addStory(board: Board, actor: string, init: Partial<Story> = {}): { board: Board; id: string } {
  const now = new Date().toISOString();
  const story: Story = stamp({
    id: uid(), title: init.title ?? 'New story', role: init.role ?? '', goal: init.goal ?? '',
    benefit: init.benefit ?? '', acceptance: init.acceptance ?? [],
    rev: 0, actor, updated_at: now,
  } as Story, actor);
  return { board: { ...stamp(board, actor), stories: [...board.stories, story] }, id: story.id };
}

export function updateStory(board: Board, id: string, patch: Partial<Story>, actor: string): Board {
  return {
    ...stamp(board, actor),
    stories: board.stories.map(s => (s.id === id ? stamp({ ...s, ...patch }, actor) : s)),
  };
}

// Tombstone a story and unlink any cards that referenced it.
export function deleteStory(board: Board, id: string, actor: string): Board {
  return {
    ...stamp(board, actor),
    stories: board.stories.map(s => (s.id === id ? stamp({ ...s, deleted: true }, actor) : s)),
    cards: board.cards.map(c => (c.story_id === id ? stamp({ ...c, story_id: null }, actor) : c)),
  };
}

// ─── OBS ──────────────────────────────────────────────────────────────────────
export function addObs(
  board: Board,
  opts: { kind: ObsKind; parent_id: string | null; name?: string; unit_type?: UnitType; is_home?: boolean },
  actor: string,
): { board: Board; id: string } {
  const id = uid();
  const node: ObsNode = stamp({
    id,
    kind: opts.kind,
    name: opts.name ?? (opts.kind === 'organization' ? 'New organization' : opts.kind === 'unit' ? 'New unit' : 'New person'),
    parent_id: opts.parent_id,
    is_home: opts.kind === 'organization' ? !!opts.is_home : undefined,
    org_code: opts.kind === 'organization' ? 'ORG' : undefined,
    unit_type: opts.kind === 'unit' ? (opts.unit_type ?? 'department') : undefined,
    color: nextObsColor(board),
    treatment: opts.kind === 'organization' ? 'solid' : undefined,
    rev: 0, actor, updated_at: new Date().toISOString(),
  } as ObsNode, actor);
  return { board: { ...stamp(board, actor), obs: [...board.obs, node] }, id };
}

// Toggle whether an individual is a Project Manager of their organization.
// Multiple PMs per organization are allowed.
export function setProjectManager(board: Board, personId: string, actor: string): Board {
  const person = board.obs.find(n => n.id === personId);
  if (!person || person.kind !== 'individual') return board;
  return {
    ...stamp(board, actor),
    obs: board.obs.map(n => (n.id === personId ? stamp({ ...n, is_pm: !n.is_pm }, actor) : n)),
  };
}

export function updateObs(board: Board, id: string, patch: Partial<ObsNode>, actor: string): Board {
  return {
    ...stamp(board, actor),
    obs: board.obs.map(n => (n.id === id ? stamp({ ...n, ...patch }, actor) : n)),
  };
}

// Insert a customer organization above the home org (home becomes its child).
export function addCustomerAbove(board: Board, homeId: string, actor: string): Board {
  const home = board.obs.find(n => n.id === homeId);
  if (!home) return board;
  const { board: withCustomer, id } = addObs(board, { kind: 'organization', parent_id: home.parent_id, name: 'Customer' }, actor);
  return {
    ...withCustomer,
    obs: withCustomer.obs.map(n => (n.id === homeId ? stamp({ ...n, parent_id: id }, actor) : n)),
  };
}

// Tombstone a node and all its descendants; strip assignees that referenced them.
export function deleteObs(board: Board, id: string, actor: string): Board {
  const removed = new Set<string>();
  const collect = (nid: string) => {
    removed.add(nid);
    for (const n of board.obs) if (n.parent_id === nid && !removed.has(n.id)) collect(n.id);
  };
  collect(id);
  return {
    ...stamp(board, actor),
    obs: board.obs.map(n => (removed.has(n.id) ? stamp({ ...n, deleted: true }, actor) : n)),
    cards: board.cards.map(c => {
      const kept = c.assignees.filter(a => !removed.has(a));
      return kept.length === c.assignees.length ? c : stamp({ ...c, assignees: kept }, actor);
    }),
  };
}

// ─── Board settings & meta ────────────────────────────────────────────────────
export function updateSettings(board: Board, patch: Partial<Board['settings']>, actor: string): Board {
  return stamp({ ...board, settings: { ...board.settings, ...patch } }, actor);
}

export function patchBoardMeta(board: Board, patch: Partial<Pick<Board, 'name' | 'description' | 'image' | 'start_date' | 'end_date'>>, actor: string): Board {
  return stamp({ ...board, ...patch }, actor);
}

export function addConstraintDef(board: Board, label: string, actor: string): Board {
  const def: ConstraintDef = { id: uid(), label: label.trim() || 'Constraint' };
  return updateSettings(board, { constraints: [...board.settings.constraints, def] }, actor);
}
export function updateConstraintDef(board: Board, id: string, label: string, actor: string): Board {
  return updateSettings(board, { constraints: board.settings.constraints.map(c => (c.id === id ? { ...c, label } : c)) }, actor);
}
export function removeConstraintDef(board: Board, id: string, actor: string): Board {
  const b = updateSettings(board, { constraints: board.settings.constraints.filter(c => c.id !== id) }, actor);
  return { ...b, cards: b.cards.map(c => {
    const kept = c.constraints.filter(x => x.id !== id);
    return kept.length === c.constraints.length ? c : stamp({ ...c, constraints: kept }, actor);
  }) };
}
