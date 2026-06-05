// ─── EPC QR Code / GiroCode (SEPA scan-to-pay) ───
// Encodes a SEPA Credit Transfer so the payer's banking app pre-fills the transfer.
// Spec: European Payments Council EPC069-12 "Quick Response Code: Guidelines".

import type { SellerSettings } from './invoice-types';

export interface GiroCodeParams {
  name: string;      // beneficiary name (max 70)
  iban: string;
  bic?: string;      // optional for SEPA-area transfers (EPC v2)
  amount: number;    // EUR
  reference: string; // remittance info / unstructured (max 140) — usually the invoice no.
}

function sanitizeIban(iban: string): string {
  return (iban || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Build the GiroCode payload string. The caller renders it as a QR code.
 * Returns null when required data (name/IBAN/positive amount) is missing.
 */
export function buildGiroCodePayload(p: GiroCodeParams): string | null {
  const iban = sanitizeIban(p.iban);
  const name = (p.name || '').trim().slice(0, 70);
  if (!name || !iban || !(p.amount > 0)) return null;

  const amount = `EUR${p.amount.toFixed(2)}`;
  const remittance = (p.reference || '').trim().slice(0, 140);

  // BCD service tag, version 002, UTF-8 (charset 1), SCT identification.
  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    (p.bic || '').replace(/\s+/g, '').toUpperCase(),
    name,
    iban,
    amount,
    '',          // purpose code (optional)
    '',          // structured reference (optional)
    remittance,  // unstructured remittance info
  ];
  // Total payload must stay within 331 bytes per the EPC spec.
  return lines.join('\n');
}

export function giroCodeFromSettings(
  seller: SellerSettings,
  amount: number,
  reference: string,
): string | null {
  return buildGiroCodePayload({
    name: seller.company_name || seller.contact_name,
    iban: seller.iban,
    bic: seller.bic,
    amount,
    reference,
  });
}
