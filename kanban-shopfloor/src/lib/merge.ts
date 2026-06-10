import { Board, Card, CardEvent, ObsNode, Story, Versioned } from '../types';

// ─── Conflict-safe merge of two board documents ─────────────────────────────
// Strategy: last-writer-wins per entity, keyed by id, ordered by (rev,
// updated_at, actor). Tombstones (deleted) participate like any other version,
// so a delete on one side beats an older edit on the other and an old file can
// never resurrect a removed item. Card event logs are unioned by event id, so
// the flow history is never lost. The merge is commutative and idempotent:
// importing the same file twice changes nothing.

export interface MergeSummary {
  unchanged: number;
  updated: number;
  added: number;
  removed: number;   // entities that became (or stayed) tombstoned via the merge
}

// Pick the winning version of two records describing the same entity.
function pickNewer<T extends Versioned>(a: T, b: T): T {
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b;
  if (a.updated_at !== b.updated_at) return a.updated_at > b.updated_at ? a : b;
  return a.actor >= b.actor ? a : b; // deterministic final tiebreak
}

interface EntityMerge<T extends Versioned> { merged: T[]; summary: MergeSummary; }

function mergeEntities<T extends Versioned & { id: string }>(
  local: T[], incoming: T[], combine?: (winner: T, a: T, b: T) => T,
): EntityMerge<T> {
  const byId = new Map<string, T>();
  for (const e of local) byId.set(e.id, e);

  const summary: MergeSummary = { unchanged: 0, updated: 0, added: 0, removed: 0 };

  for (const inc of incoming) {
    const cur = byId.get(inc.id);
    if (!cur) {
      byId.set(inc.id, inc);
      if (inc.deleted) summary.removed++; else summary.added++;
      continue;
    }
    let winner = pickNewer(cur, inc);
    if (combine) winner = combine(winner, cur, inc);
    byId.set(inc.id, winner);
    if (winner === cur && !changed(cur, inc)) summary.unchanged++;
    else if (winner.deleted && !cur.deleted) summary.removed++;
    else summary.updated++;
  }
  return { merged: [...byId.values()], summary };
}

function changed<T extends Versioned>(a: T, b: T): boolean {
  return a.rev !== b.rev || a.updated_at !== b.updated_at || !!a.deleted !== !!b.deleted;
}

// Cards additionally union their append-only event logs onto the winning record.
function combineCard(winner: Card, a: Card, b: Card): Card {
  const seen = new Map<string, CardEvent>();
  for (const ev of [...a.events, ...b.events]) if (!seen.has(ev.id)) seen.set(ev.id, ev);
  const events = [...seen.values()].sort((x, y) => x.at.localeCompare(y.at));
  return { ...winner, events };
}

export interface BoardMergeResult {
  board: Board;
  obs: MergeSummary;
  cards: MergeSummary;
  stories: MergeSummary;
  /** true when the incoming file's board scalars are older than ours. */
  incomingIsStale: boolean;
}

export function mergeBoards(local: Board, incoming: Board): BoardMergeResult {
  const obs = mergeEntities<ObsNode>(local.obs, incoming.obs);
  const cards = mergeEntities<Card>(local.cards, incoming.cards, combineCard);
  const stories = mergeEntities<Story>(local.stories ?? [], incoming.stories ?? []);

  // Board-level scalars (name, subtitle, settings) use the same LWW rule.
  const scalarWinner = pickNewer(local, incoming);
  const incomingIsStale = scalarWinner === local && changed(local, incoming);

  const board: Board = {
    ...scalarWinner,
    obs: obs.merged,
    cards: cards.merged,
    stories: stories.merged,
    // The merged document supersedes both inputs.
    rev: Math.max(local.rev, incoming.rev),
    updated_at: new Date().toISOString(),
  };

  return { board, obs: obs.summary, cards: cards.summary, stories: stories.summary, incomingIsStale };
}

// Count of live (non-tombstoned) entities, for "X kept-both / Y added" displays.
export function liveCount(summary: MergeSummary): number {
  return summary.added + summary.updated + summary.unchanged - summary.removed;
}
