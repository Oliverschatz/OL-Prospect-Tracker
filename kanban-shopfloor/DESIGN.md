# Kanban Shopfloor — visual design

Derived from the five existing Project Business Foundation browser tools
(Cash Radar, Insight Tree, Charter Forge, Change Mill, Risk Foundry). The goal:
**blend in** with the family chrome, **stand out** with one accent + a signature
separator treatment.

## Shared family chrome (blend in)
- **Top bar:** dark navy, full-width. Left = app **name** (bold serif) + small
  **type badge** (accent colour) + muted **subtitle** beneath. Right = action
  **pill buttons**, then the **PBF logo** far right.
- **Header buttons:** rounded pills. A coloured **primary** action, plus the
  family-standard **Load JSON / Save JSON / Reset** (purely-local, file-based).
- **Body:** light grey (`--bg`). Content sits on **white cards** with subtle
  borders and soft shadow.
- **Type:** serif headings (`Source Serif 4`), sans body (`Source Sans 3`).
- **Amber callout** boxes for guidance/notes.
- **Footer:** centered, muted — "… is a free tool from the Project Business
  Foundation — project-business.org".

## Kanban Shopfloor accent (stand out)
- Accent = **industrial amber-orange** (`--accent`) used in the type badge,
  primary buttons, and focus rings.
- **Signature separators:** thin vertical rules between board columns, each
  topped with a short accent tick; a 2px accent underline beneath the header.
  This is the "minor separator that makes the screenshot special".

## Accessibility
- Colour is never the only cue. OBS pills always show **text** (`ORG ▸ Name`),
  orgs get a **non-colour treatment** (border style / monogram), anonymous is
  shown explicitly (`ORG ▸ ⊘ anon`). WCAG-AA contrast; a legend maps org → code.

## Tokens
See `src/theme.css`. Swap `--accent` / logo to retheme; everything else is the
shared family chrome.
