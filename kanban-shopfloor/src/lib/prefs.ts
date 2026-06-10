// App-level UI preferences (working style, splash seen, dismissed coach prompts).
// Kept OUT of the board document so they don't travel in exported JSON files —
// they are per-device, per-browser preferences.

export type Mode = 'coached' | 'open';

export interface UiPrefs {
  mode: Mode;
  splash_seen: boolean;
  coached_dismissed: Record<string, boolean>;
}

const KEY = 'kanban-shopfloor:ui';
const DEFAULTS: UiPrefs = { mode: 'coached', splash_seen: false, coached_dismissed: {} };

export function loadPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UiPrefs>) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function savePrefs(p: UiPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
