// ─── Merge-safe board mutations ─────────────────────────────────────────────
// Every mutation returns a NEW board and obeys the merge contract: bump the
// Lamport rev via stamp(), delete by tombstone (never array removal), and
// append to the append-only card event log for structural/flow events. Field
// edits only stamp (they are not flow events, so they don't flood the log).

import { Assignee, Board, Card, CardEvent, CardEventType, ObsKind, ObsNode } from '../types';
import { ANON_PREFIX } from '../types';
import { cardsInColumn, stamp, uid } from './board';

function ev(type: CardEventType, by: string, extra: Partial<CardEvent> = {}): CardEvent {
  return { id: uid(), type, at: new Date().toISOString(), by, ...extra };
}

// Find the sort_order that drops a card before `beforeId` (or at the end when
// null) within `toColumn`, ignoring the card being moved.
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

// ─── Card field edits (stamp only, no event) ─────────────────────────────────
export function patchCard(board: Board, id: string, patch: Partial<Card>, actor: string): Board {
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => (c.id === id ? stamp({ ...c, ...patch }, actor) : c)),
  };
}

// ─── Drag / move (records a 'moved' flow event on column change) ─────────────
export function placeCard(board: Board, id: string, toColumn: string, beforeId: string | null, actor: string): Board {
  const card = board.cards.find(c => c.id === id);
  if (!card) return board;
  const movedColumn = card.column !== toColumn;
  const sort_order = sortOrderFor(board, toColumn, beforeId, id);
  const events = movedColumn
    ? [...card.events, ev('moved', actor, { from: card.column, to: toColumn })]
    : card.events;
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c =>
      c.id === id ? stamp({ ...c, column: toColumn, sort_order, events }, actor) : c),
  };
}

// ─── Assignees ───────────────────────────────────────────────────────────────
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

// ─── Split (linked sibling) & clone (independent copy) ───────────────────────
export function splitCard(board: Board, id: string, actor: string): Board {
  const src = board.cards.find(c => c.id === id);
  if (!src) return board;
  const group = src.split_group ?? uid();
  const now = new Date().toISOString();
  const sibling: Card = stamp({
    ...src,
    id: uid(),
    title: `${src.title} (split)`,
    split_group: group,
    sort_order: src.sort_order + 0.5,
    events: [ev('created', actor), ev('split', actor)],
    rev: 0, actor, updated_at: now,
  } as Card, actor);
  return {
    ...stamp(board, actor),
    cards: [
      ...board.cards.map(c =>
        c.id === src.id
          ? stamp({ ...c, split_group: group, events: [...c.events, ev('split', actor)] }, actor)
          : c),
      sibling,
    ],
  };
}

export function cloneCard(board: Board, id: string, actor: string): Board {
  const src = board.cards.find(c => c.id === id);
  if (!src) return board;
  const now = new Date().toISOString();
  const copy: Card = stamp({
    ...src,
    id: uid(),
    title: `${src.title} (copy)`,
    split_group: null, // a clone is independent, not a split sibling
    sort_order: src.sort_order + 0.5,
    events: [ev('created', actor), ev('cloned', actor)],
    rev: 0, actor, updated_at: now,
  } as Card, actor);
  return {
    ...stamp(board, actor),
    cards: [...board.cards.map(c => (c.id === src.id ? stamp({ ...c, events: [...c.events, ev('cloned', actor)] }, actor) : c)), copy],
  };
}

// ─── Delete (tombstone) ──────────────────────────────────────────────────────
export function deleteCard(board: Board, id: string, actor: string): Board {
  return {
    ...stamp(board, actor),
    cards: board.cards.map(c => (c.id === id ? stamp({ ...c, deleted: true }, actor) : c)),
  };
}

// ─── OBS mutations ───────────────────────────────────────────────────────────
const OBS_COLORS = ['#1a2744', '#e07b2c', '#2f6fb0', '#2f9e6f', '#7a4fb0', '#b0532f', '#c0392b', '#1f8a8a'];

export function addObs(
  board: Board,
  opts: { kind: ObsKind; parent_id: string | null; name?: string },
  actor: string,
): Board {
  const node: ObsNode = stamp({
    id: uid(),
    kind: opts.kind,
    name: opts.name ?? (opts.kind === 'org' ? 'New organization' : 'New resource'),
    org_code: opts.kind === 'org' ? 'ORG' : undefined,
    parent_id: opts.parent_id,
    color: OBS_COLORS[board.obs.length % OBS_COLORS.length],
    treatment: opts.kind === 'org' ? 'solid' : undefined,
    rev: 0, actor, updated_at: new Date().toISOString(),
  } as ObsNode, actor);
  return { ...stamp(board, actor), obs: [...board.obs, node] };
}

export function updateObs(board: Board, id: string, patch: Partial<ObsNode>, actor: string): Board {
  return {
    ...stamp(board, actor),
    obs: board.obs.map(n => (n.id === id ? stamp({ ...n, ...patch }, actor) : n)),
  };
}

// Tombstone a node (and, for an org, its resource children), then strip any
// assignee references to the removed ids from every card.
export function deleteObs(board: Board, id: string, actor: string): Board {
  const node = board.obs.find(n => n.id === id);
  if (!node) return board;
  const removedIds = new Set<string>([id]);
  if (node.kind === 'org') {
    for (const n of board.obs) if (n.parent_id === id && n.kind === 'resource') removedIds.add(n.id);
  }
  const strip = (a: Assignee) =>
    !removedIds.has(a) && !(a.startsWith(ANON_PREFIX) && removedIds.has(a.slice(ANON_PREFIX.length)));
  return {
    ...stamp(board, actor),
    obs: board.obs.map(n => (removedIds.has(n.id) ? stamp({ ...n, deleted: true }, actor) : n)),
    cards: board.cards.map(c => {
      const kept = c.assignees.filter(strip);
      return kept.length === c.assignees.length ? c : stamp({ ...c, assignees: kept }, actor);
    }),
  };
}

// ─── Board settings ──────────────────────────────────────────────────────────
export function updateSettings(board: Board, patch: Partial<Board['settings']>, actor: string): Board {
  return stamp({ ...board, settings: { ...board.settings, ...patch } }, actor);
}

export function renameBoard(board: Board, name: string, actor: string): Board {
  return stamp({ ...board, name }, actor);
}
