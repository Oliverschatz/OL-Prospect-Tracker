-- OL Prospect Tracker — Invoicing module
-- Customers, seller settings, invoices and (optional) extra line items.
-- Mirrors the legacy MS Access "Kunden" / "Rechnungen" model, scoped per user
-- via user_id (Supabase Auth) with RLS, like the rest of the app.
-- Supports German e-invoicing (ZUGFeRD / EN 16931) and SEPA GiroCode payment QR.

-- ─── Customers (mirror of the Access "Kunden" table) ───
CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kd_nr          TEXT NOT NULL DEFAULT '',         -- Kd-Nr
  name           TEXT NOT NULL DEFAULT '',         -- Kunde
  name2          TEXT NOT NULL DEFAULT '',         -- Kunde 2
  street         TEXT NOT NULL DEFAULT '',         -- Straße
  postal         TEXT NOT NULL DEFAULT '',         -- PLZ
  city           TEXT NOT NULL DEFAULT '',         -- Ort
  country        TEXT NOT NULL DEFAULT 'Deutschland', -- Land
  hf             TEXT NOT NULL DEFAULT '',         -- HF
  contact        TEXT NOT NULL DEFAULT '',         -- zuständig
  first_name     TEXT NOT NULL DEFAULT '',         -- Vorname
  email          TEXT NOT NULL DEFAULT '',
  active         BOOLEAN NOT NULL DEFAULT true,    -- Aktiv
  standard_rate  NUMERIC NOT NULL DEFAULT 0,       -- Standardsatz (Euro)
  standard_vat   NUMERIC NOT NULL DEFAULT 19,      -- Standard-MWSt
  payment_term   TEXT NOT NULL DEFAULT '',         -- besonderes Zahlungsziel
  vat_id         TEXT NOT NULL DEFAULT '',         -- USt-IdNr (for reverse charge / EU)
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Seller settings (one row per user = the invoice issuer) ───
CREATE TABLE IF NOT EXISTS seller_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL DEFAULT '',
  contact_name      TEXT NOT NULL DEFAULT '',
  credentials       TEXT NOT NULL DEFAULT '',            -- e.g. "M.Sc., PMP"
  address_line      TEXT NOT NULL DEFAULT '',
  postal_code       TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT 'DE',
  email             TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  mobile            TEXT NOT NULL DEFAULT '',
  website           TEXT NOT NULL DEFAULT '',
  vat_id            TEXT NOT NULL DEFAULT '',            -- USt-IdNr
  tax_number        TEXT NOT NULL DEFAULT '',            -- Steuer-Nr
  sap_ariba_anid    TEXT NOT NULL DEFAULT '',            -- SAP Ariba ANID
  bank_name         TEXT NOT NULL DEFAULT '',
  account_holder    TEXT NOT NULL DEFAULT '',
  bank_account_no   TEXT NOT NULL DEFAULT '',            -- Konto
  blz               TEXT NOT NULL DEFAULT '',            -- BLZ
  iban              TEXT NOT NULL DEFAULT '',
  bic               TEXT NOT NULL DEFAULT '',
  kleinunternehmer  BOOLEAN NOT NULL DEFAULT false,      -- §19 UStG
  default_vat_rate  NUMERIC NOT NULL DEFAULT 19,
  payment_terms_days INT NOT NULL DEFAULT 14,
  invoice_prefix    TEXT NOT NULL DEFAULT '',
  next_invoice_seq  INT NOT NULL DEFAULT 1,
  logo_url          TEXT NOT NULL DEFAULT '',
  footer_notes      TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Invoices (mirror of the Access "Rechnungen" table) ───
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  language        TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  currency        TEXT NOT NULL DEFAULT 'EUR',

  -- Links: a dedicated customer and/or a CRM company (optional)
  customer_id     TEXT REFERENCES customers(id) ON DELETE SET NULL,
  company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,

  -- Buyer snapshot (kept on the invoice so history stays correct)
  buyer_name      TEXT NOT NULL DEFAULT '',
  buyer_name2     TEXT NOT NULL DEFAULT '',
  buyer_street    TEXT NOT NULL DEFAULT '',
  buyer_postal    TEXT NOT NULL DEFAULT '',
  buyer_city      TEXT NOT NULL DEFAULT '',
  buyer_country   TEXT NOT NULL DEFAULT 'Deutschland',
  buyer_contact   TEXT NOT NULL DEFAULT '',
  buyer_vat_id    TEXT NOT NULL DEFAULT '',
  buyer_email     TEXT NOT NULL DEFAULT '',
  buyer_reference TEXT NOT NULL DEFAULT '',               -- Leitweg-ID / order ref (B2G)

  -- Engagement (Honorar = rate × units)
  topic           TEXT NOT NULL DEFAULT '',               -- Thema
  service_type    TEXT NOT NULL DEFAULT '',               -- Auftragsart
  venue           TEXT NOT NULL DEFAULT '',               -- Einsatzort
  billing_start   DATE,                                   -- Abr-Beginn
  billing_end     DATE,                                   -- Abr-Ende
  billing_unit    TEXT NOT NULL DEFAULT 'Tage',           -- Abr-Einheit
  units           NUMERIC NOT NULL DEFAULT 1,             -- Einheiten
  rate            NUMERIC NOT NULL DEFAULT 0,             -- Abr-Satz

  -- Nebenkosten (additional costs)
  preparation     NUMERIC NOT NULL DEFAULT 0,             -- Vorbereitung
  travel          NUMERIC NOT NULL DEFAULT 0,             -- Anfahrt / Reisekosten
  other_costs     NUMERIC NOT NULL DEFAULT 0,             -- sonstige
  handouts_qty    NUMERIC NOT NULL DEFAULT 0,             -- Unterlagen, Stückzahl
  handouts_unit_price NUMERIC NOT NULL DEFAULT 0,         -- Unterlagen, Einzelpreis
  handouts_flat   NUMERIC NOT NULL DEFAULT 0,             -- Unterlagen, pauschal

  -- VAT + payment
  vat_rate        NUMERIC NOT NULL DEFAULT 19,            -- MWSt
  vat_exempt      BOOLEAN NOT NULL DEFAULT false,         -- MWST befreit
  vat_exempt_reason TEXT NOT NULL DEFAULT '',
  payment_term    TEXT NOT NULL DEFAULT '',               -- Zahlungsziel

  intro_text      TEXT NOT NULL DEFAULT '',
  closing_text    TEXT NOT NULL DEFAULT '',
  cost_note       TEXT NOT NULL DEFAULT '',               -- free-text box (e.g. "Reisekosten: …")
  paid_date       DATE,                                   -- Bezahlt
  reminded        BOOLEAN NOT NULL DEFAULT false,         -- Gemahnt

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Optional extra free-form line items ───
CREATE TABLE IF NOT EXISTS invoice_items (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position      INT NOT NULL DEFAULT 0,
  description   TEXT NOT NULL DEFAULT '',
  quantity      NUMERIC NOT NULL DEFAULT 1,
  unit          TEXT NOT NULL DEFAULT 'C62',
  unit_price    NUMERIC NOT NULL DEFAULT 0
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_user_id ON invoice_items(user_id);

-- ─── RLS ───
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own customers" ON customers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users see own seller_settings" ON seller_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users see own invoices" ON invoices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users see own invoice_items" ON invoice_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
