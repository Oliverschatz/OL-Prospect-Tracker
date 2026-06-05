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
  Per-line VAT category (standard / reverse-charge / intra-community / export / §19
  Kleinunternehmer / zero), buyers linked to a CRM company or entered ad-hoc, seller
  details in an in-app Settings page, and an Excel/CSV importer for migrating old
  MS Access data. Validate generated files against a ZUGFeRD/Factur-X conformance
  checker (e.g. Mustangproject) before production use.

## Database
- `companies` table: user_id, name, hq, country, employees, sector, website, stage, fit_scores (JSONB), pain_points, entry_angle, notes, parent_id
- `contacts` table: user_id, company_id, name, title, department, email, phone, linkedin, role, notes
- `activities` table: user_id, company_id, contact_id (null = company-level), date, text
- `planned_events` table: user_id, company_id, contact_id (null = company-level), event_date, title, description, done
- `templates` table: user_id, name, body, sort_order
- `seller_settings` table: user_id (PK), issuer/company + tax (vat_id, tax_number) + bank
  (iban, bic), kleinunternehmer flag, default_vat_rate, invoice numbering, footer notes
- `invoices` table: user_id, invoice_number, status, dates, currency, optional company_id/
  contact_id link, buyer snapshot fields, intro/notes/payment terms
- `invoice_items` table: user_id, invoice_id, position, description, quantity, unit
  (UN/ECE code), unit_price, vat_rate, vat_category (EN 16931: S/AE/Z/E/K/G/O)
- RLS enabled: each user only sees their own data
- Schema in `supabase/schema.sql`; invoicing tables in `supabase/invoicing-schema.sql`

## Development
- `npm run dev` to start dev server
- `npm run build` to verify production build
- `npm run lint` to check for errors

## Git Workflow
Always merge the feature branch into main and push both after completing work.
