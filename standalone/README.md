# Standalone practice apps

These are **not part of the Prospect Tracker**. They are independent
single-page HTML apps intended for a different audience (PMI-RMP exam
candidates) and a different deployment target (e.g. `oliverlehmann.com/practice/`).

This folder exists on this branch only as a delivery vehicle — do not merge
into `main`.

## Contents

Three layouts, pick whichever fits your hosting:

- `combined/` — both apps + one shared `questions.json` in a single folder.
  Simplest deployment. URLs:
  - `oliverlehmann.com/practice/RMP_practice.html` (student quiz)
  - `oliverlehmann.com/practice/RMP_edit.html` (editor, protect this one)
  - Zip: `RMP_combined.zip`

- `practice-app/` — quiz only. `RMP_practice.html` + `questions.json`. Use if
  you want the editor on a completely different folder/subdomain.
  - Zip: `practice-app.zip`

- `practice-editor/` — editor only. `RMP_edit.html` + `questions.json`. Pair
  with `practice-app/` above if you separate them.
  - Zip: `practice-editor.zip`

All three layouts share the same 100-question `questions.json`.

## Editor workflow

1. Open the editor URL in a browser.
2. Edit questions one by one — every keystroke is saved locally in the browser.
3. Click **Download JSON** to export the updated `questions.json`.
4. Replace `questions.json` in `/practice/` on the live site with the
   downloaded file.
