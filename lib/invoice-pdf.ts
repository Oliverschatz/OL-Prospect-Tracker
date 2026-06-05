// ─── Invoice PDF generation (ZUGFeRD hybrid PDF + GiroCode QR) ───
// Renders a human-readable A4 invoice with pdf-lib, draws the SEPA GiroCode,
// and embeds the EN 16931 CII XML so the file is a hybrid e-invoice.

import {
  PDFDocument, StandardFonts, rgb, AFRelationship, PDFName, PDFString,
} from 'pdf-lib';
import QRCode from 'qrcode';
import type { Invoice, SellerSettings } from './invoice-types';
import { vatCategoryInfo } from './invoice-types';
import { computeTotals, lineNet } from './invoice-calc';
import { buildZugferdXml } from './zugferd';
import { giroCodeFromSettings } from './girocode';

const NAVY = rgb(0.102, 0.153, 0.267);   // #1a2744
const GOLD = rgb(0.910, 0.659, 0.220);   // #e8a838
const MUTED = rgb(0.443, 0.502, 0.588);  // #718096
const LINE = rgb(0.847, 0.867, 0.902);   // #d8dde6

const A4 = { w: 595.28, h: 841.89 };
const M = 50; // margin

/** German-style money with an ASCII-safe currency suffix (Helvetica can't render every glyph). */
function money(amount: number, currency = 'EUR'): string {
  const neg = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${grouped},${dec} ${currency}`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function generateInvoicePdf(invoice: Invoice, seller: SellerSettings): Promise<Uint8Array> {
  const totals = computeTotals(invoice.items);
  const currency = invoice.currency || 'EUR';

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rechnung ${invoice.invoice_number}`);
  pdf.setProducer('OL Prospect Tracker — Invoicing');
  pdf.setCreator('OL Prospect Tracker');

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (s: string, x: number, yy: number, opts: { size?: number; font?: typeof font; color?: typeof NAVY } = {}) => {
    page.drawText(s || '', { x, y: yy, size: opts.size ?? 9, font: opts.font ?? font, color: opts.color ?? rgb(0.18, 0.21, 0.25) });
  };
  const rightText = (s: string, xRight: number, yy: number, opts: { size?: number; font?: typeof font; color?: typeof NAVY } = {}) => {
    const f = opts.font ?? font; const size = opts.size ?? 9;
    page.drawText(s || '', { x: xRight - f.widthOfTextAtSize(s || '', size), y: yy, size, font: f, color: opts.color ?? rgb(0.18, 0.21, 0.25) });
  };

  // ─── Header: seller + title ───
  text(seller.company_name || seller.contact_name || 'Your Company', M, y, { size: 15, font: bold, color: NAVY });
  rightText('RECHNUNG', A4.w - M, y, { size: 20, font: bold, color: NAVY });
  y -= 16;
  const sellerLine = [seller.address_line, [seller.postal_code, seller.city].filter(Boolean).join(' '), seller.country]
    .filter(Boolean).join(' · ');
  text(sellerLine, M, y, { size: 8, color: MUTED });
  y -= 11;
  text([seller.email, seller.phone, seller.website].filter(Boolean).join(' · '), M, y, { size: 8, color: MUTED });

  // ─── Buyer block ───
  y -= 40;
  text(seller.company_name ? `${seller.company_name} · ${sellerLine}` : '', M, y, { size: 6.5, color: MUTED });
  y -= 16;
  text(invoice.buyer_name, M, y, { size: 10, font: bold, color: NAVY });
  y -= 13;
  if (invoice.buyer_contact) { text(invoice.buyer_contact, M, y, { size: 9 }); y -= 12; }
  if (invoice.buyer_address) { text(invoice.buyer_address, M, y, { size: 9 }); y -= 12; }
  const buyerCity = [invoice.buyer_postal, invoice.buyer_city].filter(Boolean).join(' ');
  if (buyerCity) { text(buyerCity, M, y, { size: 9 }); y -= 12; }
  if (invoice.buyer_country && invoice.buyer_country !== 'DE') { text(invoice.buyer_country, M, y, { size: 9 }); y -= 12; }

  // ─── Meta block (right) ───
  const metaX = 360, metaXR = A4.w - M;
  let my = A4.h - M - 70;
  const metaRow = (label: string, value: string) => {
    text(label, metaX, my, { size: 9, color: MUTED });
    rightText(value || '—', metaXR, my, { size: 9, font: bold, color: NAVY });
    my -= 14;
  };
  metaRow('Rechnungsnummer', invoice.invoice_number);
  metaRow('Rechnungsdatum', invoice.issue_date);
  if (invoice.delivery_date) metaRow('Leistungsdatum', invoice.delivery_date);
  if (invoice.due_date) metaRow('Fällig am', invoice.due_date);
  if (invoice.buyer_vat_id) metaRow('USt-IdNr. Kunde', invoice.buyer_vat_id);
  if (invoice.buyer_reference) metaRow('Referenz', invoice.buyer_reference);

  y = Math.min(y, my) - 24;

  // ─── Intro ───
  if (invoice.intro_text) {
    for (const ln of wrapText(invoice.intro_text, font, 9, A4.w - 2 * M)) { text(ln, M, y, { size: 9 }); y -= 12; }
    y -= 6;
  }

  // ─── Items table ───
  const cols = { pos: M, desc: M + 26, qty: 320, unit: 360, price: 410, vat: 470, total: A4.w - M };
  page.drawRectangle({ x: M, y: y - 4, width: A4.w - 2 * M, height: 18, color: rgb(0.965, 0.97, 0.98) });
  text('#', cols.pos, y, { size: 8, font: bold, color: NAVY });
  text('Beschreibung', cols.desc, y, { size: 8, font: bold, color: NAVY });
  rightText('Menge', cols.qty + 30, y, { size: 8, font: bold, color: NAVY });
  text('Einh.', cols.unit, y, { size: 8, font: bold, color: NAVY });
  rightText('Einzelpr.', cols.price + 40, y, { size: 8, font: bold, color: NAVY });
  rightText('USt%', cols.vat + 20, y, { size: 8, font: bold, color: NAVY });
  rightText('Netto', cols.total, y, { size: 8, font: bold, color: NAVY });
  y -= 18;

  const ensureSpace = (needed: number) => {
    if (y - needed < 120) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };

  invoice.items.forEach((item, i) => {
    const descLines = wrapText(item.description || '—', font, 9, cols.qty - cols.desc - 8);
    const rowH = Math.max(14, descLines.length * 11 + 3);
    ensureSpace(rowH);
    text(String(i + 1), cols.pos, y, { size: 9 });
    descLines.forEach((ln, li) => text(ln, cols.desc, y - li * 11, { size: 9 }));
    rightText(String(item.quantity), cols.qty + 30, y, { size: 9 });
    text(item.unit, cols.unit, y, { size: 9 });
    rightText(money(Number(item.unit_price) || 0, currency), cols.price + 40, y, { size: 9 });
    rightText(`${Number(item.vat_rate) || 0}`, cols.vat + 20, y, { size: 9 });
    rightText(money(lineNet(item), currency), cols.total, y, { size: 9 });
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: A4.w - M, y: y + 4 }, thickness: 0.5, color: LINE });
  });

  // ─── Totals ───
  y -= 10;
  const totX = 330, totXR = A4.w - M;
  const totRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    text(label, totX, y, { size: opts.size ?? 9, font: opts.bold ? bold : font, color: opts.bold ? NAVY : MUTED });
    rightText(value, totXR, y, { size: opts.size ?? 9, font: opts.bold ? bold : font, color: NAVY });
    y -= opts.bold ? 16 : 13;
  };
  totRow('Nettobetrag', money(totals.net, currency));
  for (const g of totals.vatGroups) {
    const cat = vatCategoryInfo(g.category);
    const lbl = g.rate > 0 ? `zzgl. USt ${g.rate}%` : `${cat.label} (0%)`;
    totRow(lbl, money(g.tax, currency));
  }
  page.drawLine({ start: { x: totX, y: y + 6 }, end: { x: totXR, y: y + 6 }, thickness: 1, color: NAVY });
  y -= 4;
  totRow('Gesamtbetrag', money(totals.gross, currency), { bold: true, size: 11 });

  // Exemption notes
  const reasons = Array.from(new Set(
    totals.vatGroups.map(g => vatCategoryInfo(g.category).exemptionReason).filter(Boolean) as string[]
  ));
  if (seller.kleinunternehmer && !reasons.some(r => r.includes('§ 19'))) {
    reasons.push('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).');
  }
  y -= 6;
  for (const r of reasons) {
    for (const ln of wrapText(r, font, 8, A4.w - 2 * M)) { text(ln, M, y, { size: 8, color: MUTED }); y -= 10; }
  }

  // ─── Payment block + GiroCode ───
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.5, color: LINE });
  y -= 16;
  const payTextLines: string[] = [];
  const terms = invoice.payment_terms || (invoice.due_date ? `Bitte überweisen Sie den Betrag bis zum ${invoice.due_date}.` : '');
  if (terms) payTextLines.push(terms);
  if (seller.iban) payTextLines.push(`IBAN: ${seller.iban}${seller.bic ? `   BIC: ${seller.bic}` : ''}`);
  if (seller.bank_name) payTextLines.push(`Bank: ${seller.bank_name}`);
  payTextLines.push(`Verwendungszweck: ${invoice.invoice_number}`);

  text('Zahlung', M, y, { size: 9, font: bold, color: NAVY });
  let py = y - 14;
  for (const ln of payTextLines) { text(ln, M, py, { size: 9 }); py -= 12; }

  // GiroCode QR (scan-to-pay) on the right
  const giro = giroCodeFromSettings(seller, totals.gross, invoice.invoice_number);
  if (giro) {
    try {
      const qrDataUrl = await QRCode.toDataURL(giro, { margin: 1, width: 220 });
      const qrImg = await pdf.embedPng(dataUrlToBytes(qrDataUrl));
      const qrSize = 86;
      page.drawImage(qrImg, { x: A4.w - M - qrSize, y: py - 6, width: qrSize, height: qrSize });
      rightText('Scan zum Bezahlen (GiroCode)', A4.w - M, py - 18, { size: 7, color: MUTED });
    } catch {
      /* QR rendering is best-effort; invoice is still valid without it */
    }
  }
  y = py - 110;

  // ─── Footer ───
  if (invoice.notes) {
    for (const ln of wrapText(invoice.notes, font, 8, A4.w - 2 * M)) { text(ln, M, y, { size: 8, color: MUTED }); y -= 10; }
  }
  const footerBits = [
    seller.vat_id && `USt-IdNr.: ${seller.vat_id}`,
    seller.tax_number && `Steuernr.: ${seller.tax_number}`,
    seller.footer_notes,
  ].filter(Boolean) as string[];
  let fy = M + 4;
  for (const bit of footerBits.reverse()) {
    for (const ln of wrapText(bit, font, 7, A4.w - 2 * M).reverse()) {
      page.drawText(ln, { x: M, y: fy, size: 7, font, color: MUTED });
      fy += 9;
    }
  }

  // ─── Embed ZUGFeRD XML (hybrid e-invoice) ───
  const xml = buildZugferdXml(invoice, seller);
  await pdf.attach(new TextEncoder().encode(xml), 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X/ZUGFeRD invoice data (EN 16931)',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Data,
  });

  // Identify the embedded data as ZUGFeRD/Factur-X via XMP metadata (best-effort).
  try {
    injectFacturXMetadata(pdf, xml.length);
  } catch {
    /* metadata is advisory; the attached XML is the source of truth */
  }

  return pdf.save();
}

/** Add the Factur-X XMP extension schema so conformant readers detect the embedded XML. */
function injectFacturXMetadata(pdf: PDFDocument, _xmlLen: number) {
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
  pdf.catalog.set(PDFName.of('Metadata'), ref);
  // Tag a creator note so the provenance is visible in metadata readers.
  pdf.catalog.set(PDFName.of('PieceInfo'), pdf.context.obj({}));
  void PDFString;
}
