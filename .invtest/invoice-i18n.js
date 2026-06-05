"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.labels = labels;
exports.fmtDate = fmtDate;
const DE = {
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
const EN = {
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
function labels(lang) {
    return lang === 'en' ? EN : DE;
}
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
/** Format an ISO date for the chosen language (DE: 05.06.2026, EN: 05 June 2026). */
function fmtDate(iso, lang) {
    if (!iso)
        return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d)
        return iso;
    if (lang === 'en')
        return `${String(d).padStart(2, '0')} ${MONTHS_EN[m - 1]} ${y}`;
    return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}
