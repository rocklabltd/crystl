# Crystl V1 SQL Setup

## Files in this folder

- `supabase/migrations/0001_crystl_v1_initial.sql`
- `supabase/seed.sql`

## What they do

### Migration
Creates the full Crystl V1 database foundation:
- multi workspace tables
- profiles and workspace membership
- contacts, requests, opportunities
- structured requirements
- supplier RFQs and supplier responses
- customer quotes
- activity logs
- file records
- helper functions
- updated_at triggers
- ref code generation
- request to opportunity auto creation trigger
- storage bucket and policies
- row level security policies

### Seed
Creates:
- Supplement Lab workspace
- hosted form template
- default Supplement Lab form fields
- one demo contact
- one demo request
- one demo opportunity
- one demo RFQ
- one demo supplier response
- one demo customer quote

## Recommended local setup

1. Start Supabase locally
2. Apply migrations
3. Run the seed
4. Create your first auth user manually
5. Insert a row into `workspace_members` linking that user to the seeded Supplement Lab workspace as `owner`

## Notes for Codex

- Public request submission should normally use server-side logic to call `handle_contact_upsert(...)`, then insert into `requests`
- The `requests` insert trigger automatically creates the opportunity and structured requirement
- `generate_workspace_ref_code(...)` currently uses a global sequence and workspace prefix
- For production, quote number generation should be handled in app logic or a dedicated DB function
- Storage policies assume a matching row exists in `public.files` for the uploaded object path

## Suggested first implementation order

1. auth and workspace membership bootstrap
2. public form submission flow
3. opportunities list and detail
4. RFQ and supplier response flows
5. quote builder
6. file uploads
