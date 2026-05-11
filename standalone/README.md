# Standalone PMI-RMP practice apps

These are **not part of the Prospect Tracker**. They are independent
single-page HTML apps for a different audience (PMI-RMP exam candidates)
and a different deployment target (`oliverlehmann.com/practice/`).

This folder exists on this branch only as a delivery vehicle — do not
merge into `main`.

## Contents

`practice/` is a single deployment-ready folder:

- `index.html` — student-facing **seminar pack**. Presents 20 questions in
  sequence with no per-question feedback; correct answers and rationales
  appear only after the student submits the pack, for in-class discussion.
  Tools available during the pack: strike-through eliminated options,
  flag-for-review, count-up timer, draggable calculator (4-function +
  parentheses + %), and a session notepad.
  URL params: `?from=N&size=M` picks a different slice (defaults to
  `?from=1&size=20`). Example: `?from=21&size=20` runs questions 21-40.
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
