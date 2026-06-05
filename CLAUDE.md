# OL Prospect Tracker

## Project
CRM and sales pipeline tracker for PBP (Project Business Professional) training prospects.
Multi-tenant app where each "Brand Ambassador" of Oliver F. Lehmann has their own data space.

## Stack
Next.js 14 (App Router), Supabase (PostgreSQL + Auth), deployed on Vercel.

## Brand
Navy/gold theme matching OliverLehmann.com.
Fonts: Source Sans 3 (body), Source Serif 4 (headings).

## Key Features
- Supabase Auth login/register (each Brand Ambassador = separate user)
- Company management with parent-child relationships
- Contacts per company with roles (Decision Maker, Champion, Influencer, etc.)
- Per-contact and per-company activity logging with auto-stage advancement
- PBP Fit Assessment (5 criteria scored 0-3, auto-calculated percentage)
- 6 pipeline stages: Researching, Qualified, Contacted, In Dialogue, Won, Lost
- Message templates with placeholder substitution (German first-contact messages)
- Save locally (JSON download) / Open saved (JSON file import + merge)
- All data scoped by user_id via RLS policies
- Invoicing (`/invoices`): German e-invoices as **ZUGFeRD** (hybrid PDF/A-3 with
  embedded EN 16931 CII XML) plus a **GiroCode (EPC/SEPA) payment QR** on the PDF.
  Reproduces the Oliver F. Lehmann letter layout **bilingually (DE/EN)** from a
  structured "Rechnung" model (Honorar = rate × units, Nebenkosten, MWSt) with
  optional extra free-form lines. Dedicated **customers** list (mirrors the Access
  Kunden table), seller details in an in-app Settings page, an Excel/CSV importer
  for migrating Kunden + Rechnungen, and **email-with-attachments** (invoice PDF +
  hotel/rail/flight receipts) via SMTP. PDF + ZUGFeRD XML are generated server-side
  in `app/api/invoices/{pdf,send}`. Validate generated files against a ZUGFeRD/
  Factur-X conformance checker (e.g. Mustangproject) before production use.

## Database
- `companies` table: user_id, name, hq, country, employees, sector, website, stage, fit_scores (JSONB), pain_points, entry_angle, notes, parent_id
- `contacts` table: user_id, company_id, name, title, department, email, phone, linkedin, role, notes
- `activities` table: user_id, company_id, contact_id (null = company-level), date, text
- `planned_events` table: user_id, company_id, contact_id (null = company-level), event_date, title, description, done
- `templates` table: user_id, name, body, sort_order
- `customers` table (Kunden): user_id, kd_nr, name/name2, street, postal, city, country,
  contact, standard_rate, standard_vat, payment_term, vat_id, active
- `seller_settings` table: user_id (PK), issuer/company + credentials + tax (vat_id,
  tax_number, sap_ariba_anid) + bank (bank_name, account_holder, konto, blz, iban, bic),
  kleinunternehmer flag, default_vat_rate, invoice numbering, logo_url, footer notes
- `invoices` table (Rechnungen): user_id, invoice_number, status, language (de/en),
  dates, currency, optional customer_id/company_id link, buyer snapshot, engagement
  (topic, service_type, venue, billing dates, billing_unit, units, rate), Nebenkosten
  (preparation, travel, other_costs, handouts_*), vat_rate, vat_exempt, payment_term,
  cost_note, paid_date, reminded
- `invoice_items` table: optional extra free-form lines (description, quantity, unit, unit_price)
- RLS enabled: each user only sees their own data
- Schema in `supabase/schema.sql`; invoicing tables in `supabase/invoicing-schema.sql`

## Development
- `npm run dev` to start dev server
- `npm run build` to verify production build
- `npm run lint` to check for errors

## Git Workflow
Always merge the feature branch into main and push both after completing work.
