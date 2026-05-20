// Literature reference for Kanban cards.
//
// PMBOK® Guide 8th Edition: chapter list below is a placeholder — replace
// with the official table of contents once published. Agile Practice Guide
// chapter list follows the published PMI/Agile Alliance edition.
//
// Both books are referenced by chapter from the dropdown; the page number
// is captured as free text on the card.

export type LiteratureBook = {
  id: 'pmbok8' | 'apg';
  label: string;
  chapters: { id: string; label: string }[];
};

export const LITERATURE: LiteratureBook[] = [
  {
    id: 'pmbok8',
    label: 'PMBOK® Guide — 8th Edition',
    chapters: [
      // Placeholder chapter list — update when PMBOK 8 ToC is published.
      { id: 'ch1',  label: 'Chapter 1 — Introduction' },
      { id: 'ch2',  label: 'Chapter 2 — Project Environment' },
      { id: 'ch3',  label: 'Chapter 3 — Project Manager Role' },
      { id: 'ch4',  label: 'Chapter 4 — Stewardship' },
      { id: 'ch5',  label: 'Chapter 5 — Team' },
      { id: 'ch6',  label: 'Chapter 6 — Stakeholders' },
      { id: 'ch7',  label: 'Chapter 7 — Value' },
      { id: 'ch8',  label: 'Chapter 8 — Systems Thinking' },
      { id: 'ch9',  label: 'Chapter 9 — Leadership' },
      { id: 'ch10', label: 'Chapter 10 — Tailoring' },
      { id: 'ch11', label: 'Chapter 11 — Quality' },
      { id: 'ch12', label: 'Chapter 12 — Complexity' },
      { id: 'ch13', label: 'Chapter 13 — Risk' },
      { id: 'ch14', label: 'Chapter 14 — Adaptability and Resilience' },
      { id: 'ch15', label: 'Chapter 15 — Change' },
      { id: 'ch16', label: 'Performance Domains' },
      { id: 'ch17', label: 'Models, Methods, and Artifacts' },
      { id: 'app',  label: 'Appendices / Glossary' },
    ],
  },
  {
    id: 'apg',
    label: 'Agile Practice Guide',
    chapters: [
      { id: 'ch1', label: 'Chapter 1 — Introduction' },
      { id: 'ch2', label: 'Chapter 2 — An Introduction to Agile' },
      { id: 'ch3', label: 'Chapter 3 — Life Cycle Selection' },
      { id: 'ch4', label: 'Chapter 4 — Creating an Agile Environment' },
      { id: 'ch5', label: 'Chapter 5 — Delivering in an Agile Environment' },
      { id: 'ch6', label: 'Chapter 6 — Organizational Considerations for Project Agility' },
      { id: 'ch7', label: 'Chapter 7 — A Call to Action' },
      { id: 'appA', label: 'Appendix A — PMBOK Guide Mapping' },
      { id: 'appB', label: 'Appendix B — Manifesto for Agile Software Development' },
      { id: 'appC', label: 'Appendix C — Agile and Lean Frameworks' },
    ],
  },
];
