'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { generateId } from '@/lib/helpers';
import {
  loadSellerSettings, saveSellerSettings, loadInvoices, saveInvoice, deleteInvoice,
  suggestInvoiceNumber, bumpInvoiceSeq, loadCustomers, saveCustomer, deleteCustomer,
  bulkImportCustomers,
} from '@/lib/invoice-db';
import {
  type Invoice, type SellerSettings, type Customer, type Lang, type InvoiceItem,
  SELLER_DEFAULTS, EMPTY_CUSTOMER, UNIT_CODES, emptyItem,
} from '@/lib/invoice-types';
import { computeTotals, formatMoney } from '@/lib/invoice-calc';
import {
  parseSpreadsheet, autoMapCustomers, buildCustomers, CUSTOMER_FIELDS, type CustomerMapping,
  autoMapInvoices, buildInvoices, INVOICE_FIELDS, type InvoiceMapping, type ParsedSheet,
} from '@/lib/invoice-import';

type View = 'list' | 'edit' | 'customers' | 'settings' | 'import';

const input: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 3 };
const card: React.CSSProperties = { background: 'white', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow)', marginBottom: 16 };

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function emptyInvoice(seller: SellerSettings): Invoice {
  const issue = today();
  return {
    id: generateId(), invoice_number: suggestInvoiceNumber(seller), status: 'draft', language: 'de',
    issue_date: issue, due_date: addDays(issue, seller.payment_terms_days || 14), currency: 'EUR',
    customer_id: null, company_id: null, contact_id: null,
    buyer_name: '', buyer_name2: '', buyer_street: '', buyer_postal: '', buyer_city: '',
    buyer_country: 'Deutschland', buyer_contact: '', buyer_vat_id: '', buyer_email: '', buyer_reference: '',
    topic: '', service_type: '', venue: '', billing_start: issue, billing_end: issue,
    billing_unit: 'Tage', units: 1, rate: 0,
    preparation: 0, travel: 0, other_costs: 0, handouts_qty: 0, handouts_unit_price: 0, handouts_flat: 0,
    vat_rate: seller.default_vat_rate || 19, vat_exempt: false, vat_exempt_reason: '', payment_term: 'Netto, sofort nach Erhalt',
    intro_text: '', closing_text: '', cost_note: '', paid_date: null, reminded: false, items: [],
  };
}

async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

export default function InvoicesApp({ user }: { user: User }) {
  void user;
  const router = useRouter();
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<SellerSettings>(SELLER_DEFAULTS);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [emailFor, setEmailFor] = useState<Invoice | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const [s, inv, cust] = await Promise.all([loadSellerSettings(), loadInvoices(), loadCustomers()]);
      setSeller(s); setInvoices(inv); setCustomers(cust); setLoading(false);
    })();
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  function newInvoice() {
    if (!seller.company_name) { flash('Fill in your details under Settings first.'); setView('settings'); return; }
    setEditing(emptyInvoice(seller)); setView('edit');
  }

  async function persist(inv: Invoice) {
    const isNew = !invoices.some(i => i.id === inv.id);
    await saveInvoice(inv);
    if (isNew) await bumpInvoiceSeq(inv.invoice_number);
    const [s, list] = await Promise.all([loadSellerSettings(), loadInvoices()]);
    setSeller(s); setInvoices(list); flash('Invoice saved.');
  }

  async function downloadPdf(inv: Invoice) {
    try {
      const res = await fetch('/api/invoices/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authToken()}` },
        body: JSON.stringify({ invoice: inv, seller }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'PDF failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Rechnung_${inv.invoice_number || inv.id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { flash(`PDF error: ${(e as Error).message}`); }
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
          <button className="btn-secondary" onClick={() => setView('customers')}>Customers</button>
          <button className="btn-secondary" onClick={() => setView('settings')}>Settings</button>
          <button className="btn-secondary" onClick={() => setView('import')}>Import</button>
          <button className="btn-secondary" onClick={() => router.push('/')}>← Tracker</button>
          <button className="btn-secondary" onClick={async () => { await signOut(); router.refresh(); }}>Log out</button>
        </div>
      </header>

      {toast && <div style={{ position: 'fixed', top: 64, right: 24, background: 'var(--pbf-navy)', color: 'white', padding: '10px 16px', borderRadius: 'var(--radius)', zIndex: 300, fontSize: 13, boxShadow: 'var(--shadow-md)' }}>{toast}</div>}

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24 }}>
        {loading ? <p style={{ color: 'var(--pbf-muted)' }}>Loading…</p> : <>
          {view === 'list' && <InvoiceList invoices={invoices} onNew={newInvoice}
            onEdit={(i) => { setEditing(structuredClone(i)); setView('edit'); }}
            onDelete={async (id) => { if (confirm('Delete this invoice?')) { await deleteInvoice(id); setInvoices(await loadInvoices()); flash('Deleted.'); } }}
            onPdf={downloadPdf} onEmail={(i) => setEmailFor(i)} />}

          {view === 'edit' && editing && <InvoiceEditor invoice={editing} seller={seller} customers={customers}
            onCancel={() => setView('list')} onSave={async (i) => { await persist(i); setView('list'); }}
            onPdf={downloadPdf} onEmail={(i) => setEmailFor(i)} />}

          {view === 'customers' && <CustomersView customers={customers}
            onChange={async () => setCustomers(await loadCustomers())} flash={flash} />}

          {view === 'settings' && <SettingsForm value={seller}
            onSave={async (s) => { await saveSellerSettings(s); setSeller(await loadSellerSettings()); flash('Settings saved.'); }} />}

          {view === 'import' && <ImportView customers={customers}
            onCustomers={async (list) => { const n = await bulkImportCustomers(list); setCustomers(await loadCustomers()); flash(`Imported ${n} customers.`); }}
            onInvoices={async (list) => { for (const inv of list) await saveInvoice(inv); setInvoices(await loadInvoices()); flash(`Imported ${list.length} invoices.`); setView('list'); }} />}
        </>}
      </main>

      {emailFor && <EmailModal invoice={emailFor} seller={seller} onClose={() => setEmailFor(null)}
        onSent={() => { setEmailFor(null); flash('Invoice e-mailed.'); }} />}
    </div>
  );
}

// ─── List ───
function InvoiceList({ invoices, onNew, onEdit, onDelete, onPdf, onEmail }: {
  invoices: Invoice[]; onNew: () => void; onEdit: (i: Invoice) => void; onDelete: (id: string) => void; onPdf: (i: Invoice) => void; onEmail: (i: Invoice) => void;
}) {
  const colors: Record<string, string> = { draft: 'var(--pbf-muted)', sent: 'var(--pbf-blue)', paid: 'var(--pbf-green)', cancelled: 'var(--pbf-red)' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>Invoices</h2>
        <button className="btn-primary" onClick={onNew}>+ New Invoice</button>
      </div>
      {invoices.length === 0 ? <div style={{ ...card, textAlign: 'center', color: 'var(--pbf-muted)' }}>No invoices yet.</div> : (
        <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <thead><tr style={{ background: 'var(--pbf-navy)', color: 'white', textAlign: 'left' }}>
            {['No.', 'Customer', 'Topic', 'Date', 'Lang', 'Status', 'Total', ''].map((h, i) =>
              <th key={i} style={{ padding: '10px 12px', fontSize: 12, textAlign: i >= 6 ? 'right' : 'left' }}>{h}</th>)}
          </tr></thead>
          <tbody>{invoices.map(inv => {
            const total = computeTotals(inv).gross;
            return <tr key={inv.id} style={{ borderBottom: '1px solid var(--pbf-border)' }}>
              <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600 }}>{inv.invoice_number || '—'}</td>
              <td style={{ padding: '9px 12px', fontSize: 13 }}>{inv.buyer_name || '—'}</td>
              <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--pbf-muted)' }}>{inv.topic || '—'}</td>
              <td style={{ padding: '9px 12px', fontSize: 13 }}>{inv.issue_date}</td>
              <td style={{ padding: '9px 12px', fontSize: 12, textTransform: 'uppercase' }}>{inv.language}</td>
              <td style={{ padding: '9px 12px', fontSize: 12 }}><span style={{ color: colors[inv.status], fontWeight: 600, textTransform: 'capitalize' }}>{inv.status}</span></td>
              <td style={{ padding: '9px 12px', fontSize: 13, textAlign: 'right' }}>{formatMoney(total, inv.currency)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn-ghost" onClick={() => onEdit(inv)}>Edit</button>
                <button className="btn-ghost" onClick={() => onPdf(inv)}>PDF</button>
                <button className="btn-ghost" onClick={() => onEmail(inv)}>Email</button>
                <button className="btn-danger" onClick={() => onDelete(inv.id)}>Del</button>
              </td>
            </tr>;
          })}</tbody>
        </table>
      )}
    </div>
  );
}

// ─── Editor ───
function InvoiceEditor({ invoice, seller, customers, onCancel, onSave, onPdf, onEmail }: {
  invoice: Invoice; seller: SellerSettings; customers: Customer[];
  onCancel: () => void; onSave: (i: Invoice) => void; onPdf: (i: Invoice) => void; onEmail: (i: Invoice) => void;
}) {
  const [inv, setInv] = useState<Invoice>(invoice);
  const t = useMemo(() => computeTotals(inv), [inv]);
  const set = (p: Partial<Invoice>) => setInv(s => ({ ...s, ...p }));
  const numSet = (k: keyof Invoice) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: parseFloat(e.target.value) || 0 } as Partial<Invoice>);

  function pickCustomer(id: string) {
    const c = customers.find(x => x.id === id);
    if (!c) { set({ customer_id: null }); return; }
    set({
      customer_id: c.id, buyer_name: c.name, buyer_name2: c.name2, buyer_street: c.street,
      buyer_postal: c.postal, buyer_city: c.city, buyer_country: c.country,
      buyer_contact: [c.first_name, c.contact].filter(Boolean).join(' '), buyer_vat_id: c.vat_id, buyer_email: c.email,
      rate: c.standard_rate || inv.rate, vat_rate: c.standard_vat ?? inv.vat_rate,
      payment_term: c.payment_term || inv.payment_term,
    });
  }
  const setItem = (i: number, p: Partial<InvoiceItem>) => setInv(s => ({ ...s, items: s.items.map((it, j) => j === i ? { ...it, ...p } : it) }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>{invoice.invoice_number || 'New invoice'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-ghost" onClick={() => onPdf(inv)}>PDF</button>
          <button className="btn-ghost" onClick={() => onEmail(inv)}>Email…</button>
          <button className="btn-primary" onClick={() => onSave(inv)}>Save</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div><label style={lbl}>Invoice no.</label><input style={input} value={inv.invoice_number} onChange={e => set({ invoice_number: e.target.value })} /></div>
          <div><label style={lbl}>Language</label><select style={input} value={inv.language} onChange={e => set({ language: e.target.value as Lang })}><option value="de">Deutsch</option><option value="en">English</option></select></div>
          <div><label style={lbl}>Status</label><select style={input} value={inv.status} onChange={e => set({ status: e.target.value as Invoice['status'] })}><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></div>
          <div><label style={lbl}>Issue date</label><input type="date" style={input} value={inv.issue_date} onChange={e => set({ issue_date: e.target.value })} /></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Customer</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Pick from customer list</label>
          <select style={input} value={inv.customer_id || ''} onChange={e => pickCustomer(e.target.value)}>
            <option value="">— Ad-hoc customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.kd_nr ? `${c.kd_nr} · ` : ''}{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Name</label><input style={input} value={inv.buyer_name} onChange={e => set({ buyer_name: e.target.value })} /></div>
          <div><label style={lbl}>Name 2</label><input style={input} value={inv.buyer_name2} onChange={e => set({ buyer_name2: e.target.value })} /></div>
          <div><label style={lbl}>Street</label><input style={input} value={inv.buyer_street} onChange={e => set({ buyer_street: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div><label style={lbl}>PLZ</label><input style={input} value={inv.buyer_postal} onChange={e => set({ buyer_postal: e.target.value })} /></div>
            <div><label style={lbl}>City</label><input style={input} value={inv.buyer_city} onChange={e => set({ buyer_city: e.target.value })} /></div>
          </div>
          <div><label style={lbl}>Country</label><input style={input} value={inv.buyer_country} onChange={e => set({ buyer_country: e.target.value })} /></div>
          <div><label style={lbl}>VAT ID (USt-IdNr.)</label><input style={input} value={inv.buyer_vat_id} onChange={e => set({ buyer_vat_id: e.target.value })} /></div>
          <div><label style={lbl}>Email</label><input style={input} value={inv.buyer_email} onChange={e => set({ buyer_email: e.target.value })} /></div>
          <div><label style={lbl}>Reference / Leitweg-ID</label><input style={input} value={inv.buyer_reference} onChange={e => set({ buyer_reference: e.target.value })} /></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Engagement (Honorar)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={lbl}>Topic / Thema</label><input style={input} value={inv.topic} onChange={e => set({ topic: e.target.value })} /></div>
          <div><label style={lbl}>Type / Auftragsart</label><input style={input} value={inv.service_type} onChange={e => set({ service_type: e.target.value })} /></div>
          <div><label style={lbl}>Venue / Einsatzort</label><input style={input} value={inv.venue} onChange={e => set({ venue: e.target.value })} /></div>
          <div><label style={lbl}>Start / Abr-Beginn</label><input type="date" style={input} value={inv.billing_start || ''} onChange={e => set({ billing_start: e.target.value || null })} /></div>
          <div><label style={lbl}>End / Abr-Ende</label><input type="date" style={input} value={inv.billing_end || ''} onChange={e => set({ billing_end: e.target.value || null })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Unit</label><select style={input} value={inv.billing_unit} onChange={e => set({ billing_unit: e.target.value })}>{UNIT_CODES.map(u => <option key={u.code} value={inv.language === 'en' ? u.label_en : u.label_de}>{inv.language === 'en' ? u.label_en : u.label_de}</option>)}</select></div>
            <div><label style={lbl}>Units</label><input type="number" step="any" style={input} value={inv.units} onChange={numSet('units')} /></div>
          </div>
          <div><label style={lbl}>Rate / Abr-Satz</label><input type="number" step="any" style={input} value={inv.rate} onChange={numSet('rate')} /></div>
          <div style={{ alignSelf: 'end' }}><label style={lbl}>Honorar</label><div style={{ ...input, background: 'var(--pbf-light)', fontWeight: 700 }}>{formatMoney(t.honorar, inv.currency)}</div></div>
          <div><label style={lbl}>Currency</label><input style={input} value={inv.currency} onChange={e => set({ currency: e.target.value })} /></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Additional costs (Nebenkosten)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div><label style={lbl}>Preparation / Vorbereitung</label><input type="number" step="any" style={input} value={inv.preparation} onChange={numSet('preparation')} /></div>
          <div><label style={lbl}>Travel / Reisekosten</label><input type="number" step="any" style={input} value={inv.travel} onChange={numSet('travel')} /></div>
          <div><label style={lbl}>Other / sonstige</label><input type="number" step="any" style={input} value={inv.other_costs} onChange={numSet('other_costs')} /></div>
          <div><label style={lbl}>Handouts qty / Stückzahl</label><input type="number" step="any" style={input} value={inv.handouts_qty} onChange={numSet('handouts_qty')} /></div>
          <div><label style={lbl}>Handouts unit price</label><input type="number" step="any" style={input} value={inv.handouts_unit_price} onChange={numSet('handouts_unit_price')} /></div>
          <div><label style={lbl}>Handouts flat / pauschal</label><input type="number" step="any" style={input} value={inv.handouts_flat} onChange={numSet('handouts_flat')} /></div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Extra lines (optional)</label>
          {inv.items.map((it, i) => (
            <div key={it.id || i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 30px', gap: 8, marginBottom: 6 }}>
              <input style={input} placeholder="Description" value={it.description} onChange={e => setItem(i, { description: e.target.value })} />
              <input type="number" step="any" style={input} placeholder="Qty" value={it.quantity} onChange={e => setItem(i, { quantity: parseFloat(e.target.value) || 0 })} />
              <input type="number" step="any" style={input} placeholder="Unit price" value={it.unit_price} onChange={e => setItem(i, { unit_price: parseFloat(e.target.value) || 0 })} />
              <button className="btn-danger" onClick={() => setInv(s => ({ ...s, items: s.items.filter((_, j) => j !== i) }))}>×</button>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => setInv(s => ({ ...s, items: [...s.items, { ...emptyItem(s.items.length), id: generateId() }] }))}>+ Add line</button>
        </div>

        <div style={{ marginTop: 14, marginLeft: 'auto', width: 300 }}>
          <Row label="Nebenkosten gesamt" value={formatMoney(t.nebenkosten, inv.currency)} />
          <Row label="Net total" value={formatMoney(t.net, inv.currency)} />
          <Row label={`VAT ${t.vatRate}%`} value={formatMoney(t.vat, inv.currency)} />
          <Row label="Amount due" value={formatMoney(t.gross, inv.currency)} bold />
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          <div><label style={lbl}>VAT rate % / MWSt</label><input type="number" step="any" disabled={inv.vat_exempt} style={input} value={inv.vat_rate} onChange={numSet('vat_rate')} /></div>
          <div style={{ alignSelf: 'end' }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={inv.vat_exempt} onChange={e => set({ vat_exempt: e.target.checked })} /> VAT exempt / MWST befreit</label></div>
          <div><label style={lbl}>Exemption reason</label><input style={input} disabled={!inv.vat_exempt} value={inv.vat_exempt_reason} onChange={e => set({ vat_exempt_reason: e.target.value })} placeholder="z.B. Reverse charge" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>Payment term / Zahlungsziel</label><input style={input} value={inv.payment_term} onChange={e => set({ payment_term: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Paid date / Bezahlt</label><input type="date" style={input} value={inv.paid_date || ''} onChange={e => set({ paid_date: e.target.value || null })} /></div>
            <div style={{ alignSelf: 'end' }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={inv.reminded} onChange={e => set({ reminded: e.target.checked })} /> Reminded / Gemahnt</label></div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Cost note (free text box)</label><textarea style={{ ...input, minHeight: 50 }} value={inv.cost_note} onChange={e => set({ cost_note: e.target.value })} placeholder="z.B. Reisekosten: Hotel: 171.29, Bahn: 172.15" /></div>
          <div><label style={lbl}>Intro override</label><input style={input} value={inv.intro_text} onChange={e => set({ intro_text: e.target.value })} placeholder="(default by language)" /></div>
          <div><label style={lbl}>Closing override</label><input style={input} value={inv.closing_text} onChange={e => set({ closing_text: e.target.value })} placeholder="(default by language)" /></div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: bold ? '1px solid var(--pbf-navy)' : 'none', fontWeight: bold ? 700 : 400, color: bold ? 'var(--pbf-navy)' : 'var(--pbf-text)', fontSize: bold ? 15 : 13 }}><span>{label}</span><span>{value}</span></div>;
}

// ─── Customers ───
function CustomersView({ customers, onChange, flash }: { customers: Customer[]; onChange: () => void; flash: (m: string) => void }) {
  const [editing, setEditing] = useState<Customer | null>(null);
  const set = (p: Partial<Customer>) => setEditing(s => s ? { ...s, ...p } : s);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>Customers ({customers.length})</h2>
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY_CUSTOMER, id: generateId() })}>+ New Customer</button>
      </div>
      {editing && (
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div><label style={lbl}>Kd-Nr</label><input style={input} value={editing.kd_nr} onChange={e => set({ kd_nr: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Name</label><input style={input} value={editing.name} onChange={e => set({ name: e.target.value })} /></div>
            <div><label style={lbl}>Name 2</label><input style={input} value={editing.name2} onChange={e => set({ name2: e.target.value })} /></div>
            <div><label style={lbl}>Street</label><input style={input} value={editing.street} onChange={e => set({ street: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
              <div><label style={lbl}>PLZ</label><input style={input} value={editing.postal} onChange={e => set({ postal: e.target.value })} /></div>
              <div><label style={lbl}>City</label><input style={input} value={editing.city} onChange={e => set({ city: e.target.value })} /></div>
            </div>
            <div><label style={lbl}>Country</label><input style={input} value={editing.country} onChange={e => set({ country: e.target.value })} /></div>
            <div><label style={lbl}>Contact / zuständig</label><input style={input} value={editing.contact} onChange={e => set({ contact: e.target.value })} /></div>
            <div><label style={lbl}>Email</label><input style={input} value={editing.email} onChange={e => set({ email: e.target.value })} /></div>
            <div><label style={lbl}>Standard rate</label><input type="number" step="any" style={input} value={editing.standard_rate} onChange={e => set({ standard_rate: parseFloat(e.target.value) || 0 })} /></div>
            <div><label style={lbl}>Standard VAT %</label><input type="number" step="any" style={input} value={editing.standard_vat} onChange={e => set({ standard_vat: parseFloat(e.target.value) || 0 })} /></div>
            <div><label style={lbl}>VAT ID</label><input style={input} value={editing.vat_id} onChange={e => set({ vat_id: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Payment term</label><input style={input} value={editing.payment_term} onChange={e => set({ payment_term: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={async () => { await saveCustomer(editing); setEditing(null); onChange(); flash('Customer saved.'); }}>Save</button>
          </div>
        </div>
      )}
      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <thead><tr style={{ background: 'var(--pbf-navy)', color: 'white', textAlign: 'left' }}>
          {['Kd-Nr', 'Name', 'City', 'Rate', 'VAT', ''].map((h, i) => <th key={i} style={{ padding: '8px 12px', fontSize: 12, textAlign: i >= 5 ? 'right' : 'left' }}>{h}</th>)}
        </tr></thead>
        <tbody>{customers.map(c => (
          <tr key={c.id} style={{ borderBottom: '1px solid var(--pbf-border)' }}>
            <td style={{ padding: '7px 12px', fontSize: 13 }}>{c.kd_nr}</td>
            <td style={{ padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>{c.name}</td>
            <td style={{ padding: '7px 12px', fontSize: 13 }}>{c.city}</td>
            <td style={{ padding: '7px 12px', fontSize: 13 }}>{c.standard_rate || ''}</td>
            <td style={{ padding: '7px 12px', fontSize: 13 }}>{c.standard_vat}%</td>
            <td style={{ padding: '7px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className="btn-ghost" onClick={() => setEditing(structuredClone(c))}>Edit</button>
              <button className="btn-danger" onClick={async () => { if (confirm('Delete customer?')) { await deleteCustomer(c.id); onChange(); } }}>Del</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ─── Settings ───
function SettingsForm({ value, onSave }: { value: SellerSettings; onSave: (s: SellerSettings) => void }) {
  const [s, setS] = useState<SellerSettings>(value);
  useEffect(() => setS(value), [value]);
  const set = (p: Partial<SellerSettings>) => setS(x => ({ ...x, ...p }));
  const f = (label: string, key: keyof SellerSettings, type = 'text') => (
    <div><label style={lbl}>{label}</label><input type={type} style={input} value={String(s[key] ?? '')} onChange={e => set({ [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value } as Partial<SellerSettings>)} /></div>
  );
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22 }}>Your invoice details</h2>
        <button className="btn-primary" onClick={() => onSave(s)}>Save settings</button>
      </div>
      <div style={card}><h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Issuer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {f('Company name', 'company_name')}{f('Contact name', 'contact_name')}{f('Credentials', 'credentials')}
          {f('Address', 'address_line')}{f('Postal', 'postal_code')}{f('City', 'city')}
          {f('Country (ISO)', 'country')}{f('Email', 'email')}{f('Website', 'website')}
          {f('Phone', 'phone')}{f('Mobile', 'mobile')}{f('Logo URL', 'logo_url')}
        </div>
      </div>
      <div style={card}><h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Tax & bank</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {f('VAT ID (USt-IdNr.)', 'vat_id')}{f('Tax number (Steuer-Nr)', 'tax_number')}{f('SAP Ariba ANID', 'sap_ariba_anid')}
          {f('Bank name', 'bank_name')}{f('Account holder', 'account_holder')}{f('Konto', 'bank_account_no')}
          {f('BLZ', 'blz')}{f('IBAN', 'iban')}{f('BIC', 'bic')}
          {f('Default VAT %', 'default_vat_rate', 'number')}
          <div style={{ alignSelf: 'end' }}><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={s.kleinunternehmer} onChange={e => set({ kleinunternehmer: e.target.checked })} /> Kleinunternehmer §19</label></div>
        </div>
      </div>
      <div style={card}><h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Invoice numbering</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {f('Number prefix', 'invoice_prefix')}{f('Next number', 'next_invoice_seq', 'number')}{f('Payment terms (days)', 'payment_terms_days', 'number')}
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Footer notes</label><textarea style={{ ...input, minHeight: 40 }} value={s.footer_notes} onChange={e => set({ footer_notes: e.target.value })} /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Import ───
function ImportView({ customers, onCustomers, onInvoices }: { customers: Customer[]; onCustomers: (c: Customer[]) => void; onInvoices: (i: Invoice[]) => void }) {
  const [mode, setMode] = useState<'customers' | 'invoices'>('customers');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [cMap, setCMap] = useState<CustomerMapping | null>(null);
  const [iMap, setIMap] = useState<InvoiceMapping | null>(null);
  const [lang, setLang] = useState<Lang>('de');
  const [error, setError] = useState('');

  async function onFile(file: File) {
    setError('');
    try {
      const parsed = await parseSpreadsheet(file);
      setSheet(parsed);
      setCMap(autoMapCustomers(parsed.headers));
      setIMap(autoMapInvoices(parsed.headers));
    } catch (e) { setError((e as Error).message); }
  }

  const byKdNr: Record<string, Customer> = {};
  for (const c of customers) if (c.kd_nr) byKdNr[c.kd_nr.trim()] = c;

  const previewCustomers = sheet && cMap ? buildCustomers(sheet.rows, cMap) : [];
  const previewInvoices = sheet && iMap ? buildInvoices(sheet.rows, iMap, byKdNr, lang) : [];

  const fields = mode === 'customers' ? CUSTOMER_FIELDS : INVOICE_FIELDS;
  const mapping = mode === 'customers' ? cMap : iMap;
  const setMapKey = (k: string, v: string) => {
    if (mode === 'customers') setCMap(m => m ? { ...m, [k]: v } : m);
    else setIMap(m => m ? { ...m, [k]: v } : m);
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 22, marginBottom: 16 }}>Import from MS Access</h2>
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={mode === 'customers' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('customers')}>Customers (Kunden)</button>
          <button className={mode === 'invoices' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('invoices')}>Invoices (Rechnungen)</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 12 }}>
          Export the {mode === 'customers' ? 'Kunden' : 'Rechnungen'} table to Excel/CSV and upload it. Columns are auto-matched; adjust below.
          {mode === 'invoices' && ' Invoices link to customers by Kd-Nr (import customers first).'}
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {error && <p style={{ color: 'var(--pbf-red)', marginTop: 8 }}>{error}</p>}
      </div>

      {sheet && mapping && (
        <>
          <div style={card}>
            <h3 style={{ fontSize: 14, color: 'var(--pbf-navy)', marginBottom: 12 }}>Map columns ({sheet.rows.length} rows)</h3>
            {mode === 'invoices' && (
              <div style={{ marginBottom: 12 }}><label style={lbl}>Invoice language</label>
                <select style={{ ...input, width: 160 }} value={lang} onChange={e => setLang(e.target.value as Lang)}><option value="de">Deutsch</option><option value="en">English</option></select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fields.map(fld => (
                <div key={fld.key}><label style={lbl}>{fld.label}</label>
                  <select style={input} value={(mapping as Record<string, string>)[fld.key] || ''} onChange={e => setMapKey(fld.key, e.target.value)}>
                    <option value="">— none —</option>
                    {sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--pbf-muted)' }}>
              {mode === 'customers' ? `${previewCustomers.length} customers` : `${previewInvoices.length} invoices`} will be imported.
            </span>
            {mode === 'customers'
              ? <button className="btn-primary" disabled={!previewCustomers.length} onClick={() => onCustomers(previewCustomers)}>Import {previewCustomers.length} customers</button>
              : <button className="btn-primary" disabled={!previewInvoices.length} onClick={() => onInvoices(previewInvoices)}>Import {previewInvoices.length} invoices</button>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Email modal (with attachments) ───
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function EmailModal({ invoice, seller, onClose, onSent }: { invoice: Invoice; seller: SellerSettings; onClose: () => void; onSent: () => void }) {
  const de = invoice.language !== 'en';
  const [to, setTo] = useState(invoice.buyer_email || '');
  const [cc, setCc] = useState(seller.email || '');
  const [subject, setSubject] = useState(`${de ? 'Rechnung' : 'Invoice'} ${invoice.invoice_number} — ${seller.company_name}`);
  const [message, setMessage] = useState(de
    ? `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${invoice.invoice_number} als ZUGFeRD-PDF.\n\nMit freundlichen Grüßen\n${seller.contact_name}`
    : `Ladies and Gentlemen,\n\nplease find attached invoice ${invoice.invoice_number} as a ZUGFeRD PDF.\n\nKind regards\n${seller.contact_name}`);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setError(''); setSending(true);
    try {
      const attachments = await Promise.all(files.map(async f => ({ filename: f.name, contentType: f.type, contentBase64: await readBase64(f) })));
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/invoices/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ invoice, seller, to, cc, subject, message, attachments }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Send failed');
      onSent();
    } catch (e) { setError((e as Error).message); }
    setSending(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 8, padding: 24, width: 560, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "'Source Serif 4', serif", color: 'var(--pbf-navy)', fontSize: 18, marginBottom: 16 }}>Email invoice {invoice.invoice_number}</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><label style={lbl}>To</label><input style={input} value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><label style={lbl}>Cc</label><input style={input} value={cc} onChange={e => setCc(e.target.value)} /></div>
          <div><label style={lbl}>Subject</label><input style={input} value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div><label style={lbl}>Message</label><textarea style={{ ...input, minHeight: 130 }} value={message} onChange={e => setMessage(e.target.value)} /></div>
          <div>
            <label style={lbl}>Attachments (invoice PDF is added automatically)</label>
            <input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <ul style={{ fontSize: 12, color: 'var(--pbf-muted)', marginTop: 6, paddingLeft: 18 }}>{files.map((f, i) => <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}</ul>}
          </div>
        </div>
        {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={sending || !to} onClick={send}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
