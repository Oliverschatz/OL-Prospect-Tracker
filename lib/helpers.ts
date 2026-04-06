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

export function fillTemplate(body: string, contact: Contact & { _anrede?: string }, company: Company): string {
  const lastName = (contact.name || '').split(' ').slice(-1)[0] || '';
  const firstName = (contact.name || '').split(' ').slice(0, -1).join(' ') || '';
  return body
    .replace(/\[Anrede\]|\[H\/F\]/g, contact._anrede || 'Herr/Frau')
    .replace(/\[Nachname\]/g, lastName)
    .replace(/\[Vorname\]/g, firstName)
    .replace(/\[Name\]/g, contact.name || '')
    .replace(/\[Titel\]/g, contact.title || '')
    .replace(/\[Unternehmen\]/g, company.name || '')
    .replace(/\[Abteilung\]/g, contact.department || '')
    .replace(/\[E-Mail\]/g, contact.email || '')
    .replace(/\[LinkedIn\]/g, contact.linkedin || '');
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
  next_action: '',
  follow_up_date: '',
  parent_id: '',
  tags: [],
  contacts: [],
  activities: [],
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
  follow_up_date: '',
  next_action: '',
  activities: [],
};
