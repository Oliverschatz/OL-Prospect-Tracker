# OL Prospect Tracker

## Project
CRM and sales pipeline tracker for managing prospects, deals, and activities.

## Stack
Next.js 14 (App Router), Supabase, Tailwind CSS, deployed on Vercel.

## Brand
Primary color: #2563EB (blue)

## Key Features
- Dashboard with pipeline overview and summary stats
- Prospect management (add, view, edit stage, delete)
- Pipeline board with Kanban-style columns
- Activity feed per prospect (calls, emails, meetings, notes, tasks)
- 7 pipeline stages: Lead, Contacted, Qualified, Proposal, Negotiation, Closed Won, Closed Lost

## Database
- `prospects` table: company_name, contact_name, contact_email, contact_phone, stage, deal_value, notes, source
- `activities` table: prospect_id, type, description
- Schema in `supabase/schema.sql`

## Development
- `npm run dev` to start dev server
- `npm run build` to verify production build
- `npm run lint` to check for errors

## Git Workflow
Always merge the feature branch into main and push both after completing work.
