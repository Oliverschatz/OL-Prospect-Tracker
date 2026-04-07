'use client';

import { useState, useEffect } from 'react';
import { STAGES } from '@/lib/constants';
import { generateId, today, calcFitScore, fitColor, EMPTY_COMPANY } from '@/lib/helpers';
import { loadAllCompanies, loadTemplates, createCompany, updateCompanyFields, deleteCompanyFromDb, saveAllTemplates, bulkImportCompanies } from '@/lib/db';
import { StageBadge, PipelineBar } from '@/components/ui';
import { TemplateManagerModal } from '@/components/Modals';
import CompanyDetail from '@/components/CompanyDetail';
import TimelineDiagram from '@/components/TimelineDiagram';
import type { Company, Template } from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ─── Local save/load ───
function saveLocally(companies: Company[], filterFn?: (c: Company) => boolean) {
  const data = filterFn ? companies.filter(filterFn) : companies;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospect-tracker-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function openLocalFile(): Promise<Company[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          let data = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(data)) data = [data];
          resolve(data as Company[]);
        } catch {
          alert('Invalid JSON file');
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// ─── Duplicate check ───
async function checkDuplicate(params: { company_name?: string; contact_name?: string; contact_email?: string }): Promise<{ duplicate: boolean; message?: string } | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch('/api/check-duplicate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return null;
}

// ─── Main Tracker ───
export default function Tracker({ user, onLogout, isAdmin, onAdmin, onSettings }: {
  user: User; onLogout: () => void; isAdmin?: boolean; onAdmin?: () => void; onSettings?: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [search, setSearch] = useState('');
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [view, setView] = useState<'pipeline' | 'followups' | 'history'>('pipeline');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    (async () => {
      const [cos, tpls] = await Promise.all([loadAllCompanies(), loadTemplates()]);
      setCompanies(cos);
      setTemplates(tpls);
      setLoading(false);
    })();
  }, []);

  const selected = companies.find(c => c.id === selectedId);

  // Gather all tags
  const allTags = Array.from(new Set(companies.flatMap(c => c.tags || []))).sort();

  // Enhanced search: company name, contact name, contact email, HQ, sector
  const matchesSearch = (c: Company, q: string) => {
    const lq = q.toLowerCase();
    if (c.name.toLowerCase().includes(lq)) return true;
    if (c.hq.toLowerCase().includes(lq)) return true;
    if (c.sector.toLowerCase().includes(lq)) return true;
    if (c.contacts.some(ct => ct.name.toLowerCase().includes(lq))) return true;
    if (c.contacts.some(ct => ct.email.toLowerCase().includes(lq))) return true;
    if (c.contacts.some(ct => ct.title.toLowerCase().includes(lq))) return true;
    return false;
  };

  const filtered = companies.filter(c => {
    if (filterStage !== 'all' && c.stage !== filterStage) return false;
    if (filterTag !== 'all' && !(c.tags || []).includes(filterTag)) return false;
    if (search && !matchesSearch(c, search)) return false;
    return true;
  });

  const addCompany = async () => {
    const newCo: Company = {
      ...EMPTY_COMPANY,
      id: generateId(),
      name: 'New Company',
      created_at: today(),
      updated_at: today(),
    } as Company;
    setCompanies(prev => [newCo, ...prev]);
    setSelectedId(newCo.id);
    setView('pipeline');
    await createCompany(newCo);
  };

  const updateCompany = (updated: Company) => {
    // Update state immediately so the UI stays responsive
    setCompanies(prev => prev.map(c => (c.id === updated.id ? updated : c)));

    // Run duplicate checks in the background (non-blocking)
    const old = companies.find(c => c.id === updated.id);
    if (old && old.name !== updated.name && updated.name !== 'New Company') {
      checkDuplicate({ company_name: updated.name }).then(result => {
        if (result?.duplicate) {
          setDuplicateWarning(result.message || 'This prospect is tracked by another ambassador.');
          setTimeout(() => setDuplicateWarning(null), 10000);
        }
      });
    }

    if (old) {
      for (const ct of updated.contacts) {
        const oldCt = old.contacts.find(oc => oc.id === ct.id);
        const isNew = !oldCt;
        const nameChanged = oldCt && oldCt.name !== ct.name && ct.name;
        const emailChanged = oldCt && oldCt.email !== ct.email && ct.email;
        if ((isNew && (ct.name || ct.email)) || nameChanged || emailChanged) {
          checkDuplicate({ contact_name: ct.name || undefined, contact_email: ct.email || undefined }).then(result => {
            if (result?.duplicate) {
              setDuplicateWarning(result.message || 'This contact is known to another ambassador.');
              setTimeout(() => setDuplicateWarning(null), 10000);
            }
          });
          break;
        }
      }
    }
  };

  const deleteCompany = async () => {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
    setCompanies(prev => prev.filter(c => c.id !== selected.id));
    setSelectedId(null);
    await deleteCompanyFromDb(selected.id);
  };

  const handleSaveLocally = (filterFn?: (c: Company) => boolean) => {
    saveLocally(companies, filterFn);
    setStatusMsg(`Saved to file`);
    setExportMenuOpen(false);
  };

  const handleOpenLocal = async () => {
    const data = await openLocalFile();
    if (!data) return;
    setCompanies(prev => {
      const merged = [...prev];
      data.forEach(imp => {
        const existingIdx = merged.findIndex(e => e.name.toLowerCase() === imp.name.toLowerCase());
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], ...imp, id: merged[existingIdx].id, created_at: merged[existingIdx].created_at, updated_at: today() };
        } else {
          merged.push({ ...imp, id: imp.id || generateId() });
        }
      });
      bulkImportCompanies(merged);
      return merged;
    });
    setStatusMsg(`Loaded ${data.length} companies from file`);
  };

  const handleRequestSupport = async () => {
    if (!supabase) { setStatusMsg('Not configured'); return; }
    if (!confirm('Send an email to Oliver requesting sales support?')) return;
    const message = prompt('Optional: add a short note about what you need help with:', '') || '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setStatusMsg('Not signed in'); return; }
      const res = await fetch('/api/request-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatusMsg('Sales support request sent to Oliver');
    } catch {
      setStatusMsg('Failed to send support request');
    }
  };

  const handleSaveTemplates = async (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    await saveAllTemplates(newTemplates);
  };

  // ─── Follow-up data (from planned events) ───
  const todayStr = today();

  type FollowUpItem = { id: string; label: string; sublabel?: string; follow_up_date: string; next_action: string; companyId: string; type: 'company' | 'contact'; done?: boolean };

  const allFollowUps: FollowUpItem[] = [];

  for (const co of companies) {
    for (const ev of co.planned_events || []) {
      allFollowUps.push({
        id: ev.id, label: co.name,
        follow_up_date: ev.event_date, next_action: ev.title || ev.description,
        companyId: co.id, type: 'company', done: ev.done,
      });
    }
    for (const ct of co.contacts) {
      for (const ev of ct.planned_events || []) {
        allFollowUps.push({
          id: ev.id, label: ct.name || 'Contact', sublabel: co.name,
          follow_up_date: ev.event_date, next_action: ev.title || ev.description,
          companyId: co.id, type: 'contact', done: ev.done,
        });
      }
    }
  }

  // Filter out completed events
  const pendingFollowUps = allFollowUps.filter(f => !f.done);
  const overdue = pendingFollowUps.filter(f => f.follow_up_date < todayStr).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));
  const dueToday = pendingFollowUps.filter(f => f.follow_up_date === todayStr);
  const upcoming = pendingFollowUps.filter(f => f.follow_up_date > todayStr).sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date)).slice(0, 15);

  // ─── Global activity timeline ───
  const globalTimeline = companies.flatMap(co => [
    ...co.activities.map(a => ({ ...a, companyName: co.name, companyId: co.id, contactName: '', stage: co.stage })),
    ...co.contacts.flatMap(ct =>
      (ct.activities || []).map(a => ({ ...a, companyName: co.name, companyId: co.id, contactName: ct.name, stage: co.stage }))
    ),
  ]).sort((a, b) => b.date.localeCompare(a.date));

  // Group timeline by date for swimlane display
  const timelineDates = Array.from(new Set(globalTimeline.map(a => a.date))).sort((a, b) => b.localeCompare(a));
  const timelineCompanies = Array.from(new Set(globalTimeline.map(a => a.companyName))).sort();

  // ─── Sidebar: grouped and sorted ───
  const hasNamedContact = (c: Company) => c.contacts.some(ct => ct.name && ct.name.trim());

  const buildTree = (list: Company[]) => {
    const topLevel = list.filter(c => !c.parent_id || !list.find(p => p.id === c.parent_id));
    const getChildren = (parentId: string, depth: number): Array<Company & { depth: number }> => {
      const children = list
        .filter(c => c.parent_id === parentId)
        .sort((a, b) => calcFitScore(b.fit_scores) - calcFitScore(a.fit_scores));
      return children.flatMap(c => [{ ...c, depth }, ...getChildren(c.id, depth + 1)]);
    };
    return topLevel.flatMap(c => [{ ...c, depth: 0 }, ...getChildren(c.id, 1)]);
  };

  const withContacts = filtered.filter(hasNamedContact).sort((a, b) => calcFitScore(b.fit_scores) - calcFitScore(a.fit_scores));
  const withoutContacts = filtered.filter(c => !hasNamedContact(c)).sort((a, b) => calcFitScore(b.fit_scores) - calcFitScore(a.fit_scores));
  const treeWith = buildTree(withContacts);
  const treeWithout = buildTree(withoutContacts);

  const renderItem = (c: Company & { depth?: number }) => {
    const score = calcFitScore(c.fit_scores);
    return (
      <div
        key={c.id}
        className={`company-item ${selectedId === c.id ? 'active' : ''}`}
        onClick={() => { setSelectedId(c.id); setView('pipeline'); }}
        style={{ paddingLeft: 16 + (c.depth || 0) * 16 }}
      >
        <div className="company-item-name">
          {(c.depth || 0) > 0 && <span style={{ color: 'var(--pbf-border)', marginRight: 4, fontSize: 11 }}>&lfloor;</span>}
          {c.name}
        </div>
        <div className="company-item-meta">
          <StageBadge stage={c.stage} />
          {score > 0 && (
            <span style={{ marginLeft: 4, fontWeight: 600, color: fitColor(score), fontSize: 11 }}>{score}%</span>
          )}
          {c.hq && ` · ${c.hq}`}
          {c.contacts.length > 0 && ` · ${c.contacts.filter(ct => ct.name && ct.name.trim()).length} named`}
          {(c.tags || []).length > 0 && (
            <span style={{ marginLeft: 4 }}>{(c.tags || []).map(t => <span key={t} style={{ background: 'var(--pbf-yellow-bg)', color: 'var(--pbf-accent)', fontSize: 9, padding: '1px 4px', borderRadius: 2, marginLeft: 2 }}>{t}</span>)}</span>
          )}
          {(c.planned_events || []).some(e => !e.done && e.event_date <= todayStr) && (
            <span style={{ color: 'var(--pbf-red)', fontWeight: 600, marginLeft: 4 }}>&#9888;</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="app-header">
        <h1>Prospect Tracker <span>— OliverLehmann.com</span></h1>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={() => setTemplateManagerOpen(true)} title="Message templates">
            &#9993; Templates
          </button>
          <button className="btn-secondary btn-sm" onClick={handleRequestSupport} title="Email Oliver for help">
            &#9758; Request sales support
          </button>
          <button className="btn-secondary btn-sm" onClick={handleOpenLocal}>
            Open Saved
          </button>
          {/* Export dropdown */}
          <div style={{ position: 'relative' }}>
            <button className="btn-secondary btn-sm" onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={companies.length === 0}>
              Export &#9662;
            </button>
            {exportMenuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--pbf-white)', border: '1px solid var(--pbf-border)',
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', zIndex: 50, minWidth: 200, padding: 4,
              }}>
                <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pbf-text)' }}
                  onClick={() => handleSaveLocally()}>
                  All Companies ({companies.length})
                </button>
                {filterStage !== 'all' && (
                  <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pbf-text)' }}
                    onClick={() => handleSaveLocally(c => c.stage === filterStage)}>
                    Current Filter: {STAGES.find(s => s.key === filterStage)?.label} ({filtered.length})
                  </button>
                )}
                {selected && (
                  <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pbf-text)' }}
                    onClick={() => handleSaveLocally(c => c.id === selected.id)}>
                    Selected: {selected.name}
                  </button>
                )}
                <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pbf-muted)' }}
                  onClick={() => setExportMenuOpen(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button className="btn-primary btn-sm" onClick={addCompany}>+ Company</button>
          {isAdmin && onAdmin && (
            <button className="btn-secondary btn-sm" onClick={onAdmin} title="Admin Dashboard">Admin</button>
          )}
          <button className="btn-ghost btn-sm" onClick={onSettings} title="Settings" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
            {user.email}
          </button>
          <button className="btn-ghost btn-sm" onClick={onLogout} title="Log out" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Logout</button>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div style={{ background: 'var(--pbf-yellow-bg)', padding: '8px 24px', fontSize: 13, color: '#b7791f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ecc94b' }}>
          <span>&#9888; {duplicateWarning}</span>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => setDuplicateWarning(null)}>&#10005;</button>
        </div>
      )}

      {/* Status bar */}
      {statusMsg && (
        <div style={{ background: 'var(--pbf-blue-bg)', padding: '4px 24px', fontSize: 12, color: 'var(--pbf-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{statusMsg}</span>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '1px 6px' }} onClick={() => setStatusMsg('')}>&#10005;</button>
        </div>
      )}

      {/* Template Manager Modal */}
      {templateManagerOpen && (
        <TemplateManagerModal
          templates={templates}
          onSave={handleSaveTemplates}
          onClose={() => setTemplateManagerOpen(false)}
        />
      )}

      {/* Body: sidebar + main */}
      <div className="app-body">
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>Pipeline</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 90, padding: '3px 6px', fontSize: 11 }}>
                <option value="all">All stages</option>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              {allTags.length > 0 && (
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ width: 80, padding: '3px 6px', fontSize: 11 }}>
                  <option value="all">All tags</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
          </div>
          <PipelineBar companies={companies} />

          {/* View tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--pbf-border)', padding: '0 8px' }}>
            {([['pipeline', 'Companies'], ['followups', 'Follow-ups'], ['history', 'History']] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setView(k); if (k === 'followups' || k === 'history') setSelectedId(null); }}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: view === k ? '2px solid var(--pbf-navy)' : '2px solid transparent',
                  color: view === k ? 'var(--pbf-navy)' : 'var(--pbf-muted)',
                }}>
                {label}
                {k === 'followups' && overdue.length > 0 && (
                  <span style={{ background: 'var(--pbf-red)', color: 'white', borderRadius: 8, padding: '0 5px', fontSize: 9, marginLeft: 3 }}>{overdue.length}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: '0 12px 8px', marginTop: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies, contacts..." style={{ fontSize: 12, padding: '5px 8px' }} />
          </div>

          {/* View content */}
          <div className="company-list">
            {view === 'pipeline' && (
              <>
                {filtered.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--pbf-muted)', fontSize: 13 }}>
                    {companies.length === 0 ? 'No companies yet. Add one to start.' : 'No matches.'}
                  </div>
                )}
                {treeWith.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pbf-green)' }}>
                      With Contacts ({withContacts.length})
                    </div>
                    {treeWith.map(renderItem)}
                  </div>
                )}
                {treeWithout.length > 0 && (
                  <div>
                    <div style={{
                      padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: 'var(--pbf-muted)',
                      borderTop: treeWith.length > 0 ? '1px solid var(--pbf-border)' : 'none',
                      marginTop: treeWith.length > 0 ? 4 : 0,
                    }}>
                      Research Needed ({withoutContacts.length})
                    </div>
                    {treeWithout.map(renderItem)}
                  </div>
                )}
              </>
            )}

            {view === 'followups' && (
              <div style={{ padding: '0 4px' }}>
                {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--pbf-muted)', fontSize: 13 }}>No follow-ups scheduled.</div>
                )}
                {overdue.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pbf-red)' }}>
                      Overdue ({overdue.length})
                    </div>
                    {overdue.map(f => (
                      <div key={`${f.type}-${f.id}`} className={`company-item ${selectedId === f.companyId ? 'active' : ''}`}
                        onClick={() => { setSelectedId(f.companyId); setView('pipeline'); }} style={{ paddingLeft: 16 }}>
                        <div className="company-item-name">
                          {f.type === 'contact' && <span style={{ color: 'var(--pbf-blue)', fontSize: 10, marginRight: 4 }}>&#9679;</span>}
                          {f.label}
                        </div>
                        <div className="company-item-meta">
                          <span style={{ color: 'var(--pbf-red)', fontWeight: 600 }}>{f.follow_up_date}</span>
                          {f.sublabel && <span style={{ color: 'var(--pbf-muted)' }}> @ {f.sublabel}</span>}
                          {f.next_action && <span> · {f.next_action}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {dueToday.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pbf-accent)' }}>
                      Due Today ({dueToday.length})
                    </div>
                    {dueToday.map(f => (
                      <div key={`${f.type}-${f.id}`} className={`company-item ${selectedId === f.companyId ? 'active' : ''}`}
                        onClick={() => { setSelectedId(f.companyId); setView('pipeline'); }} style={{ paddingLeft: 16 }}>
                        <div className="company-item-name">
                          {f.type === 'contact' && <span style={{ color: 'var(--pbf-blue)', fontSize: 10, marginRight: 4 }}>&#9679;</span>}
                          {f.label}
                        </div>
                        <div className="company-item-meta">
                          {f.sublabel && <span style={{ color: 'var(--pbf-muted)' }}>{f.sublabel} · </span>}
                          {f.next_action || 'Follow up today'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {upcoming.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pbf-blue)' }}>
                      Upcoming
                    </div>
                    {upcoming.map(f => (
                      <div key={`${f.type}-${f.id}`} className={`company-item ${selectedId === f.companyId ? 'active' : ''}`}
                        onClick={() => { setSelectedId(f.companyId); setView('pipeline'); }} style={{ paddingLeft: 16 }}>
                        <div className="company-item-name">
                          {f.type === 'contact' && <span style={{ color: 'var(--pbf-blue)', fontSize: 10, marginRight: 4 }}>&#9679;</span>}
                          {f.label}
                        </div>
                        <div className="company-item-meta">
                          <span style={{ color: 'var(--pbf-blue)' }}>{f.follow_up_date}</span>
                          {f.sublabel && <span style={{ color: 'var(--pbf-muted)' }}> @ {f.sublabel}</span>}
                          {f.next_action && <span> · {f.next_action}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'history' && (
              <div style={{ padding: '0 4px' }}>
                {globalTimeline.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--pbf-muted)', fontSize: 13 }}>No activities yet.</div>
                )}
                {timelineDates.slice(0, 30).map(date => (
                  <div key={date}>
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--pbf-muted)', borderTop: '1px solid var(--pbf-border)', marginTop: 2 }}>
                      {date}
                    </div>
                    {globalTimeline.filter(a => a.date === date).map(a => (
                      <div key={a.id} style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}
                        onClick={() => { setSelectedId(a.companyId); setView('pipeline'); }}>
                        <StageBadge stage={a.stage} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 11 }}>{a.companyName}</span>
                          {a.contactName && <span style={{ color: 'var(--pbf-blue)', fontSize: 11 }}> / {a.contactName}</span>}
                          <div style={{ color: 'var(--pbf-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {view === 'followups' && !selected ? (
            <TimelineDiagram
              companies={companies}
              filter="pending"
              title="Follow-up Timeline"
              onSelectCompany={(id, eventId) => { setSelectedId(id); setScrollToEventId(eventId || null); setView('pipeline'); }}
            />
          ) : view === 'history' && !selected ? (
            <TimelineDiagram
              companies={companies}
              filter="history"
              title="History"
              onSelectCompany={(id, eventId) => { setSelectedId(id); setScrollToEventId(eventId || null); setView('pipeline'); }}
            />
          ) : selected ? (
            <CompanyDetail
              company={selected}
              onChange={updateCompany}
              onDelete={deleteCompany}
              allCompanies={companies}
              templates={templates}
              ambassador={{ name: user.user_metadata?.full_name || user.email || '' }}
              scrollToEventId={scrollToEventId}
            />
          ) : (
            <div className="empty-state">
              <h3>Prospect Tracker</h3>
              <p style={{ maxWidth: 360 }}>
                Select a company from the sidebar or add a new one to start building your prospecting pipeline.
              </p>
              <button className="btn-primary" onClick={addCompany} style={{ marginTop: 16 }}>+ Add {companies.length > 0 ? 'Another' : 'First'} Company</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
