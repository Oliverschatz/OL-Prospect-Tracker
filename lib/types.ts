// ─── Pipeline Stages ───
export type StageKey = 'researching' | 'qualified' | 'contacted' | 'dialogue' | 'won' | 'lost';

export interface StageInfo {
  key: StageKey;
  label: string;
  short: string;
  cls: string;
  color: string;
}

// ─── Fit Scores ───
export type FitScores = Record<string, number | undefined>;

// ─── Activity ───
export interface Activity {
  id: string;
  company_id?: string;
  contact_id?: string | null;
  date: string;
  text: string;
}

// ─── Planned Event ───
export interface PlannedEvent {
  id: string;
  company_id: string;
  contact_id: string | null;
  event_date: string;
  description: string;
  done: boolean;
}

// ─── Contact ───
export interface Contact {
  id: string;
  company_id?: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  linkedin: string;
  role: 'target' | 'champion' | 'influencer' | 'gatekeeper' | 'referral';
  notes: string;
  follow_up_date: string;
  next_action: string;
  activities: Activity[];
  planned_events: PlannedEvent[];
}

// ─── Company ───
export interface Company {
  id: string;
  name: string;
  hq: string;
  country: string;
  employees: string;
  sector: string;
  website: string;
  stage: StageKey;
  fit_scores: FitScores;
  pain_points: string;
  entry_angle: string;
  notes: string;
  next_action: string;
  follow_up_date: string;
  parent_id: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  contacts: Contact[];
  activities: Activity[];
  planned_events: PlannedEvent[];
}

// ─── Template ───
export interface Template {
  id: string;
  name: string;
  body: string;
  sort_order: number;
}
