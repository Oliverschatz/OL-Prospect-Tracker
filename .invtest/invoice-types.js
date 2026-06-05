"use strict";
// ─── Invoicing types (German e-invoice / ZUGFeRD + GiroCode) ───
// Models mirror the legacy MS Access "Kunden" / "Rechnungen" structure.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIT_CODES = exports.EMPTY_SELLER = exports.SELLER_DEFAULTS = exports.EMPTY_CUSTOMER = void 0;
exports.emptyItem = emptyItem;
exports.unitToCode = unitToCode;
exports.EMPTY_CUSTOMER = {
    id: '', kd_nr: '', name: '', name2: '', street: '', postal: '', city: '',
    country: 'Deutschland', hf: '', contact: '', first_name: '', email: '',
    active: true, standard_rate: 0, standard_vat: 19, payment_term: '', vat_id: '', notes: '',
};
// Seeded with Oliver F. Lehmann's details from the sample invoice so the tool is
// usable immediately. Every field is editable on the in-app Settings page.
exports.SELLER_DEFAULTS = {
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
exports.EMPTY_SELLER = { ...exports.SELLER_DEFAULTS };
function emptyItem(position) {
    return { id: '', position, description: '', quantity: 1, unit: 'C62', unit_price: 0 };
}
// Common UN/ECE Rec 20 unit codes for the structured billing unit + extra lines.
exports.UNIT_CODES = [
    { code: 'DAY', label_de: 'Tage', label_en: 'Days' },
    { code: 'HUR', label_de: 'Stunden', label_en: 'Hours' },
    { code: 'C62', label_de: 'Stück', label_en: 'Pieces' },
    { code: 'WEE', label_de: 'Wochen', label_en: 'Weeks' },
    { code: 'MON', label_de: 'Monate', label_en: 'Months' },
    { code: 'LS', label_de: 'Pauschal', label_en: 'Lump sum' },
];
/** Map a human billing unit ("Tage"/"Days"/…) to a UN/ECE code for the XML. */
function unitToCode(unit) {
    const u = (unit || '').trim().toLowerCase();
    const hit = exports.UNIT_CODES.find(c => c.code.toLowerCase() === u || c.label_de.toLowerCase() === u || c.label_en.toLowerCase() === u);
    return hit ? hit.code : 'C62';
}
