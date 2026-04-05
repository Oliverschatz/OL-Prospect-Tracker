'use client';

import { useState, useEffect } from 'react';
import { STAGES } from '@/lib/constants';
import { generateId, today, calcFitScore, fitColor, EMPTY_COMPANY } from '@/lib/helpers';
import { loadAllCompanies, loadTemplates, createCompany, updateCompanyFields, deleteCompanyFromDb, saveAllTemplates, bulkImportCompanies } from '@/lib/db';
import { StageBadge, PipelineBar } from '@/components/ui';
import { TemplateManagerModal } from '@/components/Modals';
import CompanyDetail from '@/components/CompanyDetail';
import type { Company, Template } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

// ─── Local save/load ───
function saveLocally(companies: Company[]) {
  const data = JSON.stringify(companies, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
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

// ─── Main Tracker ───
export default function Tracker({ user, onLogout, isAdmin, onAdmin, onSettings }: {
  user: User; onLogout: () => void; isAdmin?: boolean; onAdmin?: () => void; onSettings?: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState('all');
  const [search, setSearch] = useState('');
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

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

  const filtered = companies.filter(c => {
    if (filterStage !== 'all' && c.stage !== filterStage) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
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
    await createCompany(newCo);
  };

  const updateCompany = (updated: Company) => {
    setCompanies(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  const deleteCompany = async () => {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
    setCompanies(prev => prev.filter(c => c.id !== selected.id));
    setSelectedId(null);
    await deleteCompanyFromDb(selected.id);
  };

  const handleSaveLocally = () => {
    saveLocally(companies);
    setStatusMsg(`Saved ${companies.length} companies to file`);
  };

  const handleOpenLocal = async () => {
    const data = await openLocalFile();
    if (!data) return;
    // Merge into existing data and persist to Supabase
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

  const handleSaveTemplates = async (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    await saveAllTemplates(newTemplates);
  };

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
        onClick={() => setSelectedId(c.id)}
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
          {c.follow_up_date && c.follow_up_date <= today() && (
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
          <button className="btn-secondary btn-sm" onClick={handleOpenLocal}>
            Open Saved
          </button>
          <button className="btn-secondary btn-sm" onClick={handleSaveLocally} disabled={companies.length === 0}>
            Save Locally
          </button>
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
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 100, padding: '3px 6px', fontSize: 12 }}>
              <option value="all">All stages</option>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <PipelineBar companies={companies} />
          <div style={{ padding: '0 12px 8px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..." style={{ fontSize: 12, padding: '5px 8px' }} />
          </div>
          <div className="company-list">
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
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {selected ? (
            <CompanyDetail
              company={selected}
              onChange={updateCompany}
              onDelete={deleteCompany}
              allCompanies={companies}
              templates={templates}
            />
          ) : (
            <div className="empty-state">
              <h3>Prospect Tracker</h3>
              <p style={{ maxWidth: 360 }}>
                Select a company from the sidebar or add a new one to start building your prospecting pipeline.
              </p>
              <button className="btn-primary" onClick={addCompany} style={{ marginTop: 16 }}>+ Add First Company</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
