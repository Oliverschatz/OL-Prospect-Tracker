// ─── Invoicing types (German e-invoice / ZUGFeRD + GiroCode) ───
// Models mirror the legacy MS Access "Kunden" / "Rechnungen" structure.

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type Lang = 'de' | 'en';

// EN 16931 VAT category codes used when emitting the CII XML.
//  S = standard, AE = reverse charge, K = intra-community, G = export,
//  E = exempt (§19 Kleinunternehmer), Z = zero rated, O = outside scope.
export type VatCategory = 'S' | 'AE' | 'Z' | 'E' | 'K' | 'G' | 'O';

// ─── Customer (Kunden) ───
export interface Customer {
  id: string;
  kd_nr: string;
  name: string;
  name2: string;
  street: string;
  postal: string;
  city: string;
  country: string;
  hf: string;
  contact: string;     // zuständig
  first_name: string;  // Vorname
  email: string;
  active: boolean;
  standard_rate: number;
  standard_vat: number;
  payment_term: string;
  vat_id: string;
  notes: string;
  created_at?: string;
}

export const EMPTY_CUSTOMER: Customer = {
  id: '', kd_nr: '', name: '', name2: '', street: '', postal: '', city: '',
  country: 'Deutschland', hf: '', contact: '', first_name: '', email: '',
  active: true, standard_rate: 0, standard_vat: 19, payment_term: '', vat_id: '', notes: '',
};

// ─── Seller settings (the invoice issuer) ───
export interface SellerSettings {
  user_id?: string;
  company_name: string;
  contact_name: string;
  credentials: string;
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  vat_id: string;
  tax_number: string;
  sap_ariba_anid: string;
  bank_name: string;
  account_holder: string;
  bank_account_no: string;
  blz: string;
  iban: string;
  bic: string;
  kleinunternehmer: boolean;
  default_vat_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
  next_invoice_seq: number;
  logo_url: string;
  footer_notes: string;
}

// Seeded with Oliver F. Lehmann's details from the sample invoice so the tool is
// usable immediately. Every field is editable on the in-app Settings page.
export const SELLER_DEFAULTS: SellerSettings = {
  company_name: 'Oliver F. Lehmann Project Business Training',
  contact_name: 'Oliver F. Lehmann',
  credentials: 'M.Sc., PMP',
  address_line: 'Trollblumenstraße 39g',
  postal_code: '80995',
  city: 'München',
  country: 'DE',
  email: 'oliver@oliverlehmann.com',
  phone: '+49 (89) 96 04 95 60',
  mobile: '+49 (171) 9 34 61 68',
  website: 'https://oliverlehmann.com',
  vat_id: 'DE175431111',
  tax_number: '145/168/10441',
  sap_ariba_anid: 'AN11187784305',
  bank_name: 'Deutsche Bank',
  account_holder: 'Oliver F. Lehmann, Munich',
  bank_account_no: '0 254 060 00',
  blz: '700 700 24',
  iban: 'DE51700700240025406000',
  bic: 'DEUTDEDBMUC',
  kleinunternehmer: false,
  default_vat_rate: 19,
  payment_terms_days: 14,
  invoice_prefix: '',
  next_invoice_seq: 2002,
  logo_url: 'https://oliverlehmann.com/wp-content/uploads/2023/05/cropped-logo-ol.png',
  footer_notes: '',
};

export const EMPTY_SELLER: SellerSettings = { ...SELLER_DEFAULTS };

// ─── Optional extra free-form line item ───
export interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export function emptyItem(position: number): InvoiceItem {
  return { id: '', position, description: '', quantity: 1, unit: 'C62', unit_price: 0 };
}

// ─── Invoice (Rechnung) ───
export interface Invoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  language: Lang;
  issue_date: string;
  due_date: string | null;
  currency: string;

  customer_id: string | null;
  company_id: string | null;
  contact_id: string | null;

  buyer_name: string;
  buyer_name2: string;
  buyer_street: string;
  buyer_postal: string;
  buyer_city: string;
  buyer_country: string;
  buyer_contact: string;
  buyer_vat_id: string;
  buyer_email: string;
  buyer_reference: string;

  topic: string;
  service_type: string;
  venue: string;
  billing_start: string | null;
  billing_end: string | null;
  billing_unit: string;
  units: number;
  rate: number;

  preparation: number;
  travel: number;
  other_costs: number;
  handouts_qty: number;
  handouts_unit_price: number;
  handouts_flat: number;

  vat_rate: number;
  vat_exempt: boolean;
  vat_exempt_reason: string;
  payment_term: string;

  intro_text: string;
  closing_text: string;
  cost_note: string;
  paid_date: string | null;
  reminded: boolean;

  created_at?: string;
  updated_at?: string;
  items: InvoiceItem[]; // optional extra lines
}

// Common UN/ECE Rec 20 unit codes for the structured billing unit + extra lines.
export const UNIT_CODES: { code: string; label_de: string; label_en: string }[] = [
  { code: 'DAY', label_de: 'Tage', label_en: 'Days' },
  { code: 'HUR', label_de: 'Stunden', label_en: 'Hours' },
  { code: 'C62', label_de: 'Stück', label_en: 'Pieces' },
  { code: 'WEE', label_de: 'Wochen', label_en: 'Weeks' },
  { code: 'MON', label_de: 'Monate', label_en: 'Months' },
  { code: 'LS', label_de: 'Pauschal', label_en: 'Lump sum' },
];

/** Map a human billing unit ("Tage"/"Days"/…) to a UN/ECE code for the XML. */
export function unitToCode(unit: string): string {
  const u = (unit || '').trim().toLowerCase();
  const hit = UNIT_CODES.find(c =>
    c.code.toLowerCase() === u || c.label_de.toLowerCase() === u || c.label_en.toLowerCase() === u);
  return hit ? hit.code : 'C62';
}
