'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { STAGES, SECTORS, FIT_CRITERIA, COMPANY_ACTIVITIES, CONTACT_ACTIVITIES, COMPANY_STAGE_TRIGGERS, CONTACT_STAGE_TRIGGERS } from '@/lib/constants';
import { today, generateId, autoAdvanceStage, calcFitScore, fitColor } from '@/lib/helpers';
import { updateCompanyFields, upsertContact, deleteContactFromDb, createActivity, updateActivity, deleteActivityFromDb, upsertPlannedEvent, deletePlannedEvent } from '@/lib/db';
import { StageBadge, FitScoreDisplay } from '@/components/ui';
import { ContactModal, ActivityModal, UseTemplateModal } from '@/components/Modals';
import type { Company, Contact, Activity, PlannedEvent, Template, StageKey, FitScores } from '@/lib/types';

interface Props {
  company: Company;
  onChange: (c: Company) => void;
  onDelete: () => void;
  allCompanies: Company[];
  templates: Template[];
  scrollToEventId?: string | null;
}

// Build a Google Calendar "event template" URL — opens a pre-filled event
// in the user's browser. No OAuth required; the user just clicks "Save".
// Google Calendar URLs cannot carry custom reminders; the user's default
// reminder applies. For full 1 h + 12 h reminders, use the .ics download.
function googleCalendarUrl(ev: PlannedEvent, title: string): string {
  const dt = ev.event_date.replace(/-/g, '');
  // 09:00–10:00 local; Google interprets floating times in the user's tz
  const dates = `${dt}T090000/${dt}T100000`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details: ev.description || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build & download an .ics calendar event for a planned event
function downloadIcs(ev: PlannedEvent, title: string) {
  // 09:00 local-time start, 1h duration
  const dt = ev.event_date.replace(/-/g, '');
  const dtStart = `${dt}T090000`;
  const dtEnd = `${dt}T100000`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const safe = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OL Prospect Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@prospect-tracker.oliverlehmann.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${safe(title)}`,
    `DESCRIPTION:${safe(ev.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT12H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `event-${ev.event_date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// Fixed tile width so content never stretches over a wide box.
const TILE_WIDTH = 280;

// Collapsible tile wrapper. Collapsed: title + single-line preview. Expanded: full children (full row width).
function Tile({ title, preview, expanded, onToggle, children, width = TILE_WIDTH, accentBg, accentBorder }: {
  title: string;
  preview?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  width?: number;
  accentBg?: string;
  accentBorder?: string;
}) {
  return (
    <div
      onClick={!expanded ? onToggle : undefined}
      style={{
        flex: expanded ? '1 1 100%' : `0 0 ${width}px`,
        width: expanded ? '100%' : width,
        maxWidth: '100%',
        background: accentBg || 'var(--pbf-white)',
        border: `1px solid ${accentBorder || 'var(--pbf-border)'}`,
        borderRadius: 'var(--radius)',
        padding: '8px 10px',
        cursor: expanded ? 'default' : 'pointer',
        transition: 'flex-basis 0.2s, box-shadow 0.15s',
        boxShadow: expanded ? 'var(--shadow-md)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pbf-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <button
          className="btn-ghost btn-sm"
          style={{ fontSize: 10, padding: '0px 4px', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onToggle(); }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '\u2212' : '+'}
        </button>
      </div>
      {!expanded && preview !== undefined && (
        <div style={{ fontSize: 12, color: 'var(--pbf-text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview || <span style={{ color: 'var(--pbf-muted)', fontStyle: 'italic' }}>— empty —</span>}
        </div>
      )}
      {expanded && <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

const tileRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

export default function CompanyDetail({ company, onChange, onDelete, allCompanies, templates, scrollToEventId }: Props) {
  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const eventFormRef = useRef<HTMLDivElement | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const toggleTile = (key: string) => setExpandedTiles(p => ({ ...p, [key]: !p[key] }));
  const isExpanded = (key: string) => !!expandedTiles[key];

  useEffect(() => {
    if (!scrollToEventId) return;
    setExpandedTiles(p => ({ ...p, [`event-${scrollToEventId}`]: true }));
    // Scroll after the tile has had a chance to render in expanded state
    const frame = requestAnimationFrame(() => {
      const el = eventRefs.current[scrollToEventId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedEventId(scrollToEventId);
      }
    });
    const t = setTimeout(() => setHighlightedEventId(null), 2500);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [scrollToEventId, company.id]);

  const [contactModal, setContactModal] = useState<Contact | 'new' | null>(null);
  const [activityModal, setActivityModal] = useState(false);
  const [contactActivityModal, setContactActivityModal] = useState<string | null>(null);
  const [useTemplateContact, setUseTemplateContact] = useState<Contact | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ id: string; text: string; source: string } | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newEvent, setNewEvent] = useState<{ date: string; title: string; desc: string; target: 'company' | string }>({ date: '', title: '', desc: '', target: 'company' });
  const [showEventForm, setShowEventForm] = useState(false);

  const set = (key: string, value: unknown) => {
    const updated = { ...company, [key]: value, updated_at: today() };
    onChange(updated);
    updateCompanyFields(company.id, { [key]: value } as Partial<Company>);
  };

  const setFit = (criterionKey: string, value: number | undefined) => {
    const newScores = { ...company.fit_scores, [criterionKey]: value };
    const updated = { ...company, fit_scores: newScores, updated_at: today() };
    onChange(updated);
    updateCompanyFields(company.id, { fit_scores: newScores });
  };

  const saveContact = (contact: Contact) => {
    let contacts: Contact[];
    if (company.contacts.find(c => c.id === contact.id)) {
      contacts = company.contacts.map(c => (c.id === contact.id ? contact : c));
    } else {
      contacts = [...company.contacts, contact];
    }
    onChange({ ...company, contacts, updated_at: today() });
    upsertContact(company.id, contact);
    setContactModal(null);
  };

  const deleteContact = (id: string) => {
    onChange({ ...company, contacts: company.contacts.filter(c => c.id !== id), updated_at: today() });
    deleteContactFromDb(id);
  };

  const logActivity = (text: string) => {
    const activity: Activity = { id: generateId(), date: today(), text };
    const newStage = autoAdvanceStage(company.stage, text, COMPANY_STAGE_TRIGGERS);
    const updated = { ...company, activities: [...company.activities, activity], stage: newStage, updated_at: today() };
    onChange(updated);
    createActivity(company.id, null, activity);
    if (newStage !== company.stage) {
      updateCompanyFields(company.id, { stage: newStage });
    }
    setActivityModal(false);
  };

  const logContactActivity = (contactId: string, text: string) => {
    const activity: Activity = { id: generateId(), date: today(), text };
    const contacts = company.contacts.map(c => {
      if (c.id !== contactId) return c;
      return { ...c, activities: [...(c.activities || []), activity] };
    });
    const newStage = autoAdvanceStage(company.stage, text, CONTACT_STAGE_TRIGGERS);
    const updated = { ...company, contacts, stage: newStage, updated_at: today() };
    onChange(updated);
    createActivity(company.id, contactId, activity);
    if (newStage !== company.stage) {
      updateCompanyFields(company.id, { stage: newStage });
    }
    setContactActivityModal(null);
  };

  const deleteActivityHandler = (activityId: string) => {
    // Remove from company activities
    const inCompany = company.activities.find(a => a.id === activityId);
    if (inCompany) {
      onChange({ ...company, activities: company.activities.filter(a => a.id !== activityId), updated_at: today() });
    } else {
      // Remove from contact activities
      const contacts = company.contacts.map(c => ({
        ...c,
        activities: (c.activities || []).filter(a => a.id !== activityId),
      }));
      onChange({ ...company, contacts, updated_at: today() });
    }
    deleteActivityFromDb(activityId);
  };

  const editActivityHandler = (activityId: string, newText: string, source: string) => {
    if (source === 'company') {
      const activities = company.activities.map(a => (a.id === activityId ? { ...a, text: newText } : a));
      onChange({ ...company, activities, updated_at: today() });
    } else {
      const contacts = company.contacts.map(c => ({
        ...c,
        activities: (c.activities || []).map(a => (a.id === activityId ? { ...a, text: newText } : a)),
      }));
      onChange({ ...company, contacts, updated_at: today() });
    }
    updateActivity(activityId, newText);
    setEditingActivity(null);
  };

  const addPlannedEvent = () => {
    if (!newEvent.date || !newEvent.title) return;
    const ev: PlannedEvent = {
      id: generateId(), company_id: company.id,
      contact_id: newEvent.target === 'company' ? null : newEvent.target,
      event_date: newEvent.date,
      title: newEvent.title,
      description: newEvent.desc,
      done: false,
    };
    if (ev.contact_id) {
      const contacts = company.contacts.map(c =>
        c.id === ev.contact_id ? { ...c, planned_events: [...(c.planned_events || []), ev] } : c
      );
      onChange({ ...company, contacts, updated_at: today() });
    } else {
      onChange({ ...company, planned_events: [...(company.planned_events || []), ev], updated_at: today() });
    }
    upsertPlannedEvent(ev);
    setNewEvent({ date: '', title: '', desc: '', target: 'company' });
    setShowEventForm(false);
  };

  const completeEvent = (ev: PlannedEvent, withFollowUp: boolean) => {
    // 1. Create an activity log entry
    const activity: Activity = {
      id: generateId(),
      date: today(),
      text: `Completed: ${ev.title || ev.description}${ev.title && ev.description ? ' — ' + ev.description : ''}`,
    };
    if (ev.contact_id) {
      const contacts = company.contacts.map(c => {
        if (c.id !== ev.contact_id) return c;
        return {
          ...c,
          activities: [...(c.activities || []), activity],
          planned_events: (c.planned_events || []).filter(e => e.id !== ev.id),
        };
      });
      onChange({ ...company, contacts, updated_at: today() });
      createActivity(company.id, ev.contact_id, activity);
    } else {
      onChange({
        ...company,
        activities: [...company.activities, activity],
        planned_events: (company.planned_events || []).filter(e => e.id !== ev.id),
        updated_at: today(),
      });
      createActivity(company.id, null, activity);
    }
    // 2. Remove planned event from DB
    deletePlannedEvent(ev.id);

    // 3. If follow-up requested, pre-fill and open the new-event form
    if (withFollowUp) {
      setNewEvent({
        date: '',
        title: `Follow-up after ${ev.title || ev.description}`,
        desc: '',
        target: ev.contact_id || 'company',
      });
      setShowEventForm(true);
    }
  };

  const toggleEventDone = (ev: PlannedEvent) => {
    const updated = { ...ev, done: !ev.done };
    if (ev.contact_id) {
      const contacts = company.contacts.map(c =>
        c.id === ev.contact_id ? { ...c, planned_events: (c.planned_events || []).map(e => e.id === ev.id ? updated : e) } : c
      );
      onChange({ ...company, contacts, updated_at: today() });
    } else {
      onChange({ ...company, planned_events: (company.planned_events || []).map(e => e.id === ev.id ? updated : e), updated_at: today() });
    }
    upsertPlannedEvent(updated);
  };

  const startPlanEventFor = (targetId: 'company' | string) => {
    setNewEvent({ date: '', title: '', desc: '', target: targetId });
    setShowEventForm(true);
    // Scroll the form into view after render
    requestAnimationFrame(() => {
      eventFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const updateEventField = (ev: PlannedEvent, patch: Partial<PlannedEvent>) => {
    const updated = { ...ev, ...patch };
    if (ev.contact_id) {
      const contacts = company.contacts.map(c =>
        c.id === ev.contact_id
          ? { ...c, planned_events: (c.planned_events || []).map(e => e.id === ev.id ? updated : e) }
          : c
      );
      onChange({ ...company, contacts, updated_at: today() });
    } else {
      onChange({
        ...company,
        planned_events: (company.planned_events || []).map(e => e.id === ev.id ? updated : e),
        updated_at: today(),
      });
    }
    upsertPlannedEvent(updated);
  };

  const removeEvent = (ev: PlannedEvent) => {
    if (ev.contact_id) {
      const contacts = company.contacts.map(c =>
        c.id === ev.contact_id ? { ...c, planned_events: (c.planned_events || []).filter(e => e.id !== ev.id) } : c
      );
      onChange({ ...company, contacts, updated_at: today() });
    } else {
      onChange({ ...company, planned_events: (company.planned_events || []).filter(e => e.id !== ev.id), updated_at: today() });
    }
    deletePlannedEvent(ev.id);
  };

  // All planned events (company + contacts) for display
  const allEvents: (PlannedEvent & { ownerName: string })[] = [
    ...(company.planned_events || []).map(e => ({ ...e, ownerName: company.name })),
    ...company.contacts.flatMap(ct =>
      (ct.planned_events || []).map(e => ({ ...e, ownerName: ct.name || 'Contact' }))
    ),
  ].sort((a, b) => a.event_date.localeCompare(b.event_date));

  const todayDate = today();

  // Consolidated timeline
  const allActivities = [
    ...company.activities.map(a => ({ ...a, source: 'company', contactName: '' })),
    ...company.contacts.flatMap(ct =>
      (ct.activities || []).map(a => ({ ...a, source: 'contact', contactName: ct.name }))
    ),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const parentCompany = company.parent_id ? allCompanies.find(c => c.id === company.parent_id) : null;
  const childCompanies = allCompanies.filter(c => c.parent_id === company.id);

  const roleLabel = (role: string) => {
    switch (role) {
      case 'target': return 'Decision Maker';
      case 'champion': return 'Champion';
      case 'influencer': return 'Influencer';
      case 'gatekeeper': return 'Gatekeeper';
      case 'referral': return 'Referral';
      default: return role;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="detail-header">
        <div>
          {parentCompany && (
            <div style={{ fontSize: 11, color: 'var(--pbf-muted)', marginBottom: 2 }}>
              &uarr; {parentCompany.name}
            </div>
          )}
          <h2>{company.name}</h2>
          <div className="detail-header-meta">
            {company.hq && `${company.hq} · `}{company.country}
            {company.employees && ` · ~${company.employees} employees`}
            {company.sector && ` · ${company.sector}`}
            {childCompanies.length > 0 && ` · ${childCompanies.length} subsidiar${childCompanies.length === 1 ? 'y' : 'ies'}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StageBadge stage={company.stage} />
          <button className="btn-danger btn-sm" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {/* Company Profile */}
      <div className="section">
        <div className="section-header"><h3>Company Profile</h3></div>
        <div className="section-body">
          <div className="field-row">
            <div className="field-group">
              <label>Company Name</label>
              <input value={company.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Pipeline Stage</label>
              <select value={company.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Headquarters</label>
              <input value={company.hq} onChange={e => set('hq', e.target.value)} placeholder="City" />
            </div>
            <div className="field-group">
              <label>Country</label>
              <input value={company.country} onChange={e => set('country', e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Employees</label>
              <input value={company.employees} onChange={e => set('employees', e.target.value)} placeholder="e.g. 50,000" />
            </div>
            <div className="field-group">
              <label>Sector</label>
              <select value={company.sector} onChange={e => set('sector', e.target.value)}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row full">
            <div className="field-group">
              <label>Website</label>
              <input value={company.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="field-row full">
            <div className="field-group">
              <label>Parent Company</label>
              <select value={company.parent_id || ''} onChange={e => set('parent_id', e.target.value)}>
                <option value="">— None (top-level) —</option>
                {allCompanies.filter(c => c.id !== company.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="section">
        <div className="section-header"><h3>Tags</h3></div>
        <div className="section-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(company.tags || []).map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--pbf-yellow-bg)',
              color: '#b7791f', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              border: '1px solid #ecc94b',
            }}>
              {tag}
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b7791f', fontSize: 14, padding: 0, lineHeight: 1 }}
                onClick={() => set('tags', (company.tags || []).filter(t => t !== tag))}>&#10005;</button>
            </span>
          ))}
          <form onSubmit={e => {
            e.preventDefault();
            const t = newTag.trim();
            if (t && !(company.tags || []).includes(t)) {
              set('tags', [...(company.tags || []), t]);
            }
            setNewTag('');
          }} style={{ display: 'inline-flex', gap: 4 }}>
            <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add tag..."
              style={{ width: 100, fontSize: 12, padding: '3px 8px' }} />
            <button type="submit" className="btn-ghost btn-sm" style={{ fontSize: 11 }}>+</button>
          </form>
        </div>
      </div>

      {/* PBP Fit Assessment */}
      <div className="section">
        <div className="section-header"><h3>PBP Fit Assessment</h3></div>
        <div className="section-body">
          <FitScoreDisplay scores={company.fit_scores} />
          <div style={{ marginTop: 14 }}>
            {FIT_CRITERIA.map(cr => (
              <div key={cr.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{cr.label}</div>
                <select
                  value={company.fit_scores[cr.key] ?? ''}
                  onChange={e => setFit(cr.key, e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ width: 120 }}
                >
                  <option value="">Not rated</option>
                  <option value="0">0 – No</option>
                  <option value="1">1 – Unlikely</option>
                  <option value="2">2 – Likely</option>
                  <option value="3">3 – Confirmed</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pain Points & Entry Angle */}
      <div className="section">
        <div className="section-header"><h3>Pain Points &amp; Entry Angle</h3></div>
        <div className="section-body">
          <div style={tileRow}>
            <Tile
              title="Pain Points"
              preview={company.pain_points}
              expanded={isExpanded('pain')}
              onToggle={() => toggleTile('pain')}
              width={TILE_WIDTH}
            >
              <textarea value={company.pain_points} onChange={e => set('pain_points', e.target.value)} rows={4}
                placeholder="e.g. Unstructured project reporting across subsidiaries; inconsistent PM capability" />
            </Tile>
            <Tile
              title="Entry Angle"
              preview={company.entry_angle}
              expanded={isExpanded('entry')}
              onToggle={() => toggleTile('entry')}
              width={TILE_WIDTH}
            >
              <textarea value={company.entry_angle} onChange={e => set('entry_angle', e.target.value)} rows={4}
                placeholder="e.g. PMO Director spoke at PM conference 2025; L&D head is 2nd-degree LinkedIn connection" />
            </Tile>
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="section">
        <div className="section-header">
          <h3>Contacts ({company.contacts.length})</h3>
          <button className="btn-primary btn-sm" onClick={() => setContactModal('new')}>+ Add</button>
        </div>
        <div className="section-body">
          {company.contacts.length === 0 && (
            <div style={{ color: 'var(--pbf-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>
              No contacts yet. Research and add decision makers.
            </div>
          )}
          <div style={tileRow}>
          {company.contacts.map(ct => {
            const preview = [ct.title, ct.department, ct.email].filter(Boolean).join(' · ');
            return (
            <Tile
              key={ct.id}
              title={ct.name || 'Unnamed'}
              preview={preview}
              expanded={isExpanded(`contact-${ct.id}`)}
              onToggle={() => toggleTile(`contact-${ct.id}`)}
              width={TILE_WIDTH}
            >
            <div className="contact-card" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
              <div className="contact-card-header">
                <div>
                  <div className="contact-name">{ct.name || 'Unnamed'}</div>
                  <div className="contact-role">{ct.title}{ct.department && ` · ${ct.department}`}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {templates.length > 0 && (
                    <button className="btn-ghost btn-sm" onClick={() => setUseTemplateContact(ct)} title="Use message template" style={{ fontSize: 13 }}>&#9993;</button>
                  )}
                  <button className="btn-primary btn-sm" onClick={() => setContactActivityModal(ct.id)} title="Log activity">+ Log</button>
                  <button className="btn-ghost btn-sm" onClick={() => setContactModal(ct)}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => deleteContact(ct.id)}>&#10005;</button>
                </div>
              </div>
              {ct.email && (
                <div className="contact-detail">
                  &#9993; <a href={`mailto:${ct.email}`} style={{ color: 'var(--pbf-blue)' }}>{ct.email}</a>
                </div>
              )}
              {ct.linkedin && (
                <div className="contact-detail">
                  &#128279; <a href={ct.linkedin.startsWith('http') ? ct.linkedin : `https://${ct.linkedin}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pbf-blue)' }}>{ct.linkedin}</a>
                </div>
              )}
              {ct.phone && (
                <div className="contact-detail">
                  &#128222; <a href={`tel:${ct.phone}`} style={{ color: 'var(--pbf-blue)' }}>{ct.phone}</a>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <span className="stage-badge" style={{ background: 'var(--pbf-light)', color: 'var(--pbf-muted)', fontSize: 10 }}>
                  {roleLabel(ct.role)}
                </span>
              </div>
              {isExpanded(`contact-${ct.id}`) && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--pbf-border)', paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--pbf-muted)' }}>
                      Planned Events ({(ct.planned_events || []).length})
                    </div>
                    <button className="btn-primary btn-sm" style={{ fontSize: 10, padding: '1px 6px' }}
                      onClick={() => startPlanEventFor(ct.id)}>+ Plan Event</button>
                  </div>
                  {(ct.planned_events || []).length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--pbf-muted)', fontStyle: 'italic' }}>None planned.</div>
                  )}
                  {[...(ct.planned_events || [])].sort((a, b) => a.event_date.localeCompare(b.event_date)).map(ev => {
                    const isOverdue = !ev.done && ev.event_date < todayDate;
                    const isDueToday = !ev.done && ev.event_date === todayDate;
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', marginTop: 2,
                        fontSize: 11, borderRadius: 'var(--radius)',
                        background: ev.done ? 'var(--pbf-green-bg)' : isOverdue ? 'var(--pbf-red-bg)' : isDueToday ? 'var(--pbf-yellow-bg)' : 'var(--pbf-light)',
                      }}>
                        <span style={{ fontWeight: 600, color: isOverdue ? 'var(--pbf-red)' : isDueToday ? '#d69e2e' : 'var(--pbf-blue)' }}>
                          {ev.event_date}
                        </span>
                        <span style={{ flex: 1, textDecoration: ev.done ? 'line-through' : 'none' }}>
                          {ev.title || ev.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {(ct.activities || []).length > 0 && isExpanded(`contact-${ct.id}`) && (
                <div style={{ marginTop: 8, borderTop: '1px solid var(--pbf-border)', paddingTop: 6 }}>
                  {[...(ct.activities || [])].reverse().map(a => (
                    <div key={a.id} className="activity-item" style={{ padding: '4px 0', alignItems: 'flex-start' }}>
                      <div className="activity-date">{a.date}</div>
                      <div style={{ flex: 1 }}>
                        {editingActivity && editingActivity.id === a.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                            <textarea
                              value={editingActivity.text}
                              onChange={e => setEditingActivity({ ...editingActivity, text: e.target.value })}
                              style={{ flex: 1, fontSize: 12, padding: '4px 6px', minHeight: 36, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button className="btn-primary btn-sm" onClick={() => editActivityHandler(a.id, editingActivity.text, 'contact')}>&#10003;</button>
                              <button className="btn-ghost btn-sm" onClick={() => setEditingActivity(null)}>&#10005;</button>
                            </div>
                          </div>
                        ) : (
                          <div className="activity-text" style={{ fontSize: 12 }}>{a.text}</div>
                        )}
                      </div>
                      {(!editingActivity || editingActivity.id !== a.id) && (
                        <div style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                          <button className="btn-ghost btn-sm" style={{ fontSize: 10, padding: '0px 3px' }}
                            onClick={() => setEditingActivity({ id: a.id, text: a.text, source: 'contact' })}>&#9998;</button>
                          <button className="btn-danger btn-sm" style={{ fontSize: 10, padding: '0px 3px' }}
                            onClick={() => deleteActivityHandler(a.id)}>&#10005;</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </Tile>
            );
          })}
          </div>
        </div>
      </div>

      {/* Planned Events */}
      <div className="section">
        <div className="section-header">
          <h3>Planned Events ({allEvents.length})</h3>
          <button className="btn-primary btn-sm" onClick={() => setShowEventForm(!showEventForm)}>+ Plan Event</button>
        </div>
        <div className="section-body">
          {/* Add event form */}
          {showEventForm && (
            <div ref={eventFormRef} style={{ padding: 12, background: 'var(--pbf-yellow-bg)', borderRadius: 'var(--radius)', marginBottom: 12, border: '1px solid #ecc94b' }}>
              <div className="field-row">
                <div className="field-group">
                  <label>Date</label>
                  <input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
                </div>
                <div className="field-group">
                  <label>For</label>
                  <select value={newEvent.target} onChange={e => setNewEvent({ ...newEvent, target: e.target.value })}>
                    <option value="company">{company.name} (Company)</option>
                    {company.contacts.filter(c => c.name).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row full">
                <div className="field-group">
                  <label>Title</label>
                  <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g. Send proposal, Follow up call, Schedule demo..."
                    onKeyDown={e => { if (e.key === 'Enter') addPlannedEvent(); }} />
                </div>
              </div>
              <div className="field-row full">
                <div className="field-group">
                  <label>Description (optional)</label>
                  <textarea value={newEvent.desc} onChange={e => setNewEvent({ ...newEvent, desc: e.target.value })}
                    rows={3}
                    placeholder="Additional details included in the calendar entry..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn-primary btn-sm" onClick={addPlannedEvent} disabled={!newEvent.date || !newEvent.title}>Add</button>
                <button className="btn-ghost btn-sm" onClick={() => setShowEventForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {allEvents.length === 0 && !showEventForm && (
            <div style={{ color: 'var(--pbf-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>
              No events planned. Click &quot;+ Plan Event&quot; to schedule follow-ups.
            </div>
          )}

          <div style={tileRow}>
          {allEvents.map(ev => {
            const isOverdue = !ev.done && ev.event_date < todayDate;
            const isDueToday = !ev.done && ev.event_date === todayDate;
            const tileKey = `event-${ev.id}`;
            const headline = ev.title || ev.description;
            const preview = `${ev.event_date} · ${headline}`;
            return (
              <div key={ev.id}
                ref={el => { eventRefs.current[ev.id] = el; }}
                style={{
                  flex: isExpanded(tileKey) ? '1 1 100%' : `0 0 ${TILE_WIDTH}px`,
                  width: isExpanded(tileKey) ? '100%' : TILE_WIDTH, maxWidth: '100%',
                  boxShadow: highlightedEventId === ev.id ? '0 0 0 3px var(--pbf-navy)' : undefined,
                  borderRadius: 'var(--radius)',
                  transition: 'box-shadow 0.3s',
                }}>
                <Tile
                  title={`${ev.contact_id ? ev.ownerName : 'Company'}${isOverdue ? ' · OVERDUE' : isDueToday ? ' · TODAY' : ''}`}
                  preview={preview}
                  expanded={isExpanded(tileKey)}
                  onToggle={() => toggleTile(tileKey)}
                  width={TILE_WIDTH}
                  accentBg={ev.done ? 'var(--pbf-green-bg)' : isOverdue ? 'var(--pbf-red-bg)' : isDueToday ? 'var(--pbf-yellow-bg)' : 'var(--pbf-light)'}
                  accentBorder={ev.done ? 'var(--stage-won)' : isOverdue ? 'var(--pbf-red)' : isDueToday ? '#ecc94b' : 'var(--pbf-border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: ev.done ? 0.7 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={ev.title || ''}
                        onChange={e => updateEventField(ev, { title: e.target.value })}
                        placeholder="Title"
                        style={{ fontSize: 13, fontWeight: 600, padding: '4px 6px' }}
                      />
                      <textarea
                        value={ev.description || ''}
                        onChange={e => updateEventField(ev, { description: e.target.value })}
                        placeholder="Description (optional — also written into calendar entry)"
                        rows={3}
                        style={{ fontSize: 12, padding: '4px 6px', marginTop: 4, resize: 'vertical' }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--pbf-muted)', marginTop: 4 }}>
                        <input
                          type="date"
                          value={ev.event_date}
                          onChange={e => updateEventField(ev, { event_date: e.target.value })}
                          style={{ width: 'auto', fontSize: 11, padding: '2px 6px', display: 'inline-block' }}
                        />
                        {ev.contact_id ? <span> · {ev.ownerName}</span> : <span> · Company</span>}
                        {isOverdue && <span style={{ color: 'var(--pbf-red)', fontWeight: 600 }}> · OVERDUE</span>}
                        {isDueToday && <span style={{ color: '#d69e2e', fontWeight: 600 }}> · TODAY</span>}
                      </div>
                    </div>
                    <a
                      href={googleCalendarUrl(ev, `${headline} — ${ev.contact_id ? ev.ownerName + ' @ ' : ''}${company.name}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '1px 5px', flexShrink: 0, textDecoration: 'none', fontWeight: 700, color: '#4285F4' }}
                      title="Add to Google Calendar (opens pre-filled, just click Save)"
                      onClick={e => e.stopPropagation()}
                    >G&#128197;</a>
                    <button className="btn-ghost btn-sm" style={{ fontSize: 13, padding: '0px 4px', flexShrink: 0 }}
                      title="Download .ics file (Outlook, Apple Calendar, etc. — 9 AM, 1h, reminders 1h & 12h before)"
                      onClick={() => downloadIcs(ev, `${headline} — ${ev.contact_id ? ev.ownerName + ' @ ' : ''}${company.name}`)}>&#128197;</button>
                    <button className="btn-danger btn-sm" style={{ fontSize: 10, padding: '0px 4px', flexShrink: 0 }}
                      onClick={() => removeEvent(ev)}>&#10005;</button>
                  </div>
                  {!ev.done && (
                    <div style={{ marginTop: 8, padding: '6px 8px', borderTop: '1px dashed var(--pbf-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={false} onChange={() => completeEvent(ev, false)}
                          style={{ width: 'auto', flex: '0 0 auto', margin: 0, cursor: 'pointer', accentColor: 'var(--stage-won)' }} />
                        <span>Completed</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={false} onChange={() => completeEvent(ev, true)}
                          style={{ width: 'auto', flex: '0 0 auto', margin: 0, cursor: 'pointer', accentColor: 'var(--stage-won)' }} />
                        <span>Completed, plan follow-up</span>
                      </label>
                    </div>
                  )}
                </Tile>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Consolidated Activity Log */}
      <div className="section">
        <div className="section-header">
          <h3>Activity Log ({allActivities.length})</h3>
          <button className="btn-primary btn-sm" onClick={() => setActivityModal(true)}>+ Company Log</button>
        </div>
        <div className="section-body">
          {allActivities.length === 0 && (
            <div style={{ color: 'var(--pbf-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>
              No activities logged yet.
            </div>
          )}
          <div style={tileRow}>
          {allActivities.map(a => {
            const tileKey = `activity-${a.id}`;
            const titleStr = `${a.date}${a.contactName ? ' · ' + a.contactName : ''}`;
            return (
            <Tile
              key={a.id}
              title={titleStr}
              preview={a.text}
              expanded={isExpanded(tileKey)}
              onToggle={() => toggleTile(tileKey)}
              width={TILE_WIDTH}
            >
              <div className="activity-item" style={{ alignItems: 'flex-start', padding: 0 }}>
                <div style={{ flex: 1 }}>
                  {editingActivity && editingActivity.id === a.id ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                      <textarea
                        value={editingActivity.text}
                        onChange={e => setEditingActivity({ ...editingActivity, text: e.target.value })}
                        style={{ flex: 1, fontSize: 13, padding: '4px 6px', minHeight: 36, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button className="btn-primary btn-sm" onClick={() => editActivityHandler(a.id, editingActivity.text, a.source)}>&#10003;</button>
                        <button className="btn-ghost btn-sm" onClick={() => setEditingActivity(null)}>&#10005;</button>
                      </div>
                    </div>
                  ) : (
                    <div className="activity-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {a.contactName && <span style={{ fontWeight: 600, color: 'var(--pbf-blue)', marginRight: 6 }}>{a.contactName}:</span>}
                      {a.text}
                    </div>
                  )}
                </div>
                {(!editingActivity || editingActivity.id !== a.id) && (
                  <div style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                    <button className="btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 4px' }}
                      onClick={() => setEditingActivity({ id: a.id, text: a.text, source: a.source })}>&#9998;</button>
                    <button className="btn-danger btn-sm" style={{ fontSize: 11, padding: '1px 4px' }}
                      onClick={() => deleteActivityHandler(a.id)}>&#10005;</button>
                  </div>
                )}
              </div>
            </Tile>
            );
          })}
          </div>
        </div>
      </div>

      {/* General Notes */}
      <div className="section">
        <div className="section-header"><h3>General Notes</h3></div>
        <div className="section-body">
          <textarea value={company.notes} onChange={e => set('notes', e.target.value)} rows={4}
            placeholder="Free-form notes — research findings, strategic observations, follow-up reminders..." />
        </div>
      </div>

      {/* Modals */}
      {contactModal && (
        <ContactModal
          contact={contactModal === 'new' ? null : contactModal}
          onSave={saveContact}
          onClose={() => setContactModal(null)}
        />
      )}
      {activityModal && (
        <ActivityModal onSave={logActivity} onClose={() => setActivityModal(false)} templates={COMPANY_ACTIVITIES} label="Log Company Activity" />
      )}
      {contactActivityModal && (
        <ActivityModal
          onSave={(text) => logContactActivity(contactActivityModal, text)}
          onClose={() => setContactActivityModal(null)}
          templates={CONTACT_ACTIVITIES}
          label={`Log Activity — ${(company.contacts.find(c => c.id === contactActivityModal))?.name || ''}`}
        />
      )}
      {useTemplateContact && templates.length > 0 && (
        <UseTemplateModal
          templates={templates}
          contact={useTemplateContact}
          company={company}
          onClose={() => setUseTemplateContact(null)}
        />
      )}
    </div>
  );
}
