// ─── Migrate old invoices/customers from MS Access (via Excel/CSV export) ───
// The Access schema isn't known up front, so this parses any sheet into rows and
// lets the UI map source columns onto invoice fields. Rows sharing an invoice
// number are grouped into one invoice with multiple line items.

import * as XLSX from 'xlsx';
import { generateId } from './helpers';
import type { Invoice, InvoiceItem, VatCategory } from './invoice-types';

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
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

// Which source column feeds each target field. Empty string = unmapped.
export interface ImportMapping {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  buyer_name: string;
  buyer_address: string;
  buyer_postal: string;
  buyer_city: string;
  buyer_vat_id: string;
  buyer_email: string;
  // line-item columns
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

export const EMPTY_MAPPING: ImportMapping = {
  invoice_number: '', issue_date: '', due_date: '',
  buyer_name: '', buyer_address: '', buyer_postal: '', buyer_city: '',
  buyer_vat_id: '', buyer_email: '',
  description: '', quantity: '', unit_price: '', vat_rate: '',
};

/** Best-effort auto-match of source headers to target fields by fuzzy name. */
export function autoMap(headers: string[]): ImportMapping {
  const m = { ...EMPTY_MAPPING };
  const find = (...needles: string[]) =>
    headers.find(h => needles.some(n => h.toLowerCase().includes(n))) || '';
  m.invoice_number = find('invoice', 'rechnungsnr', 'rechnungsnummer', 'belegnr', 'nummer', 'nr');
  m.issue_date = find('datum', 'date', 'rechnungsdatum');
  m.due_date = find('fällig', 'faellig', 'due');
  m.buyer_name = find('kunde', 'customer', 'name', 'firma', 'company');
  m.buyer_address = find('straße', 'strasse', 'address', 'adresse', 'street');
  m.buyer_postal = find('plz', 'postal', 'zip');
  m.buyer_city = find('ort', 'city', 'stadt');
  m.buyer_vat_id = find('ust', 'vat', 'steuer');
  m.buyer_email = find('email', 'mail', 'e-mail');
  m.description = find('beschreibung', 'description', 'leistung', 'artikel', 'position', 'text');
  m.quantity = find('menge', 'quantity', 'anzahl', 'qty');
  m.unit_price = find('preis', 'price', 'einzelpreis', 'betrag', 'amount');
  m.vat_rate = find('mwst', 'ust', 'vat', 'steuersatz', 'tax');
  return m;
}

function num(s: string | undefined): number {
  if (!s) return 0;
  // Accept both "1.234,56" (de) and "1234.56" (en).
  const cleaned = s.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(s: string | undefined): string {
  if (!s) return '';
  // dd.mm.yyyy → yyyy-mm-dd
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (de) {
    const [, d, mo, yr] = de;
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

/** Build importable invoices from parsed rows + a column mapping. */
export function buildInvoices(rows: Record<string, string>[], map: ImportMapping): Invoice[] {
  const groups = new Map<string, Record<string, string>[]>();
  let fallback = 0;
  for (const row of rows) {
    const key = (map.invoice_number && row[map.invoice_number]) || `__row_${fallback++}`;
    (groups.get(key) || groups.set(key, []).get(key)!).push(row);
  }

  const invoices: Invoice[] = [];
  for (const [key, groupRows] of Array.from(groups.entries())) {
    const first = groupRows[0];
    const items: InvoiceItem[] = groupRows.map((r, i) => {
      const rate = map.vat_rate ? num(r[map.vat_rate]) : 19;
      return {
        id: generateId(),
        position: i,
        description: (map.description && r[map.description]) || 'Position',
        quantity: map.quantity ? num(r[map.quantity]) || 1 : 1,
        unit: 'C62',
        unit_price: map.unit_price ? num(r[map.unit_price]) : 0,
        vat_rate: rate,
        vat_category: (rate > 0 ? 'S' : 'E') as VatCategory,
      };
    });
    invoices.push({
      id: generateId(),
      invoice_number: map.invoice_number ? first[map.invoice_number] : key.replace('__row_', 'IMP-'),
      status: 'paid', // historical invoices imported from Access default to paid
      issue_date: isoDate(map.issue_date ? first[map.issue_date] : '') || new Date().toISOString().slice(0, 10),
      delivery_date: null,
      due_date: isoDate(map.due_date ? first[map.due_date] : '') || null,
      currency: 'EUR',
      company_id: null,
      contact_id: null,
      buyer_name: map.buyer_name ? first[map.buyer_name] : '',
      buyer_contact: '',
      buyer_address: map.buyer_address ? first[map.buyer_address] : '',
      buyer_postal: map.buyer_postal ? first[map.buyer_postal] : '',
      buyer_city: map.buyer_city ? first[map.buyer_city] : '',
      buyer_country: 'DE',
      buyer_vat_id: map.buyer_vat_id ? first[map.buyer_vat_id] : '',
      buyer_email: map.buyer_email ? first[map.buyer_email] : '',
      buyer_reference: '',
      intro_text: '',
      notes: 'Importiert aus MS Access',
      payment_terms: '',
      items,
    });
  }
  return invoices;
}
