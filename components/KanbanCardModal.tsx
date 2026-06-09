'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Card, CardFile, CardLink, DocumentKind, FileVersion, HistoryEntry, Worker } from '@/lib/kanban-types';
import { PANELS } from '@/lib/kanban-types';
import { ECO_DOMAINS } from '@/lib/kanban-eco';
import { LITERATURE } from '@/lib/kanban-literature';
import { signedUrl, uploadFile, removeStorageObject } from '@/lib/kanban-db';
import { RichTextEditor, RichTextView } from './KanbanRichText';
import UrlTransferMenu, { type TransferTarget } from './UrlTransferMenu';

type Props = {
  card: Card;
  workers: Worker[];
  allCards: Card[];
  currentWorker: string;
  onSetCurrentWorker: (name: string) => void;
  onAddWorker: (name: string) => Promise<void>;
  onClose: () => void;
  onSave: (next: Card) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenCard?: (id: string) => void;
  onAddLinkToCard: (targetCardId: string, label: string, url: string) => Promise<void>;
  onAddLinkToDocs: (kind: DocumentKind, label: string, url: string) => Promise<void>;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function KanbanCardModal({
  card, workers, allCards, currentWorker,
  onSetCurrentWorker, onAddWorker,
  onClose, onSave, onDelete, onOpenCard,
  onAddLinkToCard, onAddLinkToDocs,
}: Props) {
  const [draft, setDraft] = useState<Card>(card);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState<Record<string, boolean>>({});
  const [newWorkerName, setNewWorkerName] = useState('');

  useEffect(() => { setDraft(card); }, [card.id]);

  const tasks = useMemo(
    () => ECO_DOMAINS.find(d => d.id === draft.eco_domain)?.tasks ?? [],
    [draft.eco_domain]
  );
  const enablers = useMemo(
    () => tasks.find(t => t.id === draft.eco_task)?.enablers ?? [],
    [tasks, draft.eco_task]
  );
  // Other cards produced by splitting the same original (linked siblings).
  const siblings = useMemo(
    () => (card.split_group
      ? allCards
          .filter(c => c.split_group === card.split_group && c.id !== card.id)
          .sort((a, b) => a.split_number - b.split_number)
      : []),
    [allCards, card.split_group, card.id]
  );

  const chapters = useMemo(
    () => LITERATURE.find(b => b.id === draft.lit_book)?.chapters ?? [],
    [draft.lit_book]
  );

  // ─── Helpers that record history ─────────────────────────────────────
  function addHistory(what: string, patch: Partial<Card> = {}): Card {
    const entry: HistoryEntry = { at: new Date().toISOString(), by: currentWorker, what };
    return {
      ...draft,
      ...patch,
      history: [...draft.history, entry],
    };
  }

  // ─── Links ───────────────────────────────────────────────────────────
  function addLink() {
    const url = window.prompt('Hyperlink URL (https://…)');
    if (!url) return;
    const label = window.prompt('Label', url) || url;
    const link: CardLink = { id: uid(), label, url };
    setDraft(addHistory(`Added link "${label}"`, { links: [...draft.links, link] }));
  }
  function editLink(id: string) {
    const link = draft.links.find(l => l.id === id);
    if (!link) return;
    const url = window.prompt('URL', link.url) || link.url;
    const label = window.prompt('Label', link.label) || link.label;
    setDraft(addHistory(
      `Edited link "${label}"`,
      { links: draft.links.map(l => (l.id === id ? { ...l, url, label } : l)) }
    ));
  }
  function deleteLink(id: string) {
    const link = draft.links.find(l => l.id === id);
    if (!link) return;
    if (!window.confirm(`Delete link "${link.label}"?`)) return;
    setDraft(addHistory(
      `Deleted link "${link.label}"`,
      { links: draft.links.filter(l => l.id !== id) }
    ));
  }

  async function transferLink(link: CardLink, mode: 'move' | 'copy', target: TransferTarget) {
    setError('');
    try {
      if (target.kind === 'doc') {
        await onAddLinkToDocs(target.docKind, link.label, link.url);
      } else {
        await onAddLinkToCard(target.cardId, link.label, link.url);
      }
      if (mode === 'move') {
        const destName = target.kind === 'doc'
          ? `${target.docKind} documents`
          : `card "${allCards.find(c => c.id === target.cardId)?.title ?? '?'}"`;
        setDraft(addHistory(
          `Moved link "${link.label}" to ${destName}`,
          { links: draft.links.filter(l => l.id !== link.id) }
        ));
      } else {
        const destName = target.kind === 'doc'
          ? `${target.docKind} documents`
          : `card "${allCards.find(c => c.id === target.cardId)?.title ?? '?'}"`;
        setDraft(addHistory(`Copied link "${link.label}" to ${destName}`));
      }
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }

  // ─── Files (versioned by name) ───────────────────────────────────────
  async function onUploadFile(file: File) {
    setError('');
    try {
      const { path, size } = await uploadFile(card.project_id, card.id, file);
      const version: FileVersion = {
        path,
        uploaded_at: new Date().toISOString(),
        uploaded_by: currentWorker,
        size,
      };
      const existing = draft.files.find(f => f.name === file.name);
      let nextFiles: CardFile[];
      if (existing) {
        nextFiles = draft.files.map(f =>
          f.name === file.name ? { ...f, versions: [...f.versions, version] } : f
        );
      } else {
        nextFiles = [...draft.files, { name: file.name, versions: [version] }];
      }
      setDraft(addHistory(`Uploaded ${file.name} (v${nextFiles.find(f => f.name === file.name)!.versions.length})`, { files: nextFiles }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openVersion(path: string) {
    try {
      const url = await signedUrl(path, 3600);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteVersion(fileName: string, path: string) {
    const file = draft.files.find(f => f.name === fileName);
    if (!file) return;
    const versionIdx = file.versions.findIndex(v => v.path === path);
    if (versionIdx === -1) return;
    const isLastVersion = file.versions.length === 1;
    const msg = isLastVersion
      ? `Delete "${fileName}" entirely? This removes the file from storage.`
      : `Delete version ${versionIdx + 1} of "${fileName}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;

    try {
      await removeStorageObject(path);
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    let nextFiles: CardFile[];
    let what: string;
    if (isLastVersion) {
      nextFiles = draft.files.filter(f => f.name !== fileName);
      what = `Deleted ${fileName} (last version removed)`;
    } else {
      nextFiles = draft.files.map(f =>
        f.name === fileName
          ? { ...f, versions: f.versions.filter(v => v.path !== path) }
          : f
      );
      what = `Deleted version ${versionIdx + 1} of ${fileName}`;
    }
    setDraft(addHistory(what, { files: nextFiles }));
  }

  async function deleteAllVersions(fileName: string) {
    const file = draft.files.find(f => f.name === fileName);
    if (!file) return;
    if (!window.confirm(`Delete "${fileName}" and all ${file.versions.length} version(s)? This cannot be undone.`)) return;

    const failed: string[] = [];
    for (const v of file.versions) {
      try { await removeStorageObject(v.path); }
      catch { failed.push(v.path); }
    }
    if (failed.length) {
      setError(`Could not remove ${failed.length} file object(s) from storage. The card entry has still been cleared.`);
    }
    const nextFiles = draft.files.filter(f => f.name !== fileName);
    setDraft(addHistory(`Deleted ${fileName} and all versions`, { files: nextFiles }));
  }

  // ─── Image upload from rich text editor ──────────────────────────────
  async function uploadInlineImage(file: File): Promise<string> {
    const { path } = await uploadFile(card.project_id, card.id, file);
    return await signedUrl(path, 60 * 60 * 24 * 7); // 1-week signed URL
  }

  // ─── Workers (assignment) ────────────────────────────────────────────
  function toggleWorkerAssignment(name: string) {
    const present = draft.workers.includes(name);
    const next = present
      ? draft.workers.filter(w => w !== name)
      : [...draft.workers, name];
    setDraft(addHistory(
      present ? `${name} stepped off the card` : `${name} joined the card`,
      { workers: next }
    ));
  }

  async function handleAddWorker() {
    const n = newWorkerName.trim();
    if (!n) return;
    try {
      await onAddWorker(n);
      setNewWorkerName('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ─── Save ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // If title/explanation/body/ECO/literature changed, record a "edited" entry once.
      const meaningful =
        draft.title !== card.title ||
        draft.explanation !== card.explanation ||
        draft.body !== card.body ||
        draft.eco_domain !== card.eco_domain ||
        draft.eco_task !== card.eco_task ||
        draft.eco_enabler !== card.eco_enabler ||
        draft.lit_book !== card.lit_book ||
        draft.lit_chapter !== card.lit_chapter ||
        draft.lit_page !== card.lit_page;
      const toSave = meaningful
        ? { ...draft, history: [...draft.history, { at: new Date().toISOString(), by: currentWorker, what: 'Card edited' }] }
        : draft;
      await onSave(toSave);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────
  const latestHistory = draft.history.length ? draft.history[draft.history.length - 1] : null;
  const olderHistory = draft.history.length > 1 ? draft.history.slice(0, -1).reverse() : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 720, maxWidth: '95vw', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {draft.title || 'Untitled card'} {draft.split_number > 1 ? `— #${draft.split_number}` : `#${draft.split_number}`}
          </h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ color: 'var(--pbf-red)', fontSize: 13 }}>{error}</div>}

          {/* Linked cards (split siblings) */}
          {card.split_group && (
            <div style={{
              background: 'var(--pbf-light)', border: '1px solid var(--pbf-border)',
              borderRadius: 6, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pbf-navy)', marginBottom: 4 }}>
                🔗 Linked cards — split group of {siblings.length + 1}
              </div>
              {siblings.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>
                  No other cards in this split group (the rest were deleted).
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {siblings.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      className="btn-secondary btn-sm"
                      title={`Open "${s.title || 'Untitled'}" #${s.split_number}`}
                      onClick={() => onOpenCard?.(s.id)}
                      disabled={!onOpenCard}
                      style={{ fontSize: 12 }}
                    >
                      #{s.split_number} · {s.title || 'Untitled'}
                      <span style={{ color: 'var(--pbf-muted)', marginLeft: 6 }}>
                        ({PANELS.find(p => p.id === s.panel)?.label ?? s.panel})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title + explanation */}
          <div className="field-row">
            <div className="field-group">
              <label>Title</label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Acting as worker</label>
              <select value={currentWorker} onChange={e => onSetCurrentWorker(e.target.value)}>
                {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field-group">
            <label>Explanation</label>
            <textarea
              value={draft.explanation}
              onChange={e => setDraft({ ...draft, explanation: e.target.value })}
              rows={2}
              placeholder="Short summary shown on the card front."
            />
          </div>

          {/* Workers */}
          <div className="field-group">
            <label>Assigned workers</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {workers.map(w => {
                const on = draft.workers.includes(w.name);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorkerAssignment(w.name)}
                    style={{
                      background: on ? w.color : 'transparent',
                      color: on ? '#1a2744' : 'var(--pbf-muted)',
                      border: `1px solid ${on ? w.color : 'var(--pbf-border)'}`,
                      borderRadius: 999, padding: '3px 10px', fontSize: 12,
                    }}
                  >
                    {on ? '✓ ' : '+ '}{w.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={newWorkerName}
                onChange={e => setNewWorkerName(e.target.value)}
                placeholder="Add worker (first name)"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWorker(); } }}
                style={{ flex: 1 }}
              />
              <button className="btn-secondary btn-sm" type="button" onClick={handleAddWorker}
                style={{ background: 'var(--pbf-blue)', color: 'white' }}>Add</button>
            </div>
          </div>

          {/* Body (rich text) */}
          <div className="field-group">
            <label>Body</label>
            <RichTextEditor
              value={draft.body}
              onChange={v => setDraft({ ...draft, body: v })}
              onUploadImage={uploadInlineImage}
              placeholder="Multi-line notes. Use **bold**, *italic*, lists, links, and images."
              rows={8}
            />
            {draft.body && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, color: 'var(--pbf-muted)', cursor: 'pointer' }}>Preview</summary>
                <div style={{ padding: 10, background: 'var(--pbf-light)', borderRadius: 4, marginTop: 4 }}>
                  <RichTextView text={draft.body} />
                </div>
              </details>
            )}
          </div>

          {/* Hyperlinks */}
          <div className="field-group">
            <label>Hyperlinks</label>
            {draft.links.length === 0 && <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>No links yet.</div>}
            {draft.links.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>{l.label}</a>
                <UrlTransferMenu
                  label={l.label}
                  url={l.url}
                  source={{ kind: 'card', cardId: card.id }}
                  cards={allCards}
                  onMove={(t) => transferLink(l, 'move', t)}
                  onCopy={(t) => transferLink(l, 'copy', t)}
                />
                <button className="btn-ghost btn-sm" type="button" onClick={() => editLink(l.id)}>Edit</button>
                <button className="btn-danger btn-sm" type="button" onClick={() => deleteLink(l.id)}>Delete</button>
              </div>
            ))}
            <button className="btn-ghost btn-sm" type="button" onClick={addLink} style={{ alignSelf: 'flex-start', marginTop: 4 }}>+ Add link</button>
          </div>

          {/* Files */}
          <div className="field-group">
            <label>File attachments</label>
            {draft.files.length === 0 && <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>No files yet.</div>}
            {draft.files.map(f => {
              const latest = f.versions[f.versions.length - 1];
              const older = f.versions.slice(0, -1).reverse();
              const open = !!filesOpen[f.name];
              return (
                <div key={f.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--pbf-light)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn-ghost btn-sm" type="button" onClick={() => openVersion(latest.path)} style={{ flex: 1, textAlign: 'left' }}>
                      📎 {f.name} <span style={{ color: 'var(--pbf-muted)', fontSize: 11 }}> (latest, v{f.versions.length} · {fmtDate(latest.uploaded_at)} · by {latest.uploaded_by})</span>
                    </button>
                    {older.length > 0 && (
                      <button className="btn-ghost btn-sm" type="button" onClick={() => setFilesOpen(s => ({ ...s, [f.name]: !s[f.name] }))}>
                        {open ? '▾' : '▸'} {older.length} older
                      </button>
                    )}
                    <button
                      className="btn-danger btn-sm"
                      type="button"
                      title={f.versions.length === 1 ? 'Delete this file' : 'Delete latest version'}
                      onClick={() => deleteVersion(f.name, latest.path)}
                    >Delete</button>
                    {f.versions.length > 1 && (
                      <button
                        className="btn-danger btn-sm"
                        type="button"
                        title="Delete all versions of this file"
                        onClick={() => deleteAllVersions(f.name)}
                      >Delete all</button>
                    )}
                  </div>
                  {open && older.map((v, idx) => (
                    <div key={v.path} style={{ paddingLeft: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="btn-ghost btn-sm" type="button" onClick={() => openVersion(v.path)} style={{ flex: 1, textAlign: 'left' }}>
                        v{f.versions.length - 1 - idx} · {fmtDate(v.uploaded_at)} · by {v.uploaded_by}
                      </button>
                      <button className="btn-danger btn-sm" type="button" onClick={() => deleteVersion(f.name, v.path)}>Delete</button>
                    </div>
                  ))}
                </div>
              );
            })}
            <label className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: 6, cursor: 'pointer' }}>
              + Upload file
              <input type="file" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(f);
                e.target.value = '';
              }} />
            </label>
          </div>

          {/* History */}
          <div className="field-group">
            <label>Changes</label>
            {latestHistory && (
              <div style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--pbf-muted)' }}>{fmtDate(latestHistory.at)} · {latestHistory.by}: </span>
                {latestHistory.what}
              </div>
            )}
            {olderHistory.length > 0 && (
              <>
                <button className="btn-ghost btn-sm" type="button" onClick={() => setHistoryOpen(o => !o)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  {historyOpen ? '▾' : '▸'} {olderHistory.length} older
                </button>
                {historyOpen && (
                  <div style={{ padding: '4px 0 0 12px', maxHeight: 200, overflowY: 'auto' }}>
                    {olderHistory.map((h, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: 'var(--pbf-muted)', padding: '2px 0' }}>
                        {fmtDate(h.at)} · {h.by}: {h.what}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ECO reference */}
          <div className="field-row">
            <div className="field-group">
              <label>ECO Domain</label>
              <select value={draft.eco_domain ?? ''} onChange={e => {
                const v = e.target.value || null;
                setDraft({ ...draft, eco_domain: v, eco_task: null, eco_enabler: null });
              }}>
                <option value="">— No ECO reference —</option>
                {ECO_DOMAINS.map(d => <option key={d.id} value={d.id}>{d.name} ({d.weight})</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>ECO Task</label>
              <select disabled={!draft.eco_domain} value={draft.eco_task ?? ''} onChange={e => setDraft({ ...draft, eco_task: e.target.value || null, eco_enabler: null })}>
                <option value="">— Select task —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field-group">
            <label>ECO Enabler</label>
            <select disabled={!draft.eco_task} value={draft.eco_enabler ?? ''} onChange={e => setDraft({ ...draft, eco_enabler: e.target.value || null })}>
              <option value="">— Select enabler —</option>
              {enablers.map((en, i) => <option key={i} value={en}>{en}</option>)}
            </select>
          </div>

          {/* Literature reference */}
          <div className="field-row">
            <div className="field-group">
              <label>Literature</label>
              <select value={draft.lit_book ?? ''} onChange={e => setDraft({ ...draft, lit_book: (e.target.value || null) as Card['lit_book'], lit_chapter: null })}>
                <option value="">— None —</option>
                {LITERATURE.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Chapter</label>
              <select disabled={!draft.lit_book} value={draft.lit_chapter ?? ''} onChange={e => setDraft({ ...draft, lit_chapter: e.target.value || null })}>
                <option value="">— Select chapter —</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field-group">
            <label>Page</label>
            <input
              value={draft.lit_page ?? ''}
              onChange={e => setDraft({ ...draft, lit_page: e.target.value || null })}
              placeholder="e.g. 142–144"
              disabled={!draft.lit_book}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-danger" onClick={onDelete}>Delete card</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
