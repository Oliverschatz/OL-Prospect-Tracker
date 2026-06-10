import { ReactNode } from 'react';
import { Mode } from '../lib/prefs';

// A dismissible coaching prompt, shown only in "coached" mode (Risk Foundry style).
export default function Coach({
  id, mode, dismissed, onDismiss, children,
}: {
  id: string;
  mode: Mode;
  dismissed: Record<string, boolean>;
  onDismiss: (id: string) => void;
  children: ReactNode;
}) {
  if (mode !== 'coached' || dismissed[id]) return null;
  return (
    <div className="coached-prompt">
      <span className="coach-icon">🎯</span>
      <div className="coach-body">{children}</div>
      <button className="coached-dismiss" onClick={() => onDismiss(id)} aria-label="Dismiss">✕</button>
    </div>
  );
}
