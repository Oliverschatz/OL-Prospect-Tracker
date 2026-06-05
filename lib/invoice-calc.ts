// ─── Invoice money math (structured model → totals + EN 16931 lines) ───
import type { Invoice, Lang, SellerSettings, VatCategory } from './invoice-types';
import { unitToCode } from './invoice-types';
import { labels } from './invoice-i18n';

export function round2(n: number): number {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

export interface InvoiceTotals {
  honorar: number;
  preparation: number;
  travel: number;
  other: number;
  handouts: number;
  extras: number;
  nebenkosten: number;
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
}

export function computeTotals(inv: Invoice): InvoiceTotals {
  const honorar = round2((Number(inv.rate) || 0) * (Number(inv.units) || 0));
  const preparation = round2(inv.preparation);
  const travel = round2(inv.travel);
  const other = round2(inv.other_costs);
  const handouts = round2((Number(inv.handouts_qty) || 0) * (Number(inv.handouts_unit_price) || 0) + (Number(inv.handouts_flat) || 0));
  const extras = round2((inv.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0));
  const nebenkosten = round2(preparation + travel + other + handouts + extras);
  const net = round2(honorar + nebenkosten);
  const vatRate = inv.vat_exempt ? 0 : (Number(inv.vat_rate) || 0);
  const vat = round2(net * (vatRate / 100));
  const gross = round2(net + vat);
  return { honorar, preparation, travel, other, handouts, extras, nebenkosten, net, vatRate, vat, gross };
}

export function vatCategoryOf(inv: Invoice, seller: SellerSettings): VatCategory {
  if (seller.kleinunternehmer) return 'E';
  if (inv.vat_exempt) return 'AE'; // reverse charge by default; reason text explains specifics
  return 'S';
}

export interface ResolvedLine {
  name: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  net: number;
}

/** Decompose the structured invoice into EN 16931 line items. */
export function buildLineItems(inv: Invoice, lang: Lang): ResolvedLine[] {
  const L = labels(lang);
  const strip = (s: string) => s.replace(/:\s*$/, '');
  const lines: ResolvedLine[] = [];

  const honorar = round2((Number(inv.rate) || 0) * (Number(inv.units) || 0));
  if (honorar !== 0 || inv.topic) {
    lines.push({
      name: inv.topic || strip(L.fee),
      quantity: Number(inv.units) || 1,
      unitCode: unitToCode(inv.billing_unit),
      unitPrice: Number(inv.rate) || 0,
      net: honorar,
    });
  }
  const single = (name: string, amount: number) => {
    const a = round2(amount);
    if (a !== 0) lines.push({ name, quantity: 1, unitCode: 'C62', unitPrice: a, net: a });
  };
  single(strip(L.preparation), inv.preparation);
  single(strip(L.travel), inv.travel);
  single(strip(L.other), inv.other_costs);

  const handouts = round2((Number(inv.handouts_qty) || 0) * (Number(inv.handouts_unit_price) || 0) + (Number(inv.handouts_flat) || 0));
  if (handouts !== 0) {
    const qty = Number(inv.handouts_qty) || 1;
    lines.push({
      name: strip(L.literature),
      quantity: qty,
      unitCode: 'C62',
      unitPrice: qty ? round2(handouts / qty) : handouts,
      net: handouts,
    });
  }
  for (const it of inv.items || []) {
    const net = round2((Number(it.quantity) || 0) * (Number(it.unit_price) || 0));
    if (it.description || net !== 0) {
      lines.push({ name: it.description || '—', quantity: Number(it.quantity) || 1, unitCode: it.unit || 'C62', unitPrice: Number(it.unit_price) || 0, net });
    }
  }
  return lines;
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount || 0);
}

/** Plain "1,234.56" with thousands separators (no currency symbol) for the PDF table. */
export function moneyPlain(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}

/** Fixed-2 string for XML amounts (always '.' decimal, no grouping). */
export function xmlAmount(amount: number): string {
  return round2(amount).toFixed(2);
}
