// ─── Bilingual labels + copy for the invoice layout (DE / EN) ───
import type { Lang } from './invoice-types';

export interface InvoiceLabels {
  invoiceTitle: (no: string) => string;
  salutation: string;
  intro: string;
  closing: string;
  signoff: string;
  // engagement block
  topic: string; serviceType: string; venue: string;
  start: string; finish: string;
  currency: string; rate: string; fee: string;
  // additional costs
  preparation: string; travel: string; other: string; literature: string;
  additionalTotal: string;
  handouts: string; pricePerCopy: string;
  // totals
  vatRate: string; netTotal: string; vat: string; amountDue: string;
  // payment + bank
  payment: string; transferNote: string;
  bankHeading: string; payableTo: string; accountHolder: string;
  account: string; blz: string; iban: string; bic: string;
  sapAriba: string; taxNo: string; vatNo: string;
  internet: string; emailLabel: string;
}

const DE: InvoiceLabels = {
  invoiceTitle: (no) => `Rechnung Nr. ${no}`,
  salutation: 'Sehr geehrte Damen und Herren,',
  intro: 'für Dienstleistungen stellen wir in Rechnung:',
  closing: 'Wir hoffen, Sie waren mit der Ausführung zufrieden, und freuen uns auf weitere Aufträge aus Ihrem Haus.',
  signoff: 'Mit freundlichen Grüßen',
  topic: 'Thema:', serviceType: 'Auftragsart:', venue: 'Einsatzort:',
  start: 'Abr.-Beginn:', finish: 'Abr.-Ende:',
  currency: 'Währung:', rate: 'Abrechnungssatz:', fee: 'Honorar:',
  preparation: 'Vorbereitung:', travel: 'Reisekosten:', other: 'sonstige:', literature: 'Unterlagen:',
  additionalTotal: 'Nebenkosten gesamt:',
  handouts: 'Unterlagen:', pricePerCopy: 'Einzelpreis:',
  vatRate: 'USt.-Satz:', netTotal: 'gesamt:', vat: 'USt:', amountDue: 'Endbetrag:',
  payment: 'Zahlung:', transferNote: '',
  bankHeading: 'Bankverbindung:', payableTo: 'Bankverbindung:', accountHolder: 'Kontoinhaber:',
  account: 'Konto:', blz: 'BLZ:', iban: 'IBAN:', bic: 'BIC / Swift:',
  sapAriba: 'SAP Ariba ANID:', taxNo: 'Steuer-Nr:', vatNo: 'USt. ID-Nr:',
  internet: 'Internet:', emailLabel: 'E-Mail:',
};

const EN: InvoiceLabels = {
  invoiceTitle: (no) => `Invoice No. ${no}`,
  salutation: 'Ladies and Gentlemen,',
  intro: 'For the delivery of services, I am invoicing herewith:',
  closing: 'We hope that you were satisfied with the delivery of our services, and would be happy to do further business with your company.',
  signoff: 'Kind regards',
  topic: 'Topic:', serviceType: 'Type of service:', venue: 'Venue:',
  start: 'Start date:', finish: 'Finish date:',
  currency: 'Currency:', rate: 'Fee/unit:', fee: 'Total fee:',
  preparation: 'Preparation:', travel: 'Travelling:', other: 'Other costs:', literature: 'Literature:',
  additionalTotal: 'Additional costs, total:',
  handouts: 'Handouts, copies:', pricePerCopy: 'Price p. copy:',
  vatRate: 'VAT:', netTotal: 'Net total:', vat: 'VAT:', amountDue: 'Amount due:',
  payment: 'Payment:', transferNote: 'Please ensure coverage of all transfer-related charges.',
  bankHeading: 'Payable to:', payableTo: 'Payable to:', accountHolder: 'Account holder:',
  account: 'Account:', blz: 'Sort code:', iban: 'IBAN:', bic: 'BIC / Swift:',
  sapAriba: 'SAP Ariba ANID:', taxNo: 'Tax-No:', vatNo: 'VAT No:',
  internet: 'Internet:', emailLabel: 'E-Mail:',
};

export function labels(lang: Lang): InvoiceLabels {
  return lang === 'en' ? EN : DE;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Format an ISO date for the chosen language (DE: 05.06.2026, EN: 05 June 2026). */
export function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  if (lang === 'en') return `${String(d).padStart(2, '0')} ${MONTHS_EN[m - 1]} ${y}`;
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
