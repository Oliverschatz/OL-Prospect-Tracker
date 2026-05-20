'use client';

import { useEffect, useRef, useState } from 'react';
import type { Card, DocumentKind } from '@/lib/kanban-types';

export type TransferTarget =
  | { kind: 'doc'; docKind: DocumentKind }
  | { kind: 'card'; cardId: string };

export type TransferSource =
  | { kind: 'doc'; docKind: DocumentKind }
  | { kind: 'card'; cardId: string };

type Props = {
  label: string;
  url: string;
  source: TransferSource;
  cards: Card[];
  onMove: (target: TransferTarget) => Promise<void>;
  onCopy: (target: TransferTarget) => Promise<void>;
};

export default function UrlTransferMenu({ label, url, source, cards, onMove, onCopy }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function isSelf(target: TransferTarget): boolean {
    if (source.kind === 'doc' && target.kind === 'doc') return source.docKind === target.docKind;
    if (source.kind === 'card' && target.kind === 'card') return source.cardId === target.cardId;
    return false;
  }

  async function go(mode: 'move' | 'copy', target: TransferTarget) {
    if (isSelf(target)) { setOpen(false); return; }
    setBusy(true);
    try {
      if (mode === 'move') await onMove(target);
      else await onCopy(target);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // URL label suppresses unused-prop lint and is used in the menu header.
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn-ghost btn-sm"
        title="Move or copy this URL"
        onClick={() => setOpen(o => !o)}
        disabled={busy}
      >↪</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
          background: 'var(--pbf-white)', border: '1px solid var(--pbf-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)',
          minWidth: 280, maxHeight: 320, overflowY: 'auto', padding: 6,
        }}>
          <div style={{ fontSize: 11, color: 'var(--pbf-muted)', padding: '2px 6px', borderBottom: '1px solid var(--pbf-light)' }}>
            <strong style={{ color: 'var(--pbf-text)' }}>{label}</strong>
            <div style={{ fontSize: 10, marginTop: 2, wordBreak: 'break-all' }}>{url}</div>
          </div>
          <Section title="Move to">
            <Item disabled={isSelf({ kind: 'doc', docKind: 'internal' })} onClick={() => go('move', { kind: 'doc', docKind: 'internal' })}>📁 Internal documents</Item>
            <Item disabled={isSelf({ kind: 'doc', docKind: 'external' })} onClick={() => go('move', { kind: 'doc', docKind: 'external' })}>🌐 External documents</Item>
            {cards.map(c => (
              <Item key={`mv-${c.id}`} disabled={isSelf({ kind: 'card', cardId: c.id })} onClick={() => go('move', { kind: 'card', cardId: c.id })}>
                🗂 {c.title || 'Untitled'} #{c.split_number}
              </Item>
            ))}
          </Section>
          <Section title="Copy to">
            <Item disabled={isSelf({ kind: 'doc', docKind: 'internal' })} onClick={() => go('copy', { kind: 'doc', docKind: 'internal' })}>📁 Internal documents</Item>
            <Item disabled={isSelf({ kind: 'doc', docKind: 'external' })} onClick={() => go('copy', { kind: 'doc', docKind: 'external' })}>🌐 External documents</Item>
            {cards.map(c => (
              <Item key={`cp-${c.id}`} disabled={isSelf({ kind: 'card', cardId: c.id })} onClick={() => go('copy', { kind: 'card', cardId: c.id })}>
                🗂 {c.title || 'Untitled'} #{c.split_number}
              </Item>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pbf-muted)', textTransform: 'uppercase', padding: '2px 6px' }}>{title}</div>
      {children}
    </div>
  );
}

function Item({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '5px 8px', fontSize: 12, background: 'none', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--pbf-muted)' : 'var(--pbf-text)',
        borderRadius: 3,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget.style.background = 'var(--pbf-light)'); }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
