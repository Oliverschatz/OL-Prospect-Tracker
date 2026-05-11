# Standalone PMI-RMP practice apps

These are **not part of the Prospect Tracker**. They are independent
single-page HTML apps for a different audience (PMI-RMP exam candidates)
and a different deployment target (`oliverlehmann.com/practice/RMP/`).

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
  `?from=1&size=20`). Suggested seminar packs based on the new question
  ordering:
  - Fundamentals: `?from=1&size=15`
  - Domain I: `?from=16&size=22`
  - Domain II: `?from=38&size=23`
  - Domain III: `?from=61&size=23`
  - Domain IV: `?from=84&size=13`
  - Domain V: `?from=97&size=19`
  - Cross-domain: `?from=116&size=20`
- `editor.html` — admin editor for the questions. Restrict access in
  WordPress so the public can't load it.
- `questions.json` — 135 PMI-RMP practice questions in fixed order:
  - **1–15:** Fundamentals (what is risk, why risk management matters,
    project vs program vs portfolio risk, appetite/threshold, etc.)
  - **16–37:** Domain I — Risk Strategy and Planning (22 questions)
  - **38–60:** Domain II — Risk Identification (23 questions)
  - **61–83:** Domain III — Risk Analysis (23 questions)
  - **84–96:** Domain IV — Risk Response (13 questions)
  - **97–115:** Domain V — Monitor and Close Risks (19 questions)
  - **116–135:** Cross-domain (scenarios spanning multiple domains)

  Both apps read from this same file in this exact order — no shuffling.

`practice.zip` — convenience archive of the three files above.

## Deployment

Upload the three files in `practice/` to `oliverlehmann.com/practice/RMP/`.
Resulting URLs:

- Quiz: `https://oliverlehmann.com/practice/RMP/`
- Editor: `https://oliverlehmann.com/practice/RMP/editor.html` (protect this)

## Editor workflow

1. Open `editor.html` in a browser.
2. Edit questions one at a time — every keystroke auto-saves to your
   browser's local storage, so a refresh won't lose work.
3. Click **Download JSON** to export the updated `questions.json`.
4. Upload the downloaded file to `oliverlehmann.com/practice/RMP/`, overwriting
   the existing `questions.json`. Both the quiz and the editor will pick it
   up on next load.
