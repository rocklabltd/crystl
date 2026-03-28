# Crystl V1 Build Spec

## 1. Product summary

Build **Crystl V1**, a multi workspace **request to quote** web app.

The first live workspace is **Supplement Lab**.

The system must let a business:

1. publish a hosted intake form  
2. receive structured requests from prospects  
3. convert each request into an internal opportunity  
4. clean up the requirement internally  
5. create supplier RFQs  
6. log supplier responses  
7. build customer quotes  
8. track each opportunity through to won or lost

This is **not** a generic CRM.  
It is a **pre sales request and quote workflow system**.

## 2. Tech stack

Build with:

- **Next.js 15+** with App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Supabase** for database, auth, storage
- **Vercel** for hosting
- **Zod** for validation
- **React Hook Form** for forms
- **TanStack Table** for data tables
- **Lucide icons**
- **Server Actions** where sensible
- **Supabase RLS** enabled on all tenant data tables

Use:
- Local
- Preview
- Production environments

## 3. Multi tenant model

The app must be **multi workspace from day one**.

Each workspace has:
- its own users
- its own contacts
- its own form templates
- its own requests
- its own opportunities
- its own quotes
- its own branding defaults

Every tenant data table must include `workspace_id`.

Users may only access rows for workspaces they belong to.  
Enforce this with **Supabase Row Level Security**, not just app logic.

## 4. User roles

Support these roles:

### `owner`
Full workspace access, settings, users, forms, opportunities, quotes.

### `manager`
Can manage opportunities, contacts, RFQs, supplier responses, quotes.

### `sales`
Can manage requests, opportunities, notes, RFQs, quotes.

### `viewer`
Read only access to opportunities and quotes.

Do not overcomplicate permissions in V1.  
Use simple role checks in app code plus workspace scoped RLS.

## 5. Main objects

### Workspace
Business account using Crystl.

### User
Internal team member.

### Contact
Prospect or customer.

### FormTemplate
Hosted intake form config for a workspace.

### FormField
Field definition within a form template.

### Request
Raw inbound submission.

### Opportunity
Internal quote job created from a request.

### StructuredRequirement
Cleaned version of what is being priced.

### SupplierRFQ
Outbound request for pricing to a supplier.

### SupplierResponse
Pricing and commercial response from supplier.

### CustomerQuote
Quote sent to the prospect.

### ActivityLog
Audit trail of actions.

### File
Uploaded files linked to a request or opportunity.

## 6. Database schema

Use Supabase Postgres with SQL migrations.

### `workspaces`
- `id uuid pk`
- `name text not null`
- `slug text unique not null`
- `industry_type text not null default 'general'`
- `brand_name text`
- `default_currency text not null default 'GBP'`
- `quote_prefix text not null default 'Q'`
- `primary_colour text`
- `logo_url text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `workspace_members`
- `id uuid pk`
- `workspace_id uuid fk workspaces.id`
- `user_id uuid fk auth.users.id`
- `role text not null check role in ('owner','manager','sales','viewer')`
- `created_at timestamptz default now()`

### `profiles`
- `id uuid pk references auth.users.id`
- `full_name text`
- `email text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `contacts`
- `id uuid pk`
- `workspace_id uuid fk`
- `first_name text`
- `last_name text`
- `email text`
- `phone text`
- `company_name text`
- `country text`
- `notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `form_templates`
- `id uuid pk`
- `workspace_id uuid fk`
- `name text not null`
- `slug text not null`
- `status text not null default 'active'`
- `headline text`
- `intro_text text`
- `success_message text`
- `submit_button_text text default 'Submit request'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- unique `(workspace_id, slug)`

### `form_fields`
- `id uuid pk`
- `form_template_id uuid fk`
- `field_key text not null`
- `label text not null`
- `field_type text not null`
- `required boolean default false`
- `placeholder text`
- `help_text text`
- `options_json jsonb`
- `conditional_logic_json jsonb`
- `sort_order int not null default 0`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `requests`
- `id uuid pk`
- `workspace_id uuid fk`
- `form_template_id uuid fk`
- `contact_id uuid fk`
- `source text not null default 'website_form'`
- `status text not null default 'submitted'`
- `raw_payload_json jsonb not null`
- `utm_json jsonb`
- `submitted_at timestamptz default now()`
- `created_at timestamptz default now()`

### `opportunities`
- `id uuid pk`
- `workspace_id uuid fk`
- `request_id uuid fk`
- `contact_id uuid fk`
- `ref_code text not null`
- `title text not null`
- `stage text not null`
- `priority text default 'normal'`
- `owner_user_id uuid fk auth.users.id`
- `summary text`
- `internal_notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- `closed_at timestamptz`
- `outcome_reason text`
- unique `(workspace_id, ref_code)`

### `structured_requirements`
- `id uuid pk`
- `opportunity_id uuid unique fk`
- `product_type text`
- `format text`
- `target_benefit text`
- `market text`
- `quantity_units int`
- `pack_size text`
- `packaging_type text`
- `formulation_support_needed boolean`
- `target_positioning text`
- `timeline text`
- `requirement_json jsonb not null default '{}'::jsonb`
- `cleaned_summary text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `supplier_rfqs`
- `id uuid pk`
- `opportunity_id uuid fk`
- `supplier_name text not null`
- `supplier_contact_name text`
- `supplier_email text`
- `rfq_subject text`
- `rfq_body text`
- `status text not null default 'draft'`
- `sent_at timestamptz`
- `created_by_user_id uuid fk auth.users.id`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `supplier_responses`
- `id uuid pk`
- `supplier_rfq_id uuid fk`
- `moq int`
- `unit_price numeric(12,2)`
- `currency text default 'GBP'`
- `tooling_cost numeric(12,2)`
- `formulation_cost numeric(12,2)`
- `lead_time_days int`
- `shipping_notes text`
- `compliance_notes text`
- `response_notes text`
- `raw_response_text text`
- `selected_for_quote boolean default false`
- `received_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `customer_quotes`
- `id uuid pk`
- `opportunity_id uuid fk`
- `quote_number text not null`
- `version_number int not null default 1`
- `title text not null`
- `currency text not null default 'GBP'`
- `unit_price numeric(12,2)`
- `moq int`
- `estimated_lead_time_days int`
- `included_items_json jsonb default '[]'::jsonb`
- `assumptions_json jsonb default '[]'::jsonb`
- `quote_notes text`
- `valid_until date`
- `status text not null default 'draft'`
- `sent_at timestamptz`
- `accepted_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `activity_logs`
- `id uuid pk`
- `workspace_id uuid fk`
- `opportunity_id uuid fk`
- `user_id uuid fk auth.users.id`
- `activity_type text not null`
- `activity_text text not null`
- `metadata_json jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

### `files`
- `id uuid pk`
- `workspace_id uuid fk`
- `opportunity_id uuid fk`
- `request_id uuid fk`
- `storage_path text not null`
- `file_name text not null`
- `mime_type text`
- `file_size bigint`
- `uploaded_by_user_id uuid fk auth.users.id`
- `created_at timestamptz default now()`

## 7. Indexing requirements

Create indexes on:
- all `workspace_id` columns
- `opportunities(stage)`
- `opportunities(owner_user_id)`
- `opportunities(updated_at desc)`
- `requests(submitted_at desc)`
- `contacts(email)`
- `supplier_rfqs(opportunity_id)`
- `supplier_responses(supplier_rfq_id)`
- `customer_quotes(opportunity_id)`

## 8. Stage model

Default stages:
- `new`
- `reviewing`
- `awaiting_info`
- `sent_for_pricing`
- `supplier_response_received`
- `quote_ready`
- `quote_sent`
- `won`
- `lost`

Store as lowercase snake case.

## 9. Supplement Lab template fields

Seed the first workspace with a default form template called:

`Supplement Lab Product Request`

Fields:
1. full_name
2. email
3. phone
4. brand_or_company_name
5. country
6. product_type
7. product_goal
8. formula_direction
9. ingredients_and_dosages
10. target_quantity
11. pack_size
12. packaging_preference
13. budget_positioning
14. target_market
15. launch_timeline
16. needs_formulation_help
17. needs_packaging_label_help
18. extra_notes

Support conditional logic:
- show `ingredients_and_dosages` only if `formula_direction` is `have_formula` or `have_ingredients`

## 10. Required screens

### Public

#### `/w/[workspaceSlug]/f/[formSlug]`
Hosted request form page.

Must include:
- workspace branding
- headline
- intro
- dynamic form renderer
- success state

#### `/w/[workspaceSlug]/f/[formSlug]/success`
Simple success page.

### Authenticated app

#### `/app`
Redirect to dashboard.

#### `/app/dashboard`
Show opportunity overview, counts by stage, recent activity.

#### `/app/opportunities`
List view with filters:
- stage
- owner
- priority
- search by ref code, contact, company

#### `/app/opportunities/[id]`
Main opportunity detail page with tabs:
- Overview
- Raw request
- Structured requirement
- Supplier RFQs
- Supplier responses
- Customer quotes
- Activity

#### `/app/requests`
List raw requests.

#### `/app/contacts`
Contact list and basic detail drawer/page.

#### `/app/forms`
List form templates.

#### `/app/forms/[id]`
Edit form template basics and fields.

#### `/app/settings/workspace`
Workspace settings.

#### `/app/settings/team`
Team member list and roles.

## 11. Opportunity detail behaviour

The opportunity page is the heart of V1.

### Overview tab
Show:
- ref code
- title
- stage
- owner
- priority
- contact card
- key requirement summary
- latest quote summary
- latest supplier response summary

### Raw request tab
Read only rendering of original submission.

### Structured requirement tab
Editable structured form plus free text cleaned summary.

### Supplier RFQs tab
Create, edit, duplicate, mark sent.

### Supplier responses tab
Log one or more supplier responses and mark one as preferred.

### Customer quotes tab
Create quotes from scratch or prefill from preferred supplier response.

### Activity tab
Chronological event log.

## 12. Core workflows

### A. Public form submission
1. Visitor opens hosted form page
2. Completes form
3. Validation runs
4. Contact created or matched by email within workspace
5. Request created with raw payload
6. Opportunity auto created
7. Opportunity ref code auto assigned
8. Activity log added
9. Success page shown

### B. Create supplier RFQ
1. User opens opportunity
2. Clicks “New supplier RFQ”
3. RFQ form prefills from structured requirement
4. User edits supplier details and message
5. Saves draft or marks sent
6. Activity log added

### C. Record supplier response
1. User opens RFQ
2. Adds supplier response
3. Enters MOQ, price, lead time, notes
4. Can mark one response as preferred
5. Activity log added

### D. Build customer quote
1. User clicks “New quote”
2. Form prefills from preferred supplier response if present
3. User edits pricing and wording
4. Saves as draft or marks sent
5. Activity log added

### E. Win/loss
1. User changes stage to won or lost
2. Optional outcome reason required
3. `closed_at` set
4. Activity log added

## 13. Ref code and quote number generation

### Opportunity ref code
Format:
`SL0001`, `SL0002`, etc. for Supplement Lab workspace seed.

### Customer quote number
Format:
`SL-Q-0001-V1`

Include version increments on quote revisions.

## 14. UI requirements

Use a clean SaaS UI, not marketing style.

### Design rules
- Light neutral background
- Clear card layout
- Strong spacing rhythm
- Mobile usable but desktop first for internal admin
- Public form page mobile friendly
- Tables collapse sensibly on smaller screens
- Use badges for stages and statuses
- Keep forms clean and not overly dense

## 15. Validation rules

Use **Zod** schemas for:
- public form payload
- contact create/update
- structured requirement update
- supplier RFQ create/update
- supplier response create/update
- customer quote create/update
- workspace settings update

Server validate everything again even if client validation exists.

## 16. Auth and security requirements

Use Supabase Auth with email and password for V1.

Requirements:
- unauthenticated users can access hosted forms only
- authenticated users can access only their workspace data
- RLS enabled on every tenant table
- service role key must never be exposed in client bundle
- sensitive env vars must be loaded from environment variables

## 17. Storage

Use Supabase Storage for request and opportunity files.

Buckets:
- `workspace-files`

Rules:
- max file size configurable in app
- allow common document/image formats
- filenames normalised
- store metadata in `files` table
- uploaded files linked to either `request_id` or `opportunity_id`

## 18. Seed data

Seed:
- one workspace: `Supplement Lab`
- one owner user placeholder or setup flow
- one form template
- all default Supplement Lab fields
- one or two demo opportunities for local dev

## 19. Environment variables

Expected env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG`
- `APP_ENV`

Document them in `.env.example`.

## 20. Project structure

```txt
/app
  /(public)
    /w/[workspaceSlug]/f/[formSlug]/page.tsx
    /w/[workspaceSlug]/f/[formSlug]/success/page.tsx
  /(auth)
    /login/page.tsx
    /signup/page.tsx
  /(app)
    /app/layout.tsx
    /app/dashboard/page.tsx
    /app/opportunities/page.tsx
    /app/opportunities/[id]/page.tsx
    /app/requests/page.tsx
    /app/contacts/page.tsx
    /app/forms/page.tsx
    /app/forms/[id]/page.tsx
    /app/settings/workspace/page.tsx
    /app/settings/team/page.tsx

/components
  /ui
  /forms
  /opportunities
  /quotes
  /rfqs
  /layout

/lib
  /supabase
  /auth
  /db
  /validators
  /helpers
  /formatters

/actions
  /requests
  /opportunities
  /rfqs
  /quotes
  /settings

/types

/supabase
  /migrations
  /seed.sql

/docs
  build-notes.md
  data-model.md
  routes.md
```

## 21. Acceptance criteria

The MVP is complete when:

1. a public user can submit a hosted Supplement Lab request form  
2. a contact is created or matched  
3. a request is stored with raw payload  
4. an opportunity is auto created with ref code  
5. internal user can view and edit structured requirement  
6. internal user can create supplier RFQs  
7. internal user can log supplier responses  
8. internal user can create customer quotes  
9. internal user can move opportunity through all default stages  
10. all tenant data is workspace scoped and protected by RLS  
11. app deploys successfully to Vercel  
12. app runs against Supabase in local and production environments

## 22. Nice to have, but not in scope for V1

- drag and drop form builder
- email sending
- AI requirement summarisation
- AI quote drafting
- embedded widget script
- customer portal
- PDF quote export
- analytics dashboard
- kanban board
- supplier portal

## 23. Codex execution prompt

```txt
Build Crystl V1 as a production ready multi workspace request to quote app using Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase Auth, Supabase Postgres, and Supabase Storage.

First live workspace is Supplement Lab.

Core workflow:
1. Public user opens hosted request form
2. Submits structured request
3. System creates or matches contact
4. System stores raw request
5. System auto creates opportunity with ref code
6. Internal user reviews opportunity
7. Internal user edits structured requirement
8. Internal user creates supplier RFQs
9. Internal user logs supplier responses
10. Internal user creates customer quotes
11. Internal user tracks stage to won or lost

Requirements:
- Multi tenant from day one using workspace_id on tenant data
- Supabase RLS on all tenant tables
- Clean modular TypeScript code
- Zod validation for all payloads
- Hosted public form route
- Authenticated app with opportunities, requests, contacts, forms, and settings screens
- Seed Supplement Lab workspace and form template
- Add AGENTS.md and clear docs
- Use SQL migrations for schema
- Create .env.example
- Use sensible shadcn/ui components
- Keep V1 focused, no generic CRM extras and no AI features yet

Deliver:
- complete codebase
- SQL migrations
- seed data
- route structure
- reusable components
- README with setup steps
- AGENTS.md
```
