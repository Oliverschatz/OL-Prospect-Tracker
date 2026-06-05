// ─── Migrate Kunden / Rechnungen from MS Access (Excel/CSV export) ───
// Parses a sheet into rows and maps source columns onto customers or invoices.
// Column headers vary by export, so mappings are editable in the UI and auto-guessed.

import * as XLSX from 'xlsx';
import { generateId } from './helpers';
import type { Customer, Invoice, Lang } from './invoice-types';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  const rows = json.map(r => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = String(v ?? '').trim();
    return out;
  });
  return { headers: rows.length ? Object.keys(rows[0]) : [], rows };
}

function num(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function bool(s: string | undefined): boolean {
  return /^(1|true|ja|yes|x|wahr|-1)$/i.test((s || '').trim());
}

function isoDate(s: string | undefined): string | null {
  if (!s) return null;
  const de = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (de) {
    const [, d, mo, yr] = de;
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // dd-Mon-yy (e.g. 05-Jun-26)
  const mon = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/);
  if (mon) {
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m = months[mon[2].toLowerCase()];
    if (m) { const year = mon[3].length === 2 ? `20${mon[3]}` : mon[3]; return `${year}-${m}-${mon[1].padStart(2, '0')}`; }
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function matcher(headers: string[]) {
  return (...needles: string[]) =>
    headers.find(h => needles.some(n => h.toLowerCase().includes(n.toLowerCase()))) || '';
}

// ─── Customers (Kunden) ───
export type CustomerMapping = Record<keyof CustomerFields, string>;
type CustomerFields = {
  kd_nr: string; name: string; name2: string; street: string; postal: string; city: string;
  country: string; contact: string; first_name: string; email: string; active: string;
  standard_rate: string; standard_vat: string; payment_term: string; vat_id: string;
};
export const CUSTOMER_FIELDS: { key: keyof CustomerFields; label: string }[] = [
  { key: 'kd_nr', label: 'Kd-Nr' }, { key: 'name', label: 'Kunde' }, { key: 'name2', label: 'Kunde 2' },
  { key: 'street', label: 'Straße' }, { key: 'postal', label: 'PLZ' }, { key: 'city', label: 'Ort' },
  { key: 'country', label: 'Land' }, { key: 'contact', label: 'zuständig' }, { key: 'first_name', label: 'Vorname' },
  { key: 'email', label: 'E-Mail' }, { key: 'active', label: 'Aktiv' }, { key: 'standard_rate', label: 'Standardsatz' },
  { key: 'standard_vat', label: 'Standard-MWSt' }, { key: 'payment_term', label: 'Zahlungsziel' }, { key: 'vat_id', label: 'USt-IdNr' },
];

export function autoMapCustomers(headers: string[]): CustomerMapping {
  const f = matcher(headers);
  return {
    kd_nr: f('kd-nr', 'kdnr', 'kundennr', 'kunden-nr', 'nummer'),
    name: f('kunde', 'name', 'firma'), name2: f('kunde 2', 'name2', 'zusatz'),
    street: f('straße', 'strasse', 'str'), postal: f('plz', 'postal'), city: f('ort', 'stadt'),
    country: f('land'), contact: f('zuständig', 'zustaendig', 'ansprech'), first_name: f('vorname'),
    email: f('mail'), active: f('aktiv'), standard_rate: f('standardsatz', 'satz'),
    standard_vat: f('standard-mwst', 'mwst', 'ust'), payment_term: f('zahlungsziel', 'zahlung'), vat_id: f('ust-id', 'ustid'),
  };
}

export function buildCustomers(rows: Record<string, string>[], m: CustomerMapping): Customer[] {
  const g = (r: Record<string, string>, key: keyof CustomerMapping) => (m[key] ? r[m[key]] : '') || '';
  return rows.filter(r => (m.name ? r[m.name] : '').trim()).map(r => ({
    id: generateId(),
    kd_nr: g(r, 'kd_nr'), name: g(r, 'name'), name2: g(r, 'name2'),
    street: g(r, 'street'), postal: g(r, 'postal'), city: g(r, 'city'),
    country: g(r, 'country') || 'Deutschland', hf: '', contact: g(r, 'contact'),
    first_name: g(r, 'first_name'), email: g(r, 'email'),
    active: m.active ? bool(r[m.active]) : true,
    standard_rate: num(g(r, 'standard_rate')), standard_vat: m.standard_vat ? num(r[m.standard_vat]) : 19,
    payment_term: g(r, 'payment_term'), vat_id: g(r, 'vat_id'), notes: '',
  }));
}

// ─── Invoices (Rechnungen) ───
type InvoiceFields = {
  invoice_number: string; issue_date: string; kd_nr: string; buyer_name: string;
  topic: string; service_type: string; venue: string; billing_start: string; billing_end: string;
  billing_unit: string; units: string; currency: string; rate: string;
  preparation: string; travel: string; other_costs: string;
  handouts_qty: string; handouts_unit_price: string; handouts_flat: string;
  vat_rate: string; vat_exempt: string; payment_term: string; cost_note: string; paid_date: string;
};
export type InvoiceMapping = Record<keyof InvoiceFields, string>;
export const INVOICE_FIELDS: { key: keyof InvoiceFields; label: string }[] = [
  { key: 'invoice_number', label: 'Rechnungsnummer' }, { key: 'issue_date', label: 'Datum' }, { key: 'kd_nr', label: 'Kd-Nr (link)' },
  { key: 'buyer_name', label: 'Kunde (Name)' }, { key: 'topic', label: 'Thema' }, { key: 'service_type', label: 'Auftragsart' },
  { key: 'venue', label: 'Einsatzort' }, { key: 'billing_start', label: 'Abr-Beginn' }, { key: 'billing_end', label: 'Abr-Ende' },
  { key: 'billing_unit', label: 'Abr-Einheit' }, { key: 'units', label: 'Einheiten' }, { key: 'currency', label: 'Währung' },
  { key: 'rate', label: 'Abr-Satz' }, { key: 'preparation', label: 'Vorbereitung' }, { key: 'travel', label: 'Anfahrt' },
  { key: 'other_costs', label: 'sonstige' }, { key: 'handouts_qty', label: 'Unterlagen Stückzahl' },
  { key: 'handouts_unit_price', label: 'Unterlagen Einzelpreis' }, { key: 'handouts_flat', label: 'Unterlagen pauschal' },
  { key: 'vat_rate', label: 'MWSt' }, { key: 'vat_exempt', label: 'MWST befreit' }, { key: 'payment_term', label: 'Zahlungsziel' },
  { key: 'cost_note', label: 'Notiz' }, { key: 'paid_date', label: 'Bezahlt' },
];

export function autoMapInvoices(headers: string[]): InvoiceMapping {
  const f = matcher(headers);
  return {
    invoice_number: f('rechnungsnr', 'rechnungsnummer', 'rnr', 'belegnr', 'nummer'), issue_date: f('datum', 'date'),
    kd_nr: f('kd-nr', 'kdnr', 'kundennr'), buyer_name: f('kunde', 'name'),
    topic: f('thema', 'titel', 'topic'), service_type: f('auftragsart'), venue: f('einsatzort', 'ort'),
    billing_start: f('beginn', 'start'), billing_end: f('ende', 'end'), billing_unit: f('einheit', 'abr-einheit'),
    units: f('einheiten', 'anzahl', 'menge'), currency: f('währung', 'waehrung'), rate: f('satz', 'abr-satz'),
    preparation: f('vorbereitung'), travel: f('anfahrt', 'reise'), other_costs: f('sonstige'),
    handouts_qty: f('stückzahl', 'stueckzahl'), handouts_unit_price: f('einzelpreis'), handouts_flat: f('pauschal'),
    vat_rate: f('mwst', 'ust-satz'), vat_exempt: f('befreit'), payment_term: f('zahlungsziel'),
    cost_note: f('notiz', 'reisekosten', 'bemerkung'), paid_date: f('bezahlt'),
  };
}

export function buildInvoices(
  rows: Record<string, string>[],
  m: InvoiceMapping,
  customersByKdNr: Record<string, Customer>,
  lang: Lang,
): Invoice[] {
  const g = (r: Record<string, string>, key: keyof InvoiceMapping) => (m[key] ? r[m[key]] : '') || '';
  return rows.filter(r => (m.invoice_number ? r[m.invoice_number] : '').trim() || (m.buyer_name ? r[m.buyer_name] : '').trim()).map(r => {
    const kd = g(r, 'kd_nr');
    const cust = kd ? customersByKdNr[kd.trim()] : undefined;
    return {
      id: generateId(),
      invoice_number: g(r, 'invoice_number'),
      status: 'paid', language: lang,
      issue_date: isoDate(g(r, 'issue_date')) || new Date().toISOString().slice(0, 10),
      due_date: null, currency: g(r, 'currency') || 'EUR',
      customer_id: cust?.id || null, company_id: null, contact_id: null,
      buyer_name: cust?.name || g(r, 'buyer_name'),
      buyer_name2: cust?.name2 || '', buyer_street: cust?.street || '',
      buyer_postal: cust?.postal || '', buyer_city: cust?.city || '',
      buyer_country: cust?.country || 'Deutschland', buyer_contact: cust?.contact || '',
      buyer_vat_id: cust?.vat_id || '', buyer_email: cust?.email || '', buyer_reference: '',
      topic: g(r, 'topic'), service_type: g(r, 'service_type'), venue: g(r, 'venue'),
      billing_start: isoDate(g(r, 'billing_start')), billing_end: isoDate(g(r, 'billing_end')),
      billing_unit: g(r, 'billing_unit') || 'Tage', units: m.units ? num(r[m.units]) || 1 : 1,
      rate: num(g(r, 'rate')),
      preparation: num(g(r, 'preparation')), travel: num(g(r, 'travel')), other_costs: num(g(r, 'other_costs')),
      handouts_qty: num(g(r, 'handouts_qty')), handouts_unit_price: num(g(r, 'handouts_unit_price')), handouts_flat: num(g(r, 'handouts_flat')),
      vat_rate: m.vat_rate ? num(r[m.vat_rate]) : 19, vat_exempt: m.vat_exempt ? bool(r[m.vat_exempt]) : false,
      vat_exempt_reason: '', payment_term: g(r, 'payment_term'),
      intro_text: '', closing_text: '', cost_note: g(r, 'cost_note'),
      paid_date: isoDate(g(r, 'paid_date')), reminded: false, items: [],
    };
  });
}
