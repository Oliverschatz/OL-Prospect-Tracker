'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { STAGES, SECTORS } from '@/lib/constants';
import { generateId, today, calcFitScore, fitColor, EMPTY_COMPANY } from '@/lib/helpers';
import { loadAllCompanies, loadTemplates, createCompany, updateCompanyFields, deleteCompanyFromDb, saveAllTemplates, bulkImportCompanies } from '@/lib/db';
import { StageBadge, PipelineBar } from '@/components/ui';
import { JsonImportModal, TemplateManagerModal } from '@/components/Modals';
import CompanyDetail from '@/components/CompanyDetail';
import type { Company, Template, StageKey } from '@/lib/types';

// ─── JSON Import logic ───
function parseJsonImport(
  jsonString: string,
  existing: Company[]
): { success: boolean; count?: number; error?: string; result?: Company[] } {
  try {
    let data = JSON.parse(jsonString);
    if (!Array.isArray(data)) data = [data];

    const imported: Company[] = data.map((c: Record<string, unknown>) => {
      const stageKey = (c.stage as string) || 'researching';
      const validStage = STAGES.find(s => s.key === stageKey) ? stageKey : 'researching';
      const contacts = ((c.contacts as Array<Record<string, unknown>>) || []).map((ct) => ({
        id: (ct.id as string) || generateId(),
        name: (ct.name as string) || '',
        title: (ct.title as string) || '',
        department: (ct.department as string) || '',
        email: (ct.email as string) || '',
        phone: (ct.phone as string) || '',
        linkedin: (ct.linkedin as string) || '',
        role: (ct.role as string) || 'target',
        notes: (ct.notes as string) || '',
        activities: ((ct.activities as Array<Record<string, unknown>>) || []).map((a) => ({
          id: (a.id as string) || generateId(),
          date: (a.date as string) || today(),
          text: (a.text as string) || '',
        })),
      }));
      const activities = ((c.activities as Array<Record<string, unknown>>) || []).map((a) => ({
        id: (a.id as string) || generateId(),
        date: (a.date as string) || today(),
        text: (a.text as string) || '',
      }));

      return {
        ...EMPTY_COMPANY,
        id: (c.id as string) || generateId(),
        name: (c.name as string) || 'Unnamed',
        hq: (c.hq as string) || '',
        country: (c.country as string) || 'Germany',
        employees: (c.employees as string) || '',
        sector: (c.sector as string) || SECTORS[3],
        website: (c.website as string) || '',
        stage: validStage as StageKey,
        fit_scores: (c.fitScores || c.fit_scores || {}) as Record<string, number | undefined>,
        pain_points: (c.painPoints || c.pain_points || '') as string,
        entry_angle: (c.entryAngle || c.entry_angle || '') as string,
        contacts,
        activities,
        notes: (c.notes as string) || '',
        created_at: (c.created || c.created_at || today()) as string,
        updated_at: today(),
        next_action: (c.nextAction || c.next_action || '') as string,
        follow_up_date: (c.followUpDate || c.follow_up_date || '') as string,
        parent_id: (c.parentId || c.parent_id || '') as string,
      } as Company;
    });

    // Merge: update existing by name, add new ones
    const updated = [...existing];
    imported.forEach(imp => {
      const existingIdx = updated.findIndex(e => e.name.toLowerCase() === imp.name.toLowerCase());
      if (existingIdx >= 0) {
        const existingContacts = updated[existingIdx].contacts || [];
        const newContacts = imp.contacts.filter(
          nc => !existingContacts.find(ec => ec.name.toLowerCase() === nc.name.toLowerCase())
        );
        const existingActivities = updated[existingIdx].activities || [];
        const allActivities = [...existingActivities, ...imp.activities];
        updated[existingIdx] = {
          ...updated[existingIdx],
          ...imp,
          id: updated[existingIdx].id,
          contacts: [...existingContacts, ...newContacts],
          activities: allActivities,
          created_at: updated[existingIdx].created_at,
          updated_at: today(),
        };
      } else {
        updated.push(imp);
      }
    });

    return { success: true, count: imported.length, result: updated };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── XLSX Export ───
async function exportXlsx(companies: Company[]) {
  const XLSX = await import('xlsx');
  const rows = companies.map(c => {
    const score = calcFitScore(c.fit_scores);
    return {
      'Company': c.name,
      'HQ': c.hq,
      'Country': c.country,
      'Employees': c.employees,
      'Sector': c.sector,
      'Website': c.website,
      'Stage': STAGES.find(s => s.key === c.stage)?.label || c.stage,
      'PBP Fit Score (%)': score,
      'Pain Points': c.pain_points,
      'Entry Angle': c.entry_angle,
      'Contacts': c.contacts.map(ct => ct.name).join('; '),
      'Contact Titles': c.contacts.map(ct => ct.title).join('; '),
      'Contact Emails': c.contacts.map(ct => ct.email).join('; '),
      'Contact LinkedIn': c.contacts.map(ct => ct.linkedin).join('; '),
      'Last Activity': c.activities.length > 0 ? c.activities[c.activities.length - 1].text : '',
      'Notes': c.notes,
      'Created': c.created_at,
      'Updated': c.updated_at,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 28 },
    { wch: 13 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 28 }, { wch: 28 },
    { wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PBP Prospects');
  XLSX.writeFile(wb, `PBP_Prospects_${today()}.xlsx`);
}

// ─── Main Tracker ───
export default function Tracker() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState('all');
  const [search, setSearch] = useState('');
  const [jsonModal, setJsonModal] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleJsonImport = (jsonString: string) => {
    const res = parseJsonImport(jsonString, companies);
    if (res.success && res.result) {
      setCompanies(res.result);
      // Persist imported data
      const newCompanies = res.result;
      bulkImportCompanies(newCompanies);
    }
    return { success: res.success, count: res.count, error: res.error };
  };

  const handleXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];
      const imported: Company[] = rows.map(r => {
        const stageLabel = (r['Stage'] || 'Researching').toLowerCase();
        const matchedStage = STAGES.find(s => s.label.toLowerCase() === stageLabel);
        return {
          ...EMPTY_COMPANY,
          id: generateId(),
          name: r['Company'] || 'Unnamed',
          hq: r['HQ'] || '',
          country: r['Country'] || 'Germany',
          employees: r['Employees'] || '',
          sector: r['Sector'] || SECTORS[3],
          website: r['Website'] || '',
          stage: matchedStage ? matchedStage.key : 'researching',
          pain_points: r['Pain Points'] || '',
          entry_angle: r['Entry Angle'] || '',
          notes: r['Notes'] || '',
          created_at: r['Created'] || today(),
          updated_at: today(),
        } as Company;
      });
      const merged = [...companies, ...imported];
      setCompanies(merged);
      bulkImportCompanies(imported);
      setStatusMsg(`Imported ${imported.length} companies from XLSX`);
    } catch (err: unknown) {
      alert('Import failed: ' + (err as Error).message);
    }
    e.target.value = '';
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
          <button className="btn-primary btn-sm" onClick={() => setJsonModal(true)}>
            Paste from Claude
          </button>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleXlsxImport} />
          <button className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>Import XLSX</button>
          <button className="btn-secondary btn-sm" onClick={() => exportXlsx(companies)} disabled={companies.length === 0}>Export XLSX</button>
          <button className="btn-primary btn-sm" onClick={addCompany}>+ Company</button>
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

      {/* JSON Import Modal */}
      {jsonModal && (
        <JsonImportModal onImport={handleJsonImport} onClose={() => setJsonModal(false)} />
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
