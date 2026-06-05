// ─── ZUGFeRD / Factur-X CII XML builder (EN 16931 profile) ───
// Cross Industry Invoice (CII) XML conforming to "urn:cen.eu:en16931:2017",
// generated from the structured invoice model and embedded into the PDF/A-3.
// Validate output with a conformance checker (e.g. Mustangproject) before production use.

import type { Invoice, SellerSettings } from './invoice-types';
import { computeTotals, buildLineItems, vatCategoryOf, xmlAmount } from './invoice-calc';

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: string | null | undefined): string {
  return d ? d.replace(/-/g, '') : '';
}
function dateTimeString(d: string | null | undefined): string {
  const v = fmtDate(d);
  return v ? `<udt:DateTimeString format="102">${v}</udt:DateTimeString>` : '';
}

const COUNTRY_ISO: Record<string, string> = {
  deutschland: 'DE', germany: 'DE', österreich: 'AT', austria: 'AT', schweiz: 'CH',
  switzerland: 'CH', frankreich: 'FR', france: 'FR', niederlande: 'NL', netherlands: 'NL',
};
export function countryIso(country: string): string {
  const c = (country || '').trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return COUNTRY_ISO[c.toLowerCase()] || 'DE';
}

export function buildZugferdXml(invoice: Invoice, seller: SellerSettings): string {
  const totals = computeTotals(invoice);
  const resolved = buildLineItems(invoice, invoice.language);
  const currency = invoice.currency || 'EUR';
  const category = vatCategoryOf(invoice, seller);
  const rate = totals.vatRate;
  const deliveryDate = invoice.billing_end || invoice.billing_start || invoice.issue_date;

  const lines = resolved.map((ln, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(ln.name) || 'Position'}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${xmlAmount(ln.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(ln.unitCode)}">${xmlAmount(ln.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${xmlAmount(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${xmlAmount(ln.net)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('\n');

  const exemptionReason = category !== 'S'
    ? (invoice.vat_exempt_reason
        || (seller.kleinunternehmer ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).' : 'Steuerschuldnerschaft des Leistungsempfängers (Reverse charge)'))
    : '';
  const tradeTax = `        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${xmlAmount(totals.vat)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>${exemptionReason ? `
          <ram:ExemptionReason>${esc(exemptionReason)}</ram:ExemptionReason>` : ''}
          <ram:BasisAmount>${xmlAmount(totals.net)}</ram:BasisAmount>
          <ram:CategoryCode>${category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${xmlAmount(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`;

  const sellerTaxReg: string[] = [];
  if (seller.vat_id) sellerTaxReg.push(`        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(seller.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>`);
  if (seller.tax_number) sellerTaxReg.push(`        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(seller.tax_number)}</ram:ID></ram:SpecifiedTaxRegistration>`);

  const buyerVatReg = invoice.buyer_vat_id
    ? `\n        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(invoice.buyer_vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : '';

  const paymentMeans = seller.iban
    ? `        <ram:SpecifiedTradeSettlementPaymentMeans>
          <ram:TypeCode>58</ram:TypeCode>
          <ram:PayeePartyCreditorFinancialAccount>
            <ram:IBANID>${esc(seller.iban.replace(/\s+/g, ''))}</ram:IBANID>
          </ram:PayeePartyCreditorFinancialAccount>${seller.bic ? `
          <ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(seller.bic.replace(/\s+/g, ''))}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
        </ram:SpecifiedTradeSettlementPaymentMeans>\n`
    : '';

  const paymentTermsText = invoice.payment_term || (invoice.due_date ? `Zahlbar bis ${invoice.due_date}` : '');
  const paymentTerms = (paymentTermsText || invoice.due_date)
    ? `        <ram:SpecifiedTradePaymentTerms>
          ${paymentTermsText ? `<ram:Description>${esc(paymentTermsText)}</ram:Description>` : ''}
          ${invoice.due_date ? `<ram:DueDateDateTime>${dateTimeString(invoice.due_date)}</ram:DueDateDateTime>` : ''}
        </ram:SpecifiedTradePaymentTerms>\n`
    : '';

  const noteParts = [invoice.intro_text, invoice.cost_note].filter(Boolean);
  const includedNotes = noteParts.map(n => `    <ram:IncludedNote><ram:Content>${esc(n)}</ram:Content></ram:IncludedNote>`).join('\n');
  const buyerReference = invoice.buyer_reference ? `      <ram:BuyerReference>${esc(invoice.buyer_reference)}</ram:BuyerReference>\n` : '';

  const buyerStreet = [invoice.buyer_street, invoice.buyer_name2].filter(Boolean).join(', ');

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
          <ram:CountryID>${esc(countryIso(seller.country))}</ram:CountryID>
        </ram:PostalTradeAddress>${seller.email ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(seller.email)}</ram:URIID></ram:URIUniversalCommunication>` : ''}
${sellerTaxReg.join('\n')}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(invoice.buyer_name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(invoice.buyer_postal)}</ram:PostcodeCode>
          <ram:LineOne>${esc(buyerStreet)}</ram:LineOne>
          <ram:CityName>${esc(invoice.buyer_city)}</ram:CityName>
          <ram:CountryID>${esc(countryIso(invoice.buyer_country))}</ram:CountryID>
        </ram:PostalTradeAddress>${buyerVatReg}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>${dateTimeString(deliveryDate)}</ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(currency)}</ram:InvoiceCurrencyCode>
${paymentMeans}${tradeTax}
${paymentTerms}      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${xmlAmount(totals.net)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${xmlAmount(totals.net)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(currency)}">${xmlAmount(totals.vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${xmlAmount(totals.gross)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${xmlAmount(totals.gross)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
