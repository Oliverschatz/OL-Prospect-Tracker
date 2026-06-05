// ─── Invoicing types (German e-invoice / ZUGFeRD + GiroCode) ───

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

// EN 16931 VAT category codes (UNCL5305 subset relevant to us)
//  S  = Standard rate (19% / 7%)
//  AE = Reverse charge (Steuerschuldnerschaft des Leistungsempfängers)
//  Z  = Zero rated goods
//  E  = Exempt from tax (e.g. Kleinunternehmer §19 UStG)
//  K  = Intra-community supply (innergemeinschaftliche Lieferung)
//  G  = Export outside the EU
//  O  = Outside scope of VAT
export type VatCategory = 'S' | 'AE' | 'Z' | 'E' | 'K' | 'G' | 'O';

export interface VatCategoryInfo {
  code: VatCategory;
  label: string;
  /** Whether the rate is fixed at 0 for this category. */
  zeroRated: boolean;
  /** Exemption reason text printed on the invoice + put in the XML. */
  exemptionReason?: string;
}

export const VAT_CATEGORIES: VatCategoryInfo[] = [
  { code: 'S', label: 'Standard (19% / 7%)', zeroRated: false },
  {
    code: 'AE', label: 'Reverse charge', zeroRated: true,
    exemptionReason: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse charge)',
  },
  {
    code: 'K', label: 'Intra-community supply', zeroRated: true,
    exemptionReason: 'Innergemeinschaftliche Lieferung (Art. 138 MwStSystRL)',
  },
  {
    code: 'G', label: 'Export (outside EU)', zeroRated: true,
    exemptionReason: 'Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a UStG)',
  },
  {
    code: 'E', label: 'Exempt — Kleinunternehmer §19', zeroRated: true,
    exemptionReason: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).',
  },
  { code: 'Z', label: 'Zero rated', zeroRated: true },
  { code: 'O', label: 'Outside scope of VAT', zeroRated: true },
];

export function vatCategoryInfo(code: VatCategory): VatCategoryInfo {
  return VAT_CATEGORIES.find(c => c.code === code) || VAT_CATEGORIES[0];
}

// Common UN/ECE Rec 20 unit codes, with human labels for the editor.
export const UNIT_CODES: { code: string; label: string }[] = [
  { code: 'C62', label: 'Piece' },
  { code: 'HUR', label: 'Hour' },
  { code: 'DAY', label: 'Day' },
  { code: 'MON', label: 'Month' },
  { code: 'E48', label: 'Service unit' },
  { code: 'LS', label: 'Lump sum' },
  { code: 'KGM', label: 'Kilogram' },
  { code: 'MTR', label: 'Metre' },
];

export interface SellerSettings {
  user_id?: string;
  company_name: string;
  contact_name: string;
  address_line: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  vat_id: string;
  tax_number: string;
  iban: string;
  bic: string;
  bank_name: string;
  kleinunternehmer: boolean;
  default_vat_rate: number;
  payment_terms_days: number;
  invoice_prefix: string;
  next_invoice_seq: number;
  logo_url: string;
  footer_notes: string;
}

export const EMPTY_SELLER: SellerSettings = {
  company_name: '',
  contact_name: '',
  address_line: '',
  postal_code: '',
  city: '',
  country: 'DE',
  email: '',
  phone: '',
  website: '',
  vat_id: '',
  tax_number: '',
  iban: '',
  bic: '',
  bank_name: '',
  kleinunternehmer: false,
  default_vat_rate: 19,
  payment_terms_days: 14,
  invoice_prefix: 'RE-',
  next_invoice_seq: 1,
  logo_url: '',
  footer_notes: '',
};

export interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  vat_category: VatCategory;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  delivery_date: string | null;
  due_date: string | null;
  currency: string;
  company_id: string | null;
  contact_id: string | null;
  buyer_name: string;
  buyer_contact: string;
  buyer_address: string;
  buyer_postal: string;
  buyer_city: string;
  buyer_country: string;
  buyer_vat_id: string;
  buyer_email: string;
  buyer_reference: string;
  intro_text: string;
  notes: string;
  payment_terms: string;
  created_at?: string;
  updated_at?: string;
  items: InvoiceItem[];
}

export function emptyItem(position: number, defaultVatRate = 19): InvoiceItem {
  return {
    id: '',
    position,
    description: '',
    quantity: 1,
    unit: 'C62',
    unit_price: 0,
    vat_rate: defaultVatRate,
    vat_category: 'S',
  };
}
