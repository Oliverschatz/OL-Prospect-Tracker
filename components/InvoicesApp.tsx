'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { loadAllCompanies } from '@/lib/db';
import type { Company } from '@/lib/types';
import {
  loadSellerSettings, saveSellerSettings, loadInvoices, saveInvoice,
  deleteInvoice, suggestInvoiceNumber, bumpInvoiceSeq,
} from '@/lib/invoice-db';
import {
  type Invoice, type InvoiceItem, type SellerSettings, type VatCategory,
  EMPTY_SELLER, VAT_CATEGORIES, UNIT_CODES, vatCategoryInfo, emptyItem,
} from '@/lib/invoice-types';
import { computeTotals, formatMoney, lineNet } from '@/lib/invoice-calc';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import {
  parseSpreadsheet, autoMap, buildInvoices, EMPTY_MAPPING,
  type ImportMapping, type ParsedSheet,
} from '@/lib/invoice-import';
import { generateId } from '@/lib/helpers';
import { signOut } from '@/lib/auth';

type View = 'list' | 'edit' | 'settings' | 'import';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 3,
};

function today(): string { return new Date().toISOString().slice(0, 10); }
function addDays(iso: string, days: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
function isoCountry(country: string): string {
  return /german|deutsch/i.test(country) ? 'DE' : (country || 'DE');
}

function emptyInvoice(seller: SellerSettings): Invoice {
  const issue = today();
  return {
    id: generateId(),
    invoice_number: suggestInvoiceNumber(seller),
    status: 'draft',
    issue_date: issue,
    delivery_date: issue,
    due_date: addDays(issue, seller.payment_terms_days || 14),
    currency: 'EUR',
    company_id: null,
    contact_id: null,
    buyer_name: '', buyer_contact: '', buyer_address: '', buyer_postal: '',
    buyer_city: '', buyer_country: 'DE', buyer_vat_id: '', buyer_email: '',
    buyer_reference: '', intro_text: '', notes: '',
    payment_terms: '',
    items: [{ ...emptyItem(0, seller.kleinunternehmer ? 0 : seller.default_vat_rate), id: generateId(),
      vat_category: seller.kleinunternehmer ? 'E' : 'S' }],
  };
}

export default function InvoicesApp({ user }: { user: User }) {
  const router = useRouter();
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerSettings>(EMPTY_SELLER);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const [s, inv, comp] = await Promise.all([loadSellerSettings(), loadInvoices(), loadAllCompanies()]);
      setSeller(s); setInvoices(inv); setCompanies(comp); setLoading(false);
    })();
  }, []);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleLogout() { await signOut(); router.refresh(); }

  function newInvoice() {
    if (!seller.company_name) {
      flash('Please fill in your company details under Settings first.');
      setView('settings');
      return;
    }
    setEditing(emptyInvoice(seller));
    setView('edit');
  }

  async function persistInvoice(inv: Invoice) {
    const isNew = !invoices.some(i => i.id === inv.id);
    await saveInvoice(inv);
    if (isNew && inv.invoice_number === suggestInvoiceNumber(seller)) {
      await bumpInvoiceSeq();
      setSeller(await loadSellerSettings());
    }
    setInvoices(await loadInvoices());
    flash('Invoice saved.');
  }

  async function removeInvoice(id: string) {
    if (!confirm('Delete this invoice?')) return;
    await deleteInvoice(id);
    setInvoices(await loadInvoices());
    flash('Invoice deleted.');
  }

  async function downloadPdf(inv: Invoice) {
    try {
      const bytes = await generateInvoicePdf(inv, seller);
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung_${inv.invoice_number || inv.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash(`PDF error: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pbf-light)' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img className="app-logo" src="https://oliverlehmann.com/wp-content/uploads/2023/05/cropped-logo-ol.png" alt="OL" />
          <h1>Invoices <span>· OliverLehmann.com</span></h1>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setView('list')}>Invoices</button>
          <button className="btn-secondary" onClick={() => setView('settings')}>Settings</button>
          <button className="btn-secondary" onClick={() => setView('import')}>Import</button>
          <button className="btn-secondary" onClick={() => router.push('/')}>← Tracker</button>
          <button className="btn-secondary" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      {toast && (
        <div style={{ position: 'fixed', top: 64, right: 24, background: 'var(--pbf-navy)', color: 'white',
          padding: '10px 16px', borderRadius: 'var(--radius)', zIndex: 200, fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
          {toast}
        </div>
      )}

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        {loading ? <p style={{ color: 'var(--pbf-muted)' }}>Loading…</p> : (
          <>
            {view === 'list' && (
              <InvoiceList
                invoices={invoices} seller={seller}
                onNew={newInvoice}
                onEdit={(inv) => { setEditing(structuredClone(inv)); setView('edit'); }}
                onDelete={removeInvoice}
                onPdf={downloadPdf}
              />
            )}
            {view === 'edit' && editing && (
              <InvoiceEditor
                invoice={editing} seller={seller} companies={companies}
                onCancel={() => setView('list')}
                onSave={async (inv) => { await persistInvoice(inv); setView('list'); }}
                onPdf={downloadPdf}
              />
            )}
            {view === 'settings' && (
              <SellerSettingsForm
                value={seller}
                onSave={async (s) => { await saveSellerSettings(s); setSeller(await loadSellerSettings()); flash('Settings saved.'); }}
              />
            )}
            {view === 'import' && (
              <ImportView
                onImported={async (imported) => {
                  for (const inv of imported) await saveInvoice(inv);
                  setInvoices(await loadInvoices());
                  flash(`Imported ${imported.length} invoice(s).`);
                  setView('list');
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── List ───
function InvoiceList({ invoices, seller, onNew, onEdit, onDelete, onPdf }: {
  invoices: Invoice[]; seller: SellerSettings;
  onNew: () => void; onEdit: (i: Invoice) => void; onDelete: (id: string) => void; onPdf: (i: Invoice) => void;
}) {
  const statusColors: Record<string, string> = {
    draft: 'var(--pbf-muted)', sent: 'var(--pbf-blue)', paid: 'var(--pbf-green)', cancelled: 'var(--pbf-red)',
  };
  void seller;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>Invoices</h2>
        <button className="btn-primary" onClick={onNew}>+ New Invoice</button>
      </div>
      {invoices.length === 0 ? (
        <div style={{ background: 'white', padding: 40, borderRadius: 8, textAlign: 'center', color: 'var(--pbf-muted)', boxShadow: 'var(--shadow)' }}>
          No invoices yet. Click “New Invoice” to create your first one.
        </div>
      ) : (
        <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--pbf-navy)', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontSize: 12 }}>Number</th>
              <th style={{ padding: '10px 12px', fontSize: 12 }}>Customer</th>
              <th style={{ padding: '10px 12px', fontSize: 12 }}>Date</th>
              <th style={{ padding: '10px 12px', fontSize: 12 }}>Status</th>
              <th style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => {
              const total = computeTotals(inv.items).gross;
              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--pbf-border)' }}>
                  <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>{inv.invoice_number || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 13 }}>{inv.buyer_name || '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 13 }}>{inv.issue_date}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>
                    <span style={{ color: statusColors[inv.status], fontWeight: 600, textTransform: 'capitalize' }}>{inv.status}</span>
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'right' }}>{formatMoney(total, inv.currency)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-ghost" onClick={() => onEdit(inv)}>Edit</button>
                    <button className="btn-ghost" onClick={() => onPdf(inv)}>PDF</button>
                    <button className="btn-danger" onClick={() => onDelete(inv.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Editor ───
function InvoiceEditor({ invoice, seller, companies, onCancel, onSave, onPdf }: {
  invoice: Invoice; seller: SellerSettings; companies: Company[];
  onCancel: () => void; onSave: (i: Invoice) => void; onPdf: (i: Invoice) => void;
}) {
  const [inv, setInv] = useState<Invoice>(invoice);
  const totals = useMemo(() => computeTotals(inv.items), [inv.items]);
  const set = (patch: Partial<Invoice>) => setInv(p => ({ ...p, ...patch }));

  function pickCompany(companyId: string) {
    const c = companies.find(x => x.id === companyId);
    if (!c) { set({ company_id: null }); return; }
    const contact = c.contacts[0];
    set({
      company_id: c.id,
      contact_id: contact?.id ?? null,
      buyer_name: c.name,
      buyer_contact: contact?.name || '',
      buyer_email: contact?.email || '',
      buyer_city: c.hq || '',
      buyer_country: isoCountry(c.country),
    });
  }

  function setItem(idx: number, patch: Partial<InvoiceItem>) {
    setInv(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  }
  function addItem() {
    setInv(p => ({ ...p, items: [...p.items, { ...emptyItem(p.items.length, seller.kleinunternehmer ? 0 : seller.default_vat_rate), id: generateId(), vat_category: seller.kleinunternehmer ? 'E' : 'S' }] }));
  }
  function removeItem(idx: number) {
    setInv(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  const card: React.CSSProperties = { background: 'white', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', marginBottom: 16 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>
          {invoice.invoice_number || 'New invoice'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-secondary" style={{ color: 'var(--pbf-navy)', background: 'var(--pbf-light)', border: '1px solid var(--pbf-border)' }} onClick={() => onPdf(inv)}>Generate PDF</button>
          <button className="btn-primary" onClick={() => onSave(inv)}>Save</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={labelStyle}>Invoice number</label><input style={inputStyle} value={inv.invoice_number} onChange={e => set({ invoice_number: e.target.value })} /></div>
          <div><label style={labelStyle}>Status</label>
            <select style={inputStyle} value={inv.status} onChange={e => set({ status: e.target.value as Invoice['status'] })}>
              <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div><label style={labelStyle}>Currency</label><input style={inputStyle} value={inv.currency} onChange={e => set({ currency: e.target.value })} /></div>
          <div><label style={labelStyle}>Issue date</label><input type="date" style={inputStyle} value={inv.issue_date} onChange={e => set({ issue_date: e.target.value })} /></div>
          <div><label style={labelStyle}>Delivery date</label><input type="date" style={inputStyle} value={inv.delivery_date || ''} onChange={e => set({ delivery_date: e.target.value || null })} /></div>
          <div><label style={labelStyle}>Due date</label><input type="date" style={inputStyle} value={inv.due_date || ''} onChange={e => set({ due_date: e.target.value || null })} /></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Bill to</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Link to CRM company (optional)</label>
          <select style={inputStyle} value={inv.company_id || ''} onChange={e => pickCompany(e.target.value)}>
            <option value="">— Ad-hoc customer —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Customer name</label><input style={inputStyle} value={inv.buyer_name} onChange={e => set({ buyer_name: e.target.value })} /></div>
          <div><label style={labelStyle}>Contact person</label><input style={inputStyle} value={inv.buyer_contact} onChange={e => set({ buyer_contact: e.target.value })} /></div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={inv.buyer_address} onChange={e => set({ buyer_address: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div><label style={labelStyle}>Postal</label><input style={inputStyle} value={inv.buyer_postal} onChange={e => set({ buyer_postal: e.target.value })} /></div>
            <div><label style={labelStyle}>City</label><input style={inputStyle} value={inv.buyer_city} onChange={e => set({ buyer_city: e.target.value })} /></div>
          </div>
          <div><label style={labelStyle}>Country (ISO)</label><input style={inputStyle} value={inv.buyer_country} onChange={e => set({ buyer_country: e.target.value })} /></div>
          <div><label style={labelStyle}>VAT ID (USt-IdNr.)</label><input style={inputStyle} value={inv.buyer_vat_id} onChange={e => set({ buyer_vat_id: e.target.value })} /></div>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} value={inv.buyer_email} onChange={e => set({ buyer_email: e.target.value })} /></div>
          <div><label style={labelStyle}>Reference / Leitweg-ID (B2G)</label><input style={inputStyle} value={inv.buyer_reference} onChange={e => set({ buyer_reference: e.target.value })} /></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Line items</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--pbf-muted)', textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>Description</th>
              <th style={{ padding: '4px 6px', width: 60 }}>Qty</th>
              <th style={{ padding: '4px 6px', width: 90 }}>Unit</th>
              <th style={{ padding: '4px 6px', width: 90 }}>Unit price</th>
              <th style={{ padding: '4px 6px', width: 150 }}>VAT</th>
              <th style={{ padding: '4px 6px', width: 90, textAlign: 'right' }}>Net</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td style={{ padding: '3px 6px' }}><input style={inputStyle} value={it.description} onChange={e => setItem(idx, { description: e.target.value })} /></td>
                <td style={{ padding: '3px 6px' }}><input type="number" step="any" style={inputStyle} value={it.quantity} onChange={e => setItem(idx, { quantity: parseFloat(e.target.value) || 0 })} /></td>
                <td style={{ padding: '3px 6px' }}>
                  <select style={inputStyle} value={it.unit} onChange={e => setItem(idx, { unit: e.target.value })}>
                    {UNIT_CODES.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: '3px 6px' }}><input type="number" step="any" style={inputStyle} value={it.unit_price} onChange={e => setItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} /></td>
                <td style={{ padding: '3px 6px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select style={{ ...inputStyle, flex: 2 }} value={it.vat_category} onChange={e => {
                      const cat = e.target.value as VatCategory;
                      setItem(idx, { vat_category: cat, vat_rate: vatCategoryInfo(cat).zeroRated ? 0 : (seller.default_vat_rate || 19) });
                    }}>
                      {VAT_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                    <input type="number" step="any" disabled={vatCategoryInfo(it.vat_category).zeroRated} style={{ ...inputStyle, width: 50 }} value={it.vat_rate} onChange={e => setItem(idx, { vat_rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{formatMoney(lineNet(it), inv.currency)}</td>
                <td style={{ textAlign: 'center' }}><button className="btn-danger" onClick={() => removeItem(idx)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={addItem}>+ Add line</button>

        <div style={{ marginTop: 16, marginLeft: 'auto', width: 280 }}>
          <Row label="Net" value={formatMoney(totals.net, inv.currency)} />
          {totals.vatGroups.map((g, i) => (
            <Row key={i} label={g.rate > 0 ? `VAT ${g.rate}%` : `${vatCategoryInfo(g.category).label}`} value={formatMoney(g.tax, inv.currency)} />
          ))}
          <Row label="Total" value={formatMoney(totals.gross, inv.currency)} bold />
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Intro text</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={inv.intro_text} onChange={e => set({ intro_text: e.target.value })} /></div>
          <div><label style={labelStyle}>Payment terms / footer note</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={inv.payment_terms} onChange={e => set({ payment_terms: e.target.value })} /></div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      borderTop: bold ? '1px solid var(--pbf-navy)' : 'none', fontWeight: bold ? 700 : 400,
      color: bold ? 'var(--pbf-navy)' : 'var(--pbf-text)', fontSize: bold ? 15 : 13 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// ─── Seller settings ───
function SellerSettingsForm({ value, onSave }: { value: SellerSettings; onSave: (s: SellerSettings) => void }) {
  const [s, setS] = useState<SellerSettings>(value);
  useEffect(() => setS(value), [value]);
  const set = (patch: Partial<SellerSettings>) => setS(p => ({ ...p, ...patch }));
  const card: React.CSSProperties = { background: 'white', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', marginBottom: 16 };
  const field = (label: string, key: keyof SellerSettings, type = 'text') => (
    <div><label style={labelStyle}>{label}</label>
      <input type={type} style={inputStyle} value={String(s[key] ?? '')} onChange={e => set({ [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value } as Partial<SellerSettings>)} />
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>Your invoice details</h2>
        <button className="btn-primary" onClick={() => onSave(s)}>Save settings</button>
      </div>
      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Company</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('Company name', 'company_name')}
          {field('Contact name', 'contact_name')}
          {field('Address', 'address_line')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8 }}>
            {field('Postal', 'postal_code')}{field('City', 'city')}{field('Country', 'country')}
          </div>
          {field('Email', 'email')}{field('Phone', 'phone')}{field('Website', 'website')}
        </div>
      </div>
      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Tax & bank</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('VAT ID (USt-IdNr.)', 'vat_id')}{field('Tax number (Steuernummer)', 'tax_number')}
          {field('IBAN', 'iban')}{field('BIC', 'bic')}{field('Bank name', 'bank_name')}
          {field('Default VAT rate (%)', 'default_vat_rate', 'number')}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={s.kleinunternehmer} onChange={e => set({ kleinunternehmer: e.target.checked })} />
              Kleinunternehmer (§19 UStG) — no VAT
            </label>
          </div>
        </div>
      </div>
      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Invoice defaults</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {field('Number prefix', 'invoice_prefix')}
          {field('Next sequence #', 'next_invoice_seq', 'number')}
          {field('Payment terms (days)', 'payment_terms_days', 'number')}
          {field('Logo URL', 'logo_url')}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Footer notes (HRB, Geschäftsführer, …)</label>
            <textarea style={{ ...inputStyle, minHeight: 50 }} value={s.footer_notes} onChange={e => set({ footer_notes: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Import ───
function ImportView({ onImported }: { onImported: (invoices: Invoice[]) => void }) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [map, setMap] = useState<ImportMapping>(EMPTY_MAPPING);
  const [error, setError] = useState('');

  async function onFile(file: File) {
    setError('');
    try {
      const parsed = await parseSpreadsheet(file);
      setSheet(parsed);
      setMap(autoMap(parsed.headers));
    } catch (e) { setError((e as Error).message); }
  }

  const preview = sheet ? buildInvoices(sheet.rows, map) : [];
  const fields: { key: keyof ImportMapping; label: string }[] = [
    { key: 'invoice_number', label: 'Invoice number' }, { key: 'issue_date', label: 'Issue date' },
    { key: 'due_date', label: 'Due date' }, { key: 'buyer_name', label: 'Customer name' },
    { key: 'buyer_address', label: 'Address' }, { key: 'buyer_postal', label: 'Postal' },
    { key: 'buyer_city', label: 'City' }, { key: 'buyer_vat_id', label: 'VAT ID' },
    { key: 'buyer_email', label: 'Email' }, { key: 'description', label: 'Item description' },
    { key: 'quantity', label: 'Quantity' }, { key: 'unit_price', label: 'Unit price' },
    { key: 'vat_rate', label: 'VAT rate %' },
  ];
  const card: React.CSSProperties = { background: 'white', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', marginBottom: 16 };

  return (
    <div>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22, marginBottom: 16 }}>Import from MS Access</h2>
      <div style={card}>
        <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 12 }}>
          Export your Access tables to Excel (.xlsx) or CSV, then upload here. One row per line item; rows sharing an invoice number are grouped into one invoice.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {error && <p style={{ color: 'var(--pbf-red)', marginTop: 8 }}>{error}</p>}
      </div>

      {sheet && (
        <>
          <div style={card}>
            <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Map columns ({sheet.rows.length} rows)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <select style={inputStyle} value={map[f.key]} onChange={e => setMap(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">— none —</option>
                    {sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--pbf-muted)' }}>
                {preview.length} invoice(s) will be created.
              </span>
              <button className="btn-primary" disabled={preview.length === 0} onClick={() => onImported(preview)}>
                Import {preview.length} invoice(s)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
