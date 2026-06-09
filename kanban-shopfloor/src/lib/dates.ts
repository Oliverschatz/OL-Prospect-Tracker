import { Card, DONE_COLUMN } from '../types';

export type WarningKind = 'milestone_after_deadline' | 'overdue' | 'milestone_passed';

export interface CardWarning {
  kind: WarningKind;
  message: string;
}

function dayStart(iso: string): number {
  // Compare on calendar dates only (ignore time-of-day).
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isDone(card: Card): boolean {
  return card.column === DONE_COLUMN;
}

// All schedule warnings for a card, evaluated against `today` (defaults to now).
export function cardWarnings(card: Card, today: Date = new Date()): CardWarning[] {
  const out: CardWarning[] = [];
  const now = dayStart(today.toISOString());
  const deadline = card.deadline ? dayStart(card.deadline) : null;
  const milestone = card.milestone ? dayStart(card.milestone) : null;
  const done = isDone(card);

  // Planned/expected milestone slips past the latest acceptable date.
  if (deadline != null && milestone != null && milestone > deadline) {
    out.push({
      kind: 'milestone_after_deadline',
      message: 'Expected milestone is after the deadline',
    });
  }
  // Past the latest acceptable date and not finished.
  if (deadline != null && !done && now > deadline) {
    out.push({ kind: 'overdue', message: 'Past deadline and not done' });
  }
  // Planned date has passed but the work is not finished.
  if (milestone != null && !done && now > milestone) {
    out.push({ kind: 'milestone_passed', message: 'Milestone date passed and not done' });
  }
  return out;
}

export function hasBlockingWarning(card: Card, today?: Date): boolean {
  return cardWarnings(card, today).length > 0;
}
