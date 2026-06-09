# Kanban Shopfloor

A **cross-corporate, purely-local** Kanban board — a Project Business Foundation
browser tool. Runs entirely in the browser; the board lives in `localStorage`
and travels as a versioned JSON file. No backend, no accounts, no network calls.

Self-contained (own build); intended to be lifted into its own repo and embedded
under `project-business.org/tools/kanban-shopfloor`.

## Develop
```bash
npm install
npm run dev      # local dev server
npm run build    # static build → dist/ (relative asset paths, embeddable)
```

## Architecture
- `src/types.ts` — domain model (board, OBS, cards, estimates, events). Every
  mergeable entity carries `(rev, actor, updated_at)` + tombstones.
- `src/lib/merge.ts` — conflict-safe last-writer-wins merge of two board files
  (event logs unioned, idempotent, stale-file detection). This is what makes
  file-passing safe instead of destructive.
- `src/lib/estimate.ts` — T-shirt (counted), story points (summed), 3-point PERT
  across time/workload/cost.
- `src/lib/dates.ts` — deadline (latest) vs milestone (planned) warnings.
- `src/lib/board.ts` — columns, per-column priority, WIP limit, OBS resolution.
- `src/lib/persist.ts` — localStorage + JSON file import (merge) / export.
- `src/theme.css` + `DESIGN.md` — PBF family chrome + the Shopfloor accent.

## Status
Increment 1: data model, merge engine, estimates/dates libs, persistence, and a
themed board shell (add card, move via column select, Save/Load/Reset, WIP limit,
priority numbers, OBS pills, schedule warnings).

Next: drag-and-drop, card detail modal (story/estimate/dates/assignees/links),
OBS tree editor + legend, and the board-wide Kanban metrics view.
