"use strict";
// ─── Invoice PDF generation (ZUGFeRD hybrid PDF + GiroCode QR) ───
// Reproduces the Oliver F. Lehmann letter layout (bilingual DE/EN), draws the
// SEPA GiroCode, and embeds the EN 16931 CII XML to make a hybrid e-invoice.
// Runs in Node (API route) — pdf-lib + qrcode are isomorphic.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePdf = generateInvoicePdf;
const pdf_lib_1 = require("pdf-lib");
const qrcode_1 = __importDefault(require("qrcode"));
const invoice_calc_1 = require("./invoice-calc");
const invoice_i18n_1 = require("./invoice-i18n");
const zugferd_1 = require("./zugferd");
const girocode_1 = require("./girocode");
const RED = (0, pdf_lib_1.rgb)(0.80, 0.10, 0.13);
const NAVY = (0, pdf_lib_1.rgb)(0.102, 0.153, 0.267);
const BLACK = (0, pdf_lib_1.rgb)(0.12, 0.12, 0.12);
const GREY = (0, pdf_lib_1.rgb)(0.35, 0.35, 0.35);
const BORDER = (0, pdf_lib_1.rgb)(0, 0, 0);
const PW = 595.28, PH = 841.89;
const LM = 65; // left body margin
const RM = PW - 50; // right margin (545)
const RIGHT_X = 360; // right info column
function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        bytes[i] = bin.charCodeAt(i);
    return bytes;
}
function wrap(text, font, size, maxWidth) {
    const words = (text || '').split(/\s+/);
    const out = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(t, size) > maxWidth && cur) {
            out.push(cur);
            cur = w;
        }
        else
            cur = t;
    }
    if (cur)
        out.push(cur);
    return out.length ? out : [''];
}
function countryName(country, lang) {
    const c = (country || '').trim().toLowerCase();
    if (c === 'de' || c === 'deutschland' || c === 'germany')
        return lang === 'en' ? 'Germany' : 'Deutschland';
    return country || '';
}
async function generateInvoicePdf(invoice, seller, opts = {}) {
    var _a, _b, _c;
    const lang = invoice.language === 'en' ? 'en' : 'de';
    const L = (0, invoice_i18n_1.labels)(lang);
    const totals = (0, invoice_calc_1.computeTotals)(invoice);
    const cur = invoice.currency || 'EUR';
    const currencyName = /eur/i.test(cur) ? (lang === 'en' ? 'Euro' : 'Euro') : cur;
    const pdf = await pdf_lib_1.PDFDocument.create();
    pdf.setTitle(`${L.invoiceTitle(invoice.invoice_number)}`);
    pdf.setProducer('OL Prospect Tracker — Invoicing');
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const page = pdf.addPage([PW, PH]);
    const T = (s, x, y, o = {}) => { var _a, _b, _c; return page.drawText(s || '', { x, y, size: (_a = o.size) !== null && _a !== void 0 ? _a : 9, font: (_b = o.font) !== null && _b !== void 0 ? _b : font, color: (_c = o.color) !== null && _c !== void 0 ? _c : BLACK }); };
    const TR = (s, xRight, y, o = {}) => {
        var _a, _b, _c;
        const f = (_a = o.font) !== null && _a !== void 0 ? _a : font, sz = (_b = o.size) !== null && _b !== void 0 ? _b : 9;
        page.drawText(s || '', { x: xRight - f.widthOfTextAtSize(s || '', sz), y, size: sz, font: f, color: (_c = o.color) !== null && _c !== void 0 ? _c : BLACK });
    };
    // ─── Logo (centered top) ───
    if (opts.logoBytes && opts.logoBytes.length > 100) {
        try {
            const sig = opts.logoBytes.slice(0, 4);
            const isPng = sig[0] === 0x89 && sig[1] === 0x50;
            const img = isPng ? await pdf.embedPng(opts.logoBytes) : await pdf.embedJpg(opts.logoBytes);
            const w = 160, h = (img.height / img.width) * w;
            page.drawImage(img, { x: (PW - w) / 2, y: PH - 42 - h, width: w, height: h });
        }
        catch { /* logo is decorative; skip on failure */ }
    }
    // ─── Sender line (small) ───
    const senderName = [seller.contact_name, seller.credentials].filter(Boolean).join(', ');
    const senderAddr = `${seller.address_line} - ${seller.postal_code} ${seller.city}, ${countryName(seller.country, lang)}`;
    T(senderName, LM, 700, { size: 8, color: GREY });
    T(senderAddr, LM, 689, { size: 8, color: GREY });
    // ─── Recipient block (left) ───
    let ry = 668;
    const recipient = [
        invoice.buyer_name, invoice.buyer_name2, invoice.buyer_street,
        [invoice.buyer_postal, invoice.buyer_city].filter(Boolean).join(' '),
        countryName(invoice.buyer_country, lang),
    ].filter(Boolean);
    T(recipient[0] || '', LM, ry, { size: 11, font: bold });
    ry -= 16;
    for (const line of recipient.slice(1)) {
        T(line, LM, ry, { size: 11 });
        ry -= 14;
    }
    // ─── Right info block (contact + bank + tax) ───
    let iy = 700;
    const infoRow = (label, value) => {
        if (!value && !label) {
            iy -= 6;
            return;
        }
        T(label, RIGHT_X, iy, { size: 8.5, color: GREY });
        T(value, RIGHT_X + 70, iy, { size: 8.5 });
        iy -= 11;
    };
    infoRow(lang === 'en' ? 'Phone' : 'Tel.', seller.phone);
    infoRow(lang === 'en' ? 'mobile' : 'mobil', seller.mobile);
    infoRow('', '');
    if (lang === 'en') {
        infoRow(L.payableTo, seller.bank_name ? `${seller.bank_name},` : '');
        infoRow('', 'D-80271 Munich');
        infoRow('', '');
        infoRow(L.accountHolder, seller.account_holder);
        infoRow(L.iban, seller.iban);
        infoRow(L.bic, seller.bic);
        infoRow('', '');
        infoRow(L.sapAriba, seller.sap_ariba_anid);
        infoRow('', '');
        infoRow(L.taxNo, seller.tax_number);
        infoRow(L.vatNo, seller.vat_id);
    }
    else {
        infoRow(L.bankHeading, '');
        infoRow(seller.bank_name, '');
        infoRow(L.account, seller.bank_account_no);
        infoRow(L.blz, seller.blz);
        infoRow(L.iban, seller.iban);
        infoRow(L.bic, seller.bic);
        infoRow('', '');
        infoRow(L.taxNo, seller.tax_number);
        infoRow(L.vatNo, seller.vat_id);
        infoRow(L.sapAriba, seller.sap_ariba_anid);
    }
    // ─── Date + title ───
    TR((0, invoice_i18n_1.fmtDate)(invoice.issue_date, lang), RM, 560, { size: 10 });
    T(L.invoiceTitle(invoice.invoice_number), LM, 532, { size: 11, font: bold });
    // ─── Salutation + intro ───
    T(L.salutation, LM, 492, { size: 10 });
    T(invoice.intro_text || L.intro, LM, 472, { size: 10 });
    // ─── Cost table ───
    const x0 = LM, x1 = RM;
    const lblL = x0 + 8, valL = x0 + 95; // left column label / value-left
    const lblR = 300, valR = x1 - 8; // right column label / value-right
    let y = 452;
    const rowH = 13;
    const groupTops = [];
    const leftRow = (label, value, opt = {}) => {
        T(label, lblL, y, { size: 9, color: NAVY });
        T(value, valL, y, { size: 9, font: opt.bold ? bold : font });
    };
    const rightRow = (label, value, opt = {}) => {
        T(label, lblR, y, { size: 9, color: NAVY });
        TR(value, valR, y, { size: 9, font: opt.bold ? bold : font });
    };
    groupTops.push(y + 9);
    // Group 1 — engagement
    leftRow(L.topic, invoice.topic);
    y -= rowH;
    leftRow(L.serviceType, invoice.service_type);
    y -= rowH;
    leftRow(L.venue, invoice.venue);
    y -= rowH;
    leftRow(L.start, (0, invoice_i18n_1.fmtDate)(invoice.billing_start, lang));
    rightRow(L.currency, currencyName);
    y -= rowH;
    leftRow(L.finish, (0, invoice_i18n_1.fmtDate)(invoice.billing_end, lang));
    rightRow(L.rate, (0, invoice_calc_1.moneyPlain)(invoice.rate));
    y -= rowH;
    leftRow(invoice.billing_unit || '', String((_a = invoice.units) !== null && _a !== void 0 ? _a : ''));
    rightRow(L.fee, (0, invoice_calc_1.moneyPlain)(totals.honorar), { bold: true });
    y -= rowH;
    // Group 2 — Nebenkosten
    y -= 4;
    page.drawLine({ start: { x: x0, y: y + 8 }, end: { x: x1, y: y + 8 }, thickness: 0.7, color: BORDER });
    y -= 4;
    const g2top = y + 9;
    if (lang === 'en') {
        T(L.handouts, lblL, y, { size: 9, color: NAVY });
        T(String((_b = invoice.handouts_qty) !== null && _b !== void 0 ? _b : 0), valL, y, { size: 9 });
        T(L.pricePerCopy, x0 + 150, y, { size: 9, color: NAVY });
        T((0, invoice_calc_1.moneyPlain)(invoice.handouts_unit_price), x0 + 215, y, { size: 9 });
    }
    else {
        T(L.handouts, lblL, y, { size: 9, color: NAVY });
        T(String((_c = invoice.handouts_qty) !== null && _c !== void 0 ? _c : 0), valL, y, { size: 9 });
    }
    rightRow(L.preparation, (0, invoice_calc_1.moneyPlain)(totals.preparation));
    y -= rowH;
    rightRow(L.travel, (0, invoice_calc_1.moneyPlain)(totals.travel));
    y -= rowH;
    rightRow(L.other, (0, invoice_calc_1.moneyPlain)(totals.other));
    y -= rowH;
    if (totals.handouts) {
        rightRow(L.literature, (0, invoice_calc_1.moneyPlain)(totals.handouts));
        y -= rowH;
    }
    // extra free-form lines (user-added beyond the structured fields)
    for (const it of invoice.items || []) {
        if (!it.description && !it.unit_price)
            continue;
        rightRow(it.description || '—', (0, invoice_calc_1.moneyPlain)((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)));
        y -= rowH;
    }
    rightRow(L.additionalTotal, (0, invoice_calc_1.moneyPlain)(totals.nebenkosten), { bold: true });
    y -= rowH;
    // Group 3 — totals
    y -= 4;
    page.drawLine({ start: { x: x0, y: y + 8 }, end: { x: x1, y: y + 8 }, thickness: 0.7, color: BORDER });
    y -= 4;
    const g3top = y + 9;
    leftRow(L.vatRate, `${totals.vatRate} %`);
    rightRow(L.netTotal, (0, invoice_calc_1.moneyPlain)(totals.net));
    y -= rowH;
    rightRow(L.vat, (0, invoice_calc_1.moneyPlain)(totals.vat));
    y -= rowH;
    rightRow(L.amountDue, (0, invoice_calc_1.moneyPlain)(totals.gross), { bold: true });
    y -= rowH;
    // Group 4 — explanation / cost-note box (always present, like the legacy form)
    y -= 2;
    page.drawLine({ start: { x: x0, y: y + 8 }, end: { x: x1, y: y + 8 }, thickness: 0.7, color: BORDER });
    y -= 6;
    if (invoice.cost_note) {
        for (const ln of wrap(invoice.cost_note, font, 9, x1 - x0 - 16)) {
            T(ln, lblL, y, { size: 9 });
            y -= 12;
        }
        y -= 4;
    }
    else {
        y -= 22; // keep an empty box for explanations even when there's no note
    }
    const tableBottom = y + 4;
    // Outer table border
    const tableTop = groupTops[0] + 2;
    page.drawRectangle({ x: x0, y: tableBottom, width: x1 - x0, height: tableTop - tableBottom, borderColor: BORDER, borderWidth: 0.8 });
    void g2top;
    void g3top;
    // ─── Payment line + transfer note ───
    y = tableBottom - 16;
    T(L.payment, lblL - 8 + 0, y, { size: 9, color: GREY });
    T(invoice.payment_term, x0 + 60, y, { size: 9 });
    if (lang === 'en' && L.transferNote)
        TR(L.transferNote, x1, y, { size: 9, color: GREY });
    y -= 26;
    // ─── Closing + signoff ───
    for (const ln of wrap(invoice.closing_text || L.closing, font, 10, x1 - x0)) {
        T(ln, LM, y, { size: 10 });
        y -= 14;
    }
    y -= 16;
    T(L.signoff, LM, y, { size: 10 });
    y -= 40;
    // ─── GiroCode QR (scan-to-pay) ───
    const giro = (0, girocode_1.giroCodeFromSettings)(seller, totals.gross, invoice.invoice_number);
    if (giro) {
        try {
            const qrUrl = await qrcode_1.default.toDataURL(giro, { margin: 1, width: 240 });
            const qrImg = await pdf.embedPng(dataUrlToBytes(qrUrl));
            const qs = 78;
            const qy = Math.max(70, y - qs);
            page.drawImage(qrImg, { x: x1 - qs, y: qy, width: qs, height: qs });
            TR(lang === 'en' ? 'Scan to pay (GiroCode)' : 'Scan zum Bezahlen (GiroCode)', x1, qy - 9, { size: 7, color: GREY });
        }
        catch { /* best-effort */ }
    }
    // ─── Footer ───
    page.drawLine({ start: { x: LM, y: 52 }, end: { x: RM, y: 52 }, thickness: 0.5, color: (0, pdf_lib_1.rgb)(0.8, 0.8, 0.85) });
    T(`${L.internet} ${seller.website}`, LM, 40, { size: 8, color: GREY });
    T(`${L.emailLabel} ${seller.email}`, LM, 30, { size: 8, color: GREY });
    if (seller.footer_notes)
        TR(seller.footer_notes, RM, 40, { size: 7, color: GREY });
    // ─── Embed ZUGFeRD XML ───
    const xml = (0, zugferd_1.buildZugferdXml)(invoice, seller);
    await pdf.attach(new TextEncoder().encode(xml), 'factur-x.xml', {
        mimeType: 'text/xml',
        description: 'Factur-X/ZUGFeRD invoice data (EN 16931)',
        creationDate: new Date(),
        modificationDate: new Date(),
        afRelationship: pdf_lib_1.AFRelationship.Data,
    });
    try {
        injectFacturXMetadata(pdf);
    }
    catch { /* advisory */ }
    return pdf.save();
}
function injectFacturXMetadata(pdf) {
    const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
    const stream = pdf.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' });
    const ref = pdf.context.register(stream);
    pdf.catalog.set(pdf_lib_1.PDFName.of('Metadata'), ref);
}
