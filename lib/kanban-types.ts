export type Panel = 'todo' | 'wip' | 'review' | 'done';

export const PANELS: { id: Panel; label: string }[] = [
  { id: 'todo',   label: 'To do' },
  { id: 'wip',    label: 'WIP' },
  { id: 'review', label: 'For review' },
  { id: 'done',   label: 'Done' },
];

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

export type MemberRole = 'owner' | 'member';

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string | null;   // null until the invited person accepts (logs in)
  email: string;
  worker_name: string;      // worker chip this person is tied to ('' = none)
  role: MemberRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
};

export type Worker = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type DocumentKind = 'internal' | 'external';

export type ProjectDocument = {
  id: string;
  project_id: string;
  kind: DocumentKind;
  label: string;
  url: string;
  sort_order: number;
};

export type CardLink = {
  id: string;
  label: string;
  url: string;
};

export type FileVersion = {
  path: string;             // storage object path
  uploaded_at: string;      // ISO timestamp
  uploaded_by: string;      // worker first name
  size?: number;
};

export type CardFile = {
  name: string;             // logical filename; identical names = versions
  versions: FileVersion[];  // index 0 = oldest, last = latest
};

export type HistoryEntry = {
  at: string;               // ISO timestamp
  by: string;               // worker name or system actor
  what: string;             // human-readable description of the change
};

export type Card = {
  id: string;
  project_id: string;
  title: string;
  split_group: string | null;
  split_number: number;
  explanation: string;
  body: string;             // markdown (rendered safely, never via innerHTML)
  panel: Panel;
  sort_order: number;
  workers: string[];        // first names assigned to the card
  eco_domain: string | null;
  eco_task: string | null;
  eco_enabler: string | null;
  lit_book: 'pmbok8' | 'apg' | null;
  lit_chapter: string | null;
  lit_page: string | null;
  links: CardLink[];
  files: CardFile[];
  history: HistoryEntry[];
  created_at: string;
  updated_at: string;
};

// Name given to the first project created for a brand-new board.
export const DEFAULT_PROJECT_NAME = 'New PMP Class';

// Bright, distinguishable defaults used when a new worker is created.
export const DEFAULT_WORKER_COLORS = [
  '#e8a838', // Oliver — gold
  '#4299e1', // blue
  '#9f7aea', // purple
  '#48bb78', // green
  '#ed8936', // orange
  '#f56565', // red
  '#38b2ac', // teal
  '#ed64a6', // pink
  '#a0aec0', // slate
  '#b794f4', // lavender
];
