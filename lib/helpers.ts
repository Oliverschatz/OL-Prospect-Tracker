import { STAGES, STAGE_ORDER, FIT_CRITERIA } from './constants';
import type { StageKey, FitScores, Contact, Company, Template } from './types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function stageInfo(key: StageKey) {
  return STAGES.find(s => s.key === key) || STAGES[0];
}

export function calcFitScore(scores: FitScores): number {
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / (FIT_CRITERIA.length * 3)) * 100);
}

export function fitColor(score: number): string {
  if (score >= 70) return 'var(--stage-won)';
  if (score >= 40) return 'var(--pbf-accent)';
  return 'var(--pbf-red)';
}

export function autoAdvanceStage(
  currentStage: StageKey,
  activityText: string,
  triggers: Record<string, string[]>
): StageKey {
  if (currentStage === 'lost' || currentStage === 'won') return currentStage;
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  let newStage: StageKey = currentStage;
  for (const [targetStage, patterns] of Object.entries(triggers)) {
    const targetIdx = STAGE_ORDER.indexOf(targetStage);
    if (targetIdx > currentIdx && patterns.some(p => activityText.startsWith(p))) {
      if (targetIdx > STAGE_ORDER.indexOf(newStage)) newStage = targetStage as StageKey;
    }
  }
  return newStage;
}

export function fillTemplate(
  body: string,
  contact: Contact & { _anrede?: string },
  company: Company,
  ambassador?: { name?: string }
): string {
  const lastName = (contact.name || '').split(' ').slice(-1)[0] || '';
  const firstName = (contact.name || '').split(' ').slice(0, -1).join(' ') || '';
  const salutation = contact._anrede || 'Mr./Ms.';
  const ambName = ambassador?.name || '';
  const ambLast = ambName.split(' ').slice(-1)[0] || '';
  const ambFirst = ambName.split(' ').slice(0, -1).join(' ') || '';
  return body
    .replace(/\[AmbassadorName\]/g, ambName)
    .replace(/\[AmbassadorFirstName\]/g, ambFirst)
    .replace(/\[AmbassadorLastName\]/g, ambLast)
    // English placeholders
    .replace(/\[Salutation\]/g, salutation)
    .replace(/\[LastName\]/g, lastName)
    .replace(/\[FirstName\]/g, firstName)
    .replace(/\[Name\]/g, contact.name || '')
    .replace(/\[Title\]/g, contact.title || '')
    .replace(/\[Company\]/g, company.name || '')
    .replace(/\[Department\]/g, contact.department || '')
    .replace(/\[Email\]/g, contact.email || '')
    .replace(/\[LinkedIn\]/g, contact.linkedin || '')
    // Legacy German placeholders (kept for backwards compatibility)
    .replace(/\[Anrede\]|\[H\/F\]/g, salutation)
    .replace(/\[Nachname\]/g, lastName)
    .replace(/\[Vorname\]/g, firstName)
    .replace(/\[Titel\]/g, contact.title || '')
    .replace(/\[Unternehmen\]/g, company.name || '')
    .replace(/\[Abteilung\]/g, contact.department || '')
    .replace(/\[E-Mail\]/g, contact.email || '');
}

export const EMPTY_COMPANY: Omit<Company, 'id' | 'created_at' | 'updated_at'> = {
  name: 'New Company',
  hq: '',
  country: 'Germany',
  employees: '',
  sector: 'Mixed / Multi-discipline EPC',
  website: '',
  stage: 'researching',
  fit_scores: {},
  pain_points: '',
  entry_angle: '',
  notes: '',
  parent_id: '',
  tags: [],
  contacts: [],
  activities: [],
  planned_events: [],
};

export const EMPTY_CONTACT: Omit<Contact, 'id'> = {
  name: '',
  title: '',
  department: '',
  email: '',
  phone: '',
  linkedin: '',
  role: 'target',
  notes: '',
  activities: [],
  planned_events: [],
};
