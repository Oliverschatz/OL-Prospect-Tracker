// ─── Invoice money math (EN 16931 compatible) ───
import type { Invoice, InvoiceItem, VatCategory } from './invoice-types';

/** Round to 2 decimals using commercial rounding, avoiding float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineNet(item: InvoiceItem): number {
  return round2((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
}

export interface VatGroup {
  category: VatCategory;
  rate: number;
  base: number;   // taxable base amount
  tax: number;    // tax amount
}

export interface InvoiceTotals {
  net: number;            // sum of line nets (BT-106)
  vatGroups: VatGroup[];  // breakdown per (category, rate)
  taxTotal: number;       // total VAT (BT-110)
  gross: number;          // grand total (BT-112)
}

/**
 * Group lines by (VAT category, rate) and total everything.
 * Tax is computed per group on the rounded base, per EN 16931.
 */
export function computeTotals(items: InvoiceItem[]): InvoiceTotals {
  const groups = new Map<string, VatGroup>();
  let net = 0;

  for (const item of items) {
    const amount = lineNet(item);
    net = round2(net + amount);
    const rate = Number(item.vat_rate) || 0;
    const key = `${item.vat_category}@${rate}`;
    const existing = groups.get(key);
    if (existing) {
      existing.base = round2(existing.base + amount);
    } else {
      groups.set(key, { category: item.vat_category, rate, base: amount, tax: 0 });
    }
  }

  const vatGroups = Array.from(groups.values());
  let taxTotal = 0;
  for (const g of vatGroups) {
    g.tax = round2(g.base * (g.rate / 100));
    taxTotal = round2(taxTotal + g.tax);
  }

  return { net, vatGroups, taxTotal, gross: round2(net + taxTotal) };
}

/** Locale-aware currency formatting for display + PDF. */
export function formatMoney(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Plain fixed-2 string for XML amounts (always '.' decimal, no grouping). */
export function xmlAmount(amount: number): string {
  return (Math.round((amount + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function invoiceGross(invoice: Invoice): number {
  return computeTotals(invoice.items).gross;
}
