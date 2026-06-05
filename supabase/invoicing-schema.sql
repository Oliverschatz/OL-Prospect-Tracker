-- OL Prospect Tracker — Invoicing module
-- Adds seller settings, invoices and invoice line items.
-- Each row is scoped to a user via user_id (Supabase Auth), like the rest of the app.
-- Supports German e-invoicing (ZUGFeRD / EN 16931) and SEPA GiroCode payment QR.

-- ─── Seller settings (one row per user = the invoice issuer) ───
CREATE TABLE IF NOT EXISTS seller_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL DEFAULT '',
  contact_name      TEXT NOT NULL DEFAULT '',
  address_line      TEXT NOT NULL DEFAULT '',
  postal_code       TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT 'DE',          -- ISO 3166-1 alpha-2
  email             TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  website           TEXT NOT NULL DEFAULT '',
  vat_id            TEXT NOT NULL DEFAULT '',            -- USt-IdNr (e.g. DE123456789)
  tax_number        TEXT NOT NULL DEFAULT '',            -- Steuernummer
  iban              TEXT NOT NULL DEFAULT '',
  bic               TEXT NOT NULL DEFAULT '',
  bank_name         TEXT NOT NULL DEFAULT '',
  kleinunternehmer  BOOLEAN NOT NULL DEFAULT false,      -- §19 UStG
  default_vat_rate  NUMERIC NOT NULL DEFAULT 19,
  payment_terms_days INT NOT NULL DEFAULT 14,
  invoice_prefix    TEXT NOT NULL DEFAULT '',            -- e.g. "RE-"
  next_invoice_seq  INT NOT NULL DEFAULT 1,
  logo_url          TEXT NOT NULL DEFAULT '',
  footer_notes      TEXT NOT NULL DEFAULT '',            -- HRB, Geschäftsführer, etc.
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Invoices ───
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,                                  -- Leistungs-/Lieferdatum
  due_date        DATE,
  currency        TEXT NOT NULL DEFAULT 'EUR',

  -- Optional link to the CRM (buyer fields below are a snapshot taken at link time)
  company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,

  -- Buyer snapshot (kept on the invoice so history stays correct)
  buyer_name      TEXT NOT NULL DEFAULT '',
  buyer_contact   TEXT NOT NULL DEFAULT '',
  buyer_address   TEXT NOT NULL DEFAULT '',
  buyer_postal    TEXT NOT NULL DEFAULT '',
  buyer_city      TEXT NOT NULL DEFAULT '',
  buyer_country   TEXT NOT NULL DEFAULT 'DE',
  buyer_vat_id    TEXT NOT NULL DEFAULT '',
  buyer_email     TEXT NOT NULL DEFAULT '',
  buyer_reference TEXT NOT NULL DEFAULT '',               -- Leitweg-ID / order ref (B2G)

  intro_text      TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  payment_terms   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Invoice line items ───
CREATE TABLE IF NOT EXISTS invoice_items (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position      INT NOT NULL DEFAULT 0,
  description   TEXT NOT NULL DEFAULT '',
  quantity      NUMERIC NOT NULL DEFAULT 1,
  unit          TEXT NOT NULL DEFAULT 'C62',             -- UN/ECE Rec 20 code (C62 = piece)
  unit_price    NUMERIC NOT NULL DEFAULT 0,
  vat_rate      NUMERIC NOT NULL DEFAULT 19,
  vat_category  TEXT NOT NULL DEFAULT 'S'                -- EN 16931 code: S/AE/Z/E/K/G/O
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_user_id ON invoice_items(user_id);

-- ─── RLS ───
ALTER TABLE seller_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own seller_settings" ON seller_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own invoices" ON invoices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own invoice_items" ON invoice_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
