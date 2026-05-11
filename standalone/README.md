# Standalone PMI-RMP practice apps

These are **not part of the Prospect Tracker**. They are independent
single-page HTML apps for a different audience (PMI-RMP exam candidates)
and a different deployment target (`oliverlehmann.com/practice/`).

This folder exists on this branch only as a delivery vehicle — do not
merge into `main`.

## Contents

`practice/` is a single deployment-ready folder:

- `index.html` — student-facing quiz. Served at the folder's URL.
- `editor.html` — admin editor for the questions. Restrict access in
  WordPress so the public can't load it.
- `questions.json` — 100 PMI-RMP practice questions. Both files read from
  this same file.

`practice.zip` — convenience archive of the three files above.

## Deployment

Upload the three files in `practice/` to `oliverlehmann.com/practice/`.
Resulting URLs:

- Quiz: `oliverlehmann.com/practice/`
- Editor: `oliverlehmann.com/practice/editor.html` (protect this)

## Editor workflow

1. Open `editor.html` in a browser.
2. Edit questions one at a time — every keystroke auto-saves to your
   browser's local storage, so a refresh won't lose work.
3. Click **Download JSON** to export the updated `questions.json`.
4. Upload the downloaded file to `oliverlehmann.com/practice/`, overwriting
   the existing `questions.json`. Both the quiz and the editor will pick it
   up on next load.
