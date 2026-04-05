# OL Prospect Tracker

## Project
CRM and sales pipeline tracker for PBP (Project Business Professional) training prospects.
Migrated from a single-page HTML/localStorage app to Next.js + Supabase for multi-device access.

## Stack
Next.js 14 (App Router), Supabase (PostgreSQL), Tailwind CSS, XLSX export, deployed on Vercel.

## Brand
Navy/gold theme matching OliverLehmann.com.
Fonts: Source Sans 3 (body), Source Serif 4 (headings).

## Key Features
- Company management with parent-child relationships
- Contacts per company with roles (Decision Maker, Champion, Influencer, etc.)
- Per-contact and per-company activity logging with auto-stage advancement
- PBP Fit Assessment (5 criteria scored 0-3, auto-calculated percentage)
- 6 pipeline stages: Researching, Qualified, Contacted, In Dialogue, Won, Lost
- Message templates with placeholder substitution (German first-contact messages)
- JSON import from Claude (paste JSON to add/merge companies)
- XLSX import/export
- Password-protected access (SHA-256 hash in env var)

## Database
- `companies` table: name, hq, country, employees, sector, website, stage, fit_scores (JSONB), pain_points, entry_angle, notes, next_action, follow_up_date, parent_id
- `contacts` table: company_id, name, title, department, email, phone, linkedin, role, notes
- `activities` table: company_id, contact_id (null = company-level), date, text
- `templates` table: name, body, sort_order
- Schema in `supabase/schema.sql`

## Development
- `npm run dev` to start dev server
- `npm run build` to verify production build
- `npm run lint` to check for errors

## Git Workflow
Always merge the feature branch into main and push both after completing work.
