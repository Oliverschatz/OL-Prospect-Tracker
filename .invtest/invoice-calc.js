"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round2 = round2;
exports.computeTotals = computeTotals;
exports.vatCategoryOf = vatCategoryOf;
exports.buildLineItems = buildLineItems;
exports.formatMoney = formatMoney;
exports.moneyPlain = moneyPlain;
exports.xmlAmount = xmlAmount;
const invoice_types_1 = require("./invoice-types");
const invoice_i18n_1 = require("./invoice-i18n");
function round2(n) {
    return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}
function computeTotals(inv) {
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
function vatCategoryOf(inv, seller) {
    if (seller.kleinunternehmer)
        return 'E';
    if (inv.vat_exempt)
        return 'AE'; // reverse charge by default; reason text explains specifics
    return 'S';
}
/** Decompose the structured invoice into EN 16931 line items. */
function buildLineItems(inv, lang) {
    const L = (0, invoice_i18n_1.labels)(lang);
    const strip = (s) => s.replace(/:\s*$/, '');
    const lines = [];
    const honorar = round2((Number(inv.rate) || 0) * (Number(inv.units) || 0));
    if (honorar !== 0 || inv.topic) {
        lines.push({
            name: inv.topic || strip(L.fee),
            quantity: Number(inv.units) || 1,
            unitCode: (0, invoice_types_1.unitToCode)(inv.billing_unit),
            unitPrice: Number(inv.rate) || 0,
            net: honorar,
        });
    }
    const single = (name, amount) => {
        const a = round2(amount);
        if (a !== 0)
            lines.push({ name, quantity: 1, unitCode: 'C62', unitPrice: a, net: a });
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
function formatMoney(amount, currency = 'EUR') {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount || 0);
}
/** Plain "1,234.56" with thousands separators (no currency symbol) for the PDF table. */
function moneyPlain(amount) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}
/** Fixed-2 string for XML amounts (always '.' decimal, no grouping). */
function xmlAmount(amount) {
    return round2(amount).toFixed(2);
}
