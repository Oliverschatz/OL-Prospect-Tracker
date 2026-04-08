'use client';

import { useEffect, useRef, useState } from 'react';

export interface TutorialHooks {
  onLoadDummies: () => Promise<void>;
  onRemoveDummies: () => Promise<void>;
  setView: (v: 'pipeline' | 'followups' | 'history' | 'reports') => void;
  selectCompanyByName: (name: string) => void;
  clearSelection: () => void;
  openTemplateManager: () => void;
  closeTemplateManager: () => void;
}

interface Step {
  title: string;
  body: string;
  action?: (h: TutorialHooks) => void;
}

// The tutorial walks the user through the main features of the tracker
// using the three demo companies (Duck Enterprises, Marvel Universe, Sesame
// Street). Each step switches the UI to the area it is talking about so
// the user can see the feature in context.
const STEPS: Step[] = [
  {
    title: 'Welcome to the tutorial',
    body:
      "This quick tour walks you through the core features of the Prospect Tracker using three demo companies. " +
      "We'll load them now and remove them automatically when the tour ends, so your real data stays untouched.",
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'The pipeline',
    body:
      "The sidebar on the left shows your companies grouped by pipeline stage: Researching → Qualified → Contacted → In Dialogue → Won/Lost. " +
      "Use the stage and tag filters at the top of the sidebar to narrow the list down.",
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'A company profile',
    body:
      "Click a company in the sidebar to open its profile. We've opened 'Duck Enterprises' for you. Each profile has sections for company info, the PBP Fit Assessment (5 criteria scored 0–3), pain points, entry angle, opportunity value, attachments and notes.",
    action: (h) => { h.setView('pipeline'); h.selectCompanyByName('Duck Enterprises'); },
  },
  {
    title: 'Contacts and roles',
    body:
      "Inside the company profile you'll find the contacts (Donald, Scrooge, Gyro, Daisy, Huey…). Each contact has a role — decision maker, champion, influencer, gatekeeper or target — and their own activity log and planned follow-ups. " +
      "Use the ↩ icon next to a contact to log a reply you received.",
  },
  {
    title: 'Activities and follow-ups',
    body:
      "Every company and contact has an activity log (what happened) and a follow-up list (what still needs to happen). " +
      "Switch to the 'Follow-ups' view to see everything that's due across all your companies on one timeline.",
    action: (h) => { h.clearSelection(); h.setView('followups'); },
  },
  {
    title: 'Message templates',
    body:
      "Open the Templates manager from the sidebar to edit your personal message templates. " +
      "Shared templates (managed by the admin) are shown at the top and are read-only. Inside a contact, the 'Use template' button fills in placeholders like [FirstName] and [Company] and lets you copy or mark the message as sent.",
    action: (h) => { h.setView('pipeline'); h.selectCompanyByName('Marvel Universe, Inc.'); h.openTemplateManager(); },
  },
  {
    title: 'Reports',
    body:
      "The Reports view gives you KPI cards, a pipeline-by-stage table, an 8-week activity chart and your top 5 prospects by weighted value (opportunity × probability).",
    action: (h) => { h.closeTemplateManager(); h.clearSelection(); h.setView('reports'); },
  },
  {
    title: 'Bulk actions & search',
    body:
      "Back in the pipeline view, tick several companies to get a bulk action bar for moving them to a stage, adding a tag, or deleting them. " +
      "The search box in the header searches across names, notes, pain points, entry angles, tags and activity text.",
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: "That's it!",
    body:
      "That's the core of the tracker. When you click 'Finish tour', the three demo companies will be removed automatically. Happy prospecting!",
  },
];

export default function Tutorial({
  hooks,
  onClose,
}: {
  hooks: TutorialHooks;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'running' | 'cleanup'>('loading');
  const [error, setError] = useState('');
  const mountedRef = useRef(false);
  // Keep the latest hooks in a ref so effects can call them without
  // re-running on every parent re-render (hooks is recreated each render).
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  // On mount: load the dummy companies.
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    (async () => {
      try {
        await hooksRef.current.onLoadDummies();
        setPhase('running');
      } catch {
        setError('Could not load demo companies.');
      }
    })();
  }, []);

  // Run the step's side-effect whenever the step changes and we're running.
  useEffect(() => {
    if (phase !== 'running') return;
    STEPS[step]?.action?.(hooksRef.current);
  }, [step, phase]);

  const finish = async (ask: boolean) => {
    if (ask && !confirm('End the tour now? The demo companies will be removed.')) return;
    setPhase('cleanup');
    try {
      await hooksRef.current.onRemoveDummies();
    } catch {
      // Ignore — user can remove manually via the sidebar button.
    }
    onClose();
  };

  if (phase === 'loading') {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Loading demo data…</div>
        <div style={bodyStyle}>Preparing three demo companies so we can walk through the tracker with real-looking content.</div>
        {error && <div style={{ ...bodyStyle, color: 'var(--pbf-red)' }}>{error}</div>}
      </div>
    );
  }

  if (phase === 'cleanup') {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Cleaning up…</div>
        <div style={bodyStyle}>Removing the demo companies. You can load them again any time from the sidebar.</div>
      </div>
    );
  }

  const current = STEPS[step];
  const progress = `${step + 1} / ${STEPS.length}`;

  return (
    <div style={panelStyle} role="dialog" aria-label="Prospect Tracker tutorial">
      <div style={headerStyle}>
        <span>{current.title}</span>
        <span style={{ fontSize: 11, color: 'var(--pbf-muted)', fontWeight: 500 }}>{progress}</span>
      </div>
      <div style={bodyStyle}>{current.body}</div>
      <div style={footerStyle}>
        <button className="btn-ghost btn-sm" onClick={() => finish(true)}>End tour</button>
        <div style={{ flex: 1 }} />
        <button
          className="btn-ghost btn-sm"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary btn-sm" onClick={() => setStep(s => s + 1)}>Next →</button>
        ) : (
          <button className="btn-primary btn-sm" onClick={() => finish(false)}>Finish tour</button>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 24,
  bottom: 24,
  width: 380,
  maxWidth: 'calc(100vw - 48px)',
  background: 'white',
  border: '1px solid var(--pbf-border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 10px 30px rgba(26, 39, 68, 0.18)',
  zIndex: 1100,
  fontFamily: 'inherit',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'var(--pbf-navy)',
  color: 'white',
  borderRadius: 'var(--radius) var(--radius) 0 0',
  fontWeight: 700,
  fontSize: 14,
  fontFamily: 'Georgia, "Source Serif 4", serif',
};

const bodyStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--pbf-text)',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 12px',
  borderTop: '1px solid var(--pbf-border)',
  background: 'var(--pbf-light)',
  borderRadius: '0 0 var(--radius) var(--radius)',
};
