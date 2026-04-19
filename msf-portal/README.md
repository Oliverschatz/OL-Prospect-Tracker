# MSF — Mission Success First

A partnership portal for Project customers and contractors to find each other, build the Project
Business relationship, and turn project parties into project partners that put completing over
competing.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS

## Getting started

```bash
cd msf-portal
npm install
npm run dev
```

Dev server runs on `http://localhost:3001` (the parent `ol-prospect-tracker` app uses 3000).

## Structure

- `app/page.tsx` — landing page with mission statement and the three pillars
  (Find each other · Build the relationship · Complete over compete)
- `app/customers/page.tsx` — customer profile stubs (owners/programmes seeking partners)
- `app/contractors/page.tsx` — contractor profile stubs (firms seeking partner customers)
- `lib/directory.ts` — in-memory seed data for the stubs (replace with a real data source later)

## Scripts

- `npm run dev` — start dev server on port 3001
- `npm run build` — production build
- `npm run lint` — Next.js ESLint
