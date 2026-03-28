# Crystl V1

Crystl V1 is a multi-workspace request-to-quote app built with Next.js, TypeScript, Tailwind, and Supabase.

The first live workspace is `Supplement Lab`.

## What it does

- Publishes a hosted intake form
- Creates or matches contacts from form submissions
- Stores raw requests and auto-creates opportunities
- Lets internal users manage structured requirements, supplier RFQs, supplier responses, customer quotes, files, and stage progression
- Enforces workspace-scoped access with Supabase RLS

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Zod validation
- Server Actions for mutations

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your Supabase values:

```bash
cp .env.example .env.local
```

3. Make sure your environment includes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG`
- `APP_ENV`

4. Apply the Supabase migration and seed data using your preferred local workflow.

Important files:
- schema and policies: `supabase/migrations/0001_crystl_v1_initial.sql`
- seed data: `supabase/seed.sql`

5. Start the dev server:

```bash
npm run dev
```

6. Open `http://localhost:3000`

## Main routes

Public:
- `/w/supplement-lab/f/product-request`
- `/w/supplement-lab/f/product-request/success`
- `/login`
- `/signup`

Authenticated:
- `/app/dashboard`
- `/app/opportunities`
- `/app/requests`
- `/app/contacts`
- `/app/forms`
- `/app/settings/workspace`
- `/app/settings/team`

## Notes

- The public form uses server-side Supabase only.
- Opportunity detail includes RFQ, supplier response, quote, file upload, and workflow management.
- Uploaded files are stored in the `workspace-files` bucket and tracked in the `files` table.
- Seed data creates the `Supplement Lab` workspace, hosted form, and demo workflow records.

## Current gaps

Still not fully built:
- public file attachments on the hosted form
- invite/new-member flow
- richer form builder controls
- PDF/export and email flows
