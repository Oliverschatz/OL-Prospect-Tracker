// ─── ZUGFeRD / Factur-X CII XML builder (EN 16931 profile) ───
// Produces a Cross Industry Invoice (CII) XML conforming to the
// EN 16931 ("urn:cen.eu:en16931:2017") guideline, ready to embed into a PDF/A-3.
//
// NOTE: validate generated files against a conformance checker (e.g. the
// Mustangproject / FeRD validator) before relying on them in production.

import type { Invoice, SellerSettings } from './invoice-types';
import { vatCategoryInfo } from './invoice-types';
import { computeTotals, lineNet, xmlAmount } from './invoice-calc';

function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** ISO date (YYYY-MM-DD) → CII format 102 (YYYYMMDD). */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return d.replace(/-/g, '');
}

function dateTimeString(d: string | null | undefined): string {
  const v = fmtDate(d);
  return v ? `<udt:DateTimeString format="102">${v}</udt:DateTimeString>` : '';
}

/**
 * Build the ZUGFeRD/Factur-X CII XML string for an invoice.
 * The embedded filename should be "factur-x.xml" (or "zugferd-invoice.xml").
 */
export function buildZugferdXml(invoice: Invoice, seller: SellerSettings): string {
  const totals = computeTotals(invoice.items);
  const currency = invoice.currency || 'EUR';

  // ─── Line items ───
  const lines = invoice.items.map((item, i) => {
    const cat = vatCategoryInfo(item.vat_category);
    const rate = Number(item.vat_rate) || 0;
    return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(item.description) || 'Position'}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${xmlAmount(Number(item.unit_price) || 0)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(item.unit || 'C62')}">${xmlAmount(Number(item.quantity) || 0)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${cat.code}</ram:CategoryCode>
          <ram:RateApplicablePercent>${xmlAmount(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${xmlAmount(lineNet(item))}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('\n');

  // ─── Header-level VAT breakdown (one ApplicableTradeTax per group) ───
  const tradeTaxes = totals.vatGroups.map(g => {
    const cat = vatCategoryInfo(g.category);
    const reason = cat.exemptionReason
      ? `\n          <ram:ExemptionReason>${esc(cat.exemptionReason)}</ram:ExemptionReason>`
      : '';
    return `        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${xmlAmount(g.tax)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>${reason}
          <ram:BasisAmount>${xmlAmount(g.base)}</ram:BasisAmount>
          <ram:CategoryCode>${cat.code}</ram:CategoryCode>
          <ram:RateApplicablePercent>${xmlAmount(g.rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`;
  }).join('\n');

  // ─── Seller tax registrations ───
  const sellerTaxReg: string[] = [];
  if (seller.vat_id) sellerTaxReg.push(`        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(seller.vat_id)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`);
  if (seller.tax_number) sellerTaxReg.push(`        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${esc(seller.tax_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`);

  const buyerVatReg = invoice.buyer_vat_id
    ? `\n        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(invoice.buyer_vat_id)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : '';

  const paymentMeans = seller.iban
    ? `        <ram:SpecifiedTradeSettlementPaymentMeans>
          <ram:TypeCode>58</ram:TypeCode>
          <ram:PayeePartyCreditorFinancialAccount>
            <ram:IBANID>${esc(seller.iban.replace(/\s+/g, ''))}</ram:IBANID>
          </ram:PayeePartyCreditorFinancialAccount>${seller.bic ? `
          <ram:PayeeSpecifiedCreditorFinancialInstitution>
            <ram:BICID>${esc(seller.bic)}</ram:BICID>
          </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
        </ram:SpecifiedTradeSettlementPaymentMeans>\n`
    : '';

  const paymentTermsText = invoice.payment_terms
    || (invoice.due_date ? `Zahlbar ohne Abzug bis ${invoice.due_date}` : '');
  const paymentTerms = (paymentTermsText || invoice.due_date)
    ? `        <ram:SpecifiedTradePaymentTerms>
          ${paymentTermsText ? `<ram:Description>${esc(paymentTermsText)}</ram:Description>` : ''}
          ${invoice.due_date ? `<ram:DueDateDateTime>${dateTimeString(invoice.due_date)}</ram:DueDateDateTime>` : ''}
        </ram:SpecifiedTradePaymentTerms>\n`
    : '';

  const noteParts = [invoice.intro_text, invoice.notes].filter(Boolean);
  if (seller.kleinunternehmer) {
    noteParts.push('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).');
  }
  const includedNotes = noteParts.map(n =>
    `    <ram:IncludedNote>
      <ram:Content>${esc(n)}</ram:Content>
    </ram:IncludedNote>`).join('\n');

  const buyerReference = invoice.buyer_reference
    ? `      <ram:BuyerReference>${esc(invoice.buyer_reference)}</ram:BuyerReference>\n`
    : '';

  const deliveryEvent = invoice.delivery_date
    ? `      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>${dateTimeString(invoice.delivery_date)}</ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>${dateTimeString(invoice.issue_date)}</ram:IssueDateTime>
${includedNotes}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>
${buyerReference}      <ram:SellerTradeParty>
        <ram:Name>${esc(seller.company_name) || esc(seller.contact_name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(seller.postal_code)}</ram:PostcodeCode>
          <ram:LineOne>${esc(seller.address_line)}</ram:LineOne>
          <ram:CityName>${esc(seller.city)}</ram:CityName>
          <ram:CountryID>${esc(seller.country || 'DE')}</ram:CountryID>
        </ram:PostalTradeAddress>${seller.email ? `
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${esc(seller.email)}</ram:URIID>
        </ram:URIUniversalCommunication>` : ''}
${sellerTaxReg.join('\n')}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(invoice.buyer_name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(invoice.buyer_postal)}</ram:PostcodeCode>
          <ram:LineOne>${esc(invoice.buyer_address)}</ram:LineOne>
          <ram:CityName>${esc(invoice.buyer_city)}</ram:CityName>
          <ram:CountryID>${esc(invoice.buyer_country || 'DE')}</ram:CountryID>
        </ram:PostalTradeAddress>${buyerVatReg}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
${deliveryEvent}    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(currency)}</ram:InvoiceCurrencyCode>
${paymentMeans}${tradeTaxes}
${paymentTerms}      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${xmlAmount(totals.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${xmlAmount(totals.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(currency)}">${xmlAmount(totals.taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${xmlAmount(totals.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${xmlAmount(totals.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
