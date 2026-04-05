'use client';

import { useState } from 'react';
import { generateId } from '@/lib/helpers';
import { fillTemplate } from '@/lib/helpers';
import type { Contact, Company, Template } from '@/lib/types';

// ─── Contact Modal ───
export function ContactModal({
  contact,
  onSave,
  onClose,
}: {
  contact: Contact | null;
  onSave: (c: Contact) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Contact>(
    contact || {
      id: generateId(),
      name: '',
      title: '',
      department: '',
      email: '',
      phone: '',
      linkedin: '',
      role: 'target',
      notes: '',
      activities: [],
    }
  );
  const set = (k: keyof Contact, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{contact ? 'Edit Contact' : 'Add Contact'}</h3>
          <button className="btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field-group">
              <label>Full Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Job Title</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. PMO, L&D, Operations" />
            </div>
            <div className="field-group">
              <label>Role in Decision</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="target">Target Decision Maker</option>
                <option value="champion">Internal Champion</option>
                <option value="influencer">Influencer</option>
                <option value="gatekeeper">Gatekeeper</option>
                <option value="referral">Referral / Connector</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="field-row full">
            <div className="field-group">
              <label>LinkedIn URL</label>
              <input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} />
            </div>
          </div>
          <div className="field-row full">
            <div className="field-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>Save Contact</button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Modal ───
export function ActivityModal({
  onSave,
  onClose,
  templates,
  label,
}: {
  onSave: (text: string) => void;
  onClose: () => void;
  templates: string[];
  label?: string;
}) {
  const [selected, setSelected] = useState('');
  const [details, setDetails] = useState('');
  const buildText = () => {
    if (selected && details) return `${selected} — ${details}`;
    if (selected) return selected;
    return details;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <div className="modal-header">
          <h3>{label || 'Log Activity'}</h3>
          <button className="btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <div className="field-group" style={{ marginBottom: 10 }}>
            <label>Activity Type</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— Custom (type below) —</option>
              {templates.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>{selected ? 'Details (optional)' : 'Activity description'}</label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={2}
              placeholder={selected ? 'e.g. Discussed PBP certification scope' : 'e.g. Identified via conference speaker list'}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { const t = buildText(); if (t.trim()) onSave(t.trim()); }}
            disabled={!selected && !details.trim()}
          >
            Log
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Manager Modal ───
export function TemplateManagerModal({
  templates,
  onSave,
  onClose,
}: {
  templates: Template[];
  onSave: (templates: Template[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState([...templates]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', body: '' });

  const startEdit = (idx: number) => {
    setEditing(idx);
    setForm({ name: list[idx].name, body: list[idx].body });
  };
  const startNew = () => {
    setEditing('new');
    setForm({ name: '', body: '' });
  };
  const save = () => {
    if (!form.name.trim() || !form.body.trim()) return;
    if (editing === 'new') {
      setList([...list, { id: generateId(), name: form.name, body: form.body, sort_order: list.length }]);
    } else if (typeof editing === 'number') {
      setList(list.map((t, i) => (i === editing ? { ...t, name: form.name, body: form.body } : t)));
    }
    setEditing(null);
  };
  const remove = (idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 580, maxHeight: '85vh' }}>
        <div className="modal-header">
          <h3>Message Templates</h3>
          <button className="btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 12 }}>
            Placeholders: [Anrede], [Nachname], [Vorname], [Name], [Titel], [Unternehmen], [Abteilung], [E-Mail], [LinkedIn]
          </p>
          {list.map((t, idx) => (
            <div key={t.id} style={{ marginBottom: 10, padding: 10, background: 'var(--pbf-light)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
              {editing === idx ? (
                <div>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Template name" style={{ marginBottom: 6, fontWeight: 600 }} />
                  <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button className="btn-primary btn-sm" onClick={save}>Save</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost btn-sm" onClick={() => startEdit(idx)}>&#9998;</button>
                      <button className="btn-danger btn-sm" onClick={() => remove(idx)}>&#10005;</button>
                    </div>
                  </div>
                  <pre style={{ fontSize: 12, color: 'var(--pbf-muted)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.4 }}>{t.body}</pre>
                </div>
              )}
            </div>
          ))}
          {editing === 'new' && (
            <div style={{ marginBottom: 10, padding: 10, background: 'var(--pbf-yellow-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Template name" style={{ marginBottom: 6, fontWeight: 600 }} />
              <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Message body with [Placeholders]..." style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button className="btn-primary btn-sm" onClick={save}>Save</button>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={startNew}>+ New Template</button>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { onSave(list); onClose(); }}>Save All</button>
        </div>
      </div>
    </div>
  );
}

// ─── Use Template Modal ───
export function UseTemplateModal({
  templates,
  contact,
  company,
  onClose,
}: {
  templates: Template[];
  contact: Contact;
  company: Company;
  onClose: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [anrede, setAnrede] = useState('Herr');
  const [copied, setCopied] = useState(false);

  const contactWithAnrede = { ...contact, _anrede: anrede };
  const filled = templates.length > 0 ? fillTemplate(templates[selectedIdx].body, contactWithAnrede, company) : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(filled).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        <div className="modal-header">
          <h3>Message for {contact.name || 'Contact'}</h3>
          <button className="btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field-group">
              <label>Template</label>
              <select value={selectedIdx} onChange={e => setSelectedIdx(Number(e.target.value))}>
                {templates.map((t, i) => (
                  <option key={t.id} value={i}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Anrede</label>
              <select value={anrede} onChange={e => setAnrede(e.target.value)}>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10, padding: 14, background: 'var(--pbf-light)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit', minHeight: 120 }}>
            {filled}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={copyToClipboard}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
