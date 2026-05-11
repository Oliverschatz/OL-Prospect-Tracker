# Standalone practice apps

These are **not part of the Prospect Tracker**. They are independent
single-page HTML apps intended for a different audience (PMI-RMP exam
candidates) and a different deployment target (e.g. `oliverlehmann.com/practice/`).

This folder exists on this branch only as a delivery vehicle — do not merge
into `main`.

## Contents

- `practice-app/` — student-facing quiz. Upload contents to
  `oliverlehmann.com/practice/`.
  - `index.html` — vanilla-JS quiz UI
  - `questions.json` — 100 PMI-RMP practice questions

- `practice-editor/` — admin editor for the questions. Upload contents to a
  protected folder, e.g. `oliverlehmann.com/practice-editor/`.
  - `index.html` — paginated question editor with localStorage auto-save and
    "Download JSON" export
  - `questions.json` — starting question set (same as the quiz)

- `practice-app.zip`, `practice-editor.zip` — convenience zips of the two
  folders above.

## Editor workflow

1. Open the editor URL in a browser.
2. Edit questions one by one — every keystroke is saved locally in the browser.
3. Click **Download JSON** to export the updated `questions.json`.
4. Replace `questions.json` in `/practice/` on the live site with the
   downloaded file.
