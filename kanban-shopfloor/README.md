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
npm run embed    # build + emit two embeddable artifacts (see below)
```

## Embedding (project-business.org)
`npm run embed` writes to `dist/embed/`:

- **`kanban-shopfloor.html`** — one self-contained file (CSS + JS inlined, no
  external requests). Use it directly:
  ```html
  <iframe src="kanban-shopfloor.html" style="width:100%;height:100dvh;border:0"></iframe>
  ```
- **`kanban-shopfloor.embed.js`** — a widget you call from any page; it mounts
  the app inside a **style-isolated iframe** (via `srcdoc`), so the family-chrome
  CSS can never collide with the host page:
  ```html
  <div id="kanban"></div>
  <script src="kanban-shopfloor.embed.js"></script>
  <script>KanbanShopfloor.mount('#kanban'); // height defaults to 100dvh</script>
  ```
  `srcdoc` keeps the host origin, so `localStorage` persistence still works.

**Single scrollbar.** The app is a full-height shell: the top bar / toolbar /
legend stay fixed and only the **board** scrolls (vertically for tall columns,
horizontally for many columns). Size the iframe to the space it occupies so the
board is the *only* scroll region — there is no nested page-vs-app scrollbar.
The default height is `100dvh`; if the host page has its own header, pass a
height like `{ height: 'calc(100dvh - 80px)' }` (widget) or set it on the
`<iframe>` so the iframe fits without forcing the page to scroll too.

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
- `src/lib/mutations.ts` — merge-safe board edits (stamp + tombstone + append-only
  card events): move/place, split, clone, delete, assignees, OBS, settings.
- `src/components/` — `CardModal`, `ObsManager`, `ObsLegend`, `Metrics`.
- `src/theme.css` + `DESIGN.md` — PBF family chrome + the Shopfloor accent.

## Status
Increment 1: data model, merge engine, estimates/dates libs, persistence, and a
themed board shell (add card, move via column select, Save/Load/Reset, WIP limit,
priority numbers, OBS pills, schedule warnings).

Increment 2: **drag-and-drop** across/within columns (WIP-enforced, priority via
order); **card detail modal** — type, user story + acceptance criteria, notes,
method-aware estimate (T-shirt / points / 3-point PERT with expected ± σ), dual
**milestone/deadline** dates with warnings, OBS **assignees** (incl. `⊘ anon`),
labelled **links**, **split** (linked sibling) / **clone** (independent copy) /
delete, and a read-only **flow history**; an **OBS tree editor** (orgs → resources,
code/colour/treatment) with a colour **legend**; and a board-wide **Metrics**
panel (flow distribution, estimate rollup, workload by organization, schedule
warnings). All edits stay merge-safe so Save/Load still merges without overwrites.

Next: OBS-driven actor switching (act-as), column configuration, and CFD/flow
metrics over the event log.
