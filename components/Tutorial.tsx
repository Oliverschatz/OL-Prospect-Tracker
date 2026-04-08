'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  // CSS selector of the element to highlight. If omitted, no spotlight —
  // the tooltip is centered on screen with a full backdrop.
  target?: string;
  // Preferred placement of the tooltip relative to the highlighted target.
  placement?: 'right' | 'left' | 'bottom' | 'top' | 'center';
  // Side-effect to run when the step becomes active (e.g. switch view).
  action?: (h: TutorialHooks) => void;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the tutorial',
    body:
      "This quick tour walks you through the core features of the Prospect Tracker using three demo companies. " +
      "We'll load them now and remove them automatically when the tour ends, so your real data stays untouched.",
    placement: 'center',
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'The pipeline sidebar',
    body:
      "Your companies live here, grouped by pipeline stage and split into 'With Contacts' and 'Research Needed'. " +
      "Use the stage and tag filters at the top to narrow the list down.",
    target: '[data-tutorial="sidebar"]',
    placement: 'right',
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'Switch views',
    body:
      "The four tabs switch between Companies, Follow-ups, History and Reports. The Follow-ups badge shows how many items are due today or overdue.",
    target: '[data-tutorial="view-tabs"]',
    placement: 'right',
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'Search everything',
    body:
      "The search box matches across company names, contacts, notes, pain points, entry angles, tags and activity text — so you can find any prospect by anything you remember about them.",
    target: '[data-tutorial="search"]',
    placement: 'right',
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
  {
    title: 'A company profile',
    body:
      "Click 'Duck Enterprises' (we just opened it for you). Each profile holds company info, the PBP Fit Assessment, pain points, entry angle, opportunity value, attachments and notes.",
    target: '[data-tutorial="main-content"]',
    placement: 'left',
    action: (h) => { h.setView('pipeline'); h.selectCompanyByName('Duck Enterprises'); },
  },
  {
    title: 'Contacts and roles',
    body:
      "Inside the profile you'll find the contacts (Donald, Scrooge, Gyro, Daisy, Huey…). Each contact has a role — decision maker, champion, influencer, gatekeeper or target — plus their own notes, activity log and follow-ups. Use the ↩ icon next to a contact to log a reply.",
    target: '[data-tutorial="contacts-section"]',
    placement: 'left',
  },
  {
    title: 'Planned follow-ups',
    body:
      "Every company and contact can have planned events — what should happen next, when. Mark them done as you complete them. The sidebar Follow-ups view collects everything that's due across all companies.",
    target: '[data-tutorial="planned-events-section"]',
    placement: 'left',
  },
  {
    title: 'Message templates',
    body:
      "The Templates button opens your message templates. Shared templates managed by the admin are read-only at the top, your personal ones are editable below. Inside a contact, the 'Use template' button fills in placeholders like [FirstName] and [Company].",
    target: '[data-tutorial="templates-btn"]',
    placement: 'bottom',
    action: (h) => { h.clearSelection(); },
  },
  {
    title: 'Reports',
    body:
      "The Reports view gives you KPI cards, a pipeline-by-stage table, an 8-week activity chart and your top 5 prospects ranked by weighted opportunity value (value × probability).",
    target: '[data-tutorial="main-content"]',
    placement: 'left',
    action: (h) => { h.closeTemplateManager(); h.clearSelection(); h.setView('reports'); },
  },
  {
    title: "That's it!",
    body:
      "That's the core of the tracker. Click 'Finish tour' and the three demo companies will be removed automatically. Happy prospecting!",
    placement: 'center',
    action: (h) => { h.setView('pipeline'); h.clearSelection(); },
  },
];

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 6; // pixels of padding around the highlighted element

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
  const [rect, setRect] = useState<Rect | null>(null);

  const mountedRef = useRef(false);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  // Load demo data on mount.
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

  // Run the step's side-effect whenever the step changes.
  useEffect(() => {
    if (phase !== 'running') return;
    STEPS[step]?.action?.(hooksRef.current);
  }, [step, phase]);

  // Measure the target element after the side-effect has had a chance to run.
  useLayoutEffect(() => {
    if (phase !== 'running') { setRect(null); return; }
    const current = STEPS[step];
    if (!current?.target) { setRect(null); return; }

    let raf = 0;
    const measure = () => {
      const el = document.querySelector(current.target!) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // Wait one frame so any view-switching state has a chance to render.
    raf = requestAnimationFrame(() => {
      measure();
      // And measure once more on the next frame for late-rendering content.
      requestAnimationFrame(measure);
    });

    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
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
      <FullBackdrop>
        <CenteredCard title="Loading demo data…" body="Preparing three demo companies so we can walk through the tracker with real-looking content." error={error} />
      </FullBackdrop>
    );
  }
  if (phase === 'cleanup') {
    return (
      <FullBackdrop>
        <CenteredCard title="Cleaning up…" body="Removing the demo companies. You can load them again any time from the sidebar." />
      </FullBackdrop>
    );
  }

  const current = STEPS[step];
  const progress = `${step + 1} / ${STEPS.length}`;

  // Compute the spotlight rect (with padding) and tooltip position.
  const spot = rect ? {
    top: Math.max(0, rect.top - PAD),
    left: Math.max(0, rect.left - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  } : null;

  const placement = current.placement || (spot ? 'right' : 'center');
  const tooltipPos = computeTooltipPosition(spot, placement);

  return (
    <>
      {/* 4-piece backdrop forming a hole around the spotlight, or full backdrop. */}
      {spot ? (
        <>
          <div style={{ ...backdropBase, top: 0, left: 0, right: 0, height: spot.top }} onClick={() => {}} />
          <div style={{ ...backdropBase, top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
          <div style={{ ...backdropBase, top: spot.top, left: 0, width: spot.left, height: spot.height }} />
          <div style={{ ...backdropBase, top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} />
          {/* Spotlight outline */}
          <div
            style={{
              position: 'fixed',
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              border: '2px solid var(--pbf-accent, #e8a838)',
              borderRadius: 6,
              boxShadow: '0 0 0 2px rgba(232,168,56,0.35)',
              pointerEvents: 'none',
              zIndex: 1101,
            }}
          />
        </>
      ) : (
        <div style={{ ...backdropBase, top: 0, left: 0, right: 0, bottom: 0 }} />
      )}

      {/* Tooltip */}
      <div
        role="dialog"
        aria-label="Prospect Tracker tutorial"
        style={{
          position: 'fixed',
          ...tooltipPos,
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          background: 'white',
          border: '1px solid var(--pbf-border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 10px 30px rgba(26, 39, 68, 0.25)',
          zIndex: 1102,
          fontFamily: 'inherit',
        }}
      >
        <div style={headerStyle}>
          <span>{current.title}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{progress}</span>
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
    </>
  );
}

// Position the tooltip relative to the spotlight rect.
function computeTooltipPosition(
  spot: Rect | null,
  placement: 'right' | 'left' | 'bottom' | 'top' | 'center',
): React.CSSProperties {
  const W = 380; // tooltip width
  const H = 220; // approx tooltip height for clamping
  const margin = 12;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (!spot || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'right':
      left = Math.min(spot.left + spot.width + margin, vw - W - margin);
      top = Math.max(margin, Math.min(spot.top, vh - H - margin));
      break;
    case 'left':
      left = Math.max(margin, spot.left - W - margin);
      top = Math.max(margin, Math.min(spot.top, vh - H - margin));
      break;
    case 'bottom':
      left = Math.max(margin, Math.min(spot.left, vw - W - margin));
      top = Math.min(spot.top + spot.height + margin, vh - H - margin);
      break;
    case 'top':
      left = Math.max(margin, Math.min(spot.left, vw - W - margin));
      top = Math.max(margin, spot.top - H - margin);
      break;
  }

  return { top, left };
}

const backdropBase: React.CSSProperties = {
  position: 'fixed',
  background: 'rgba(26, 39, 68, 0.55)',
  zIndex: 1100,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'var(--pbf-navy, #1a2744)',
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

// ─── Tiny helpers for the loading / cleanup screens ───
function FullBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{ ...backdropBase, top: 0, left: 0, right: 0, bottom: 0 }} />
      {children}
    </>
  );
}

function CenteredCard({ title, body, error }: { title: string; body: string; error?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        background: 'white',
        border: '1px solid var(--pbf-border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 10px 30px rgba(26, 39, 68, 0.25)',
        zIndex: 1102,
      }}
    >
      <div style={headerStyle}>{title}</div>
      <div style={bodyStyle}>{body}</div>
      {error && <div style={{ ...bodyStyle, color: 'var(--pbf-red)', paddingTop: 0 }}>{error}</div>}
    </div>
  );
}
