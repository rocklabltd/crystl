-- Crystl V1 initial schema
-- Safe for Codex / Supabase local development
-- Assumes auth schema exists

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry_type text not null default 'general',
  brand_name text,
  default_currency text not null default 'GBP',
  quote_prefix text not null default 'Q',
  primary_colour text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','sales','viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('draft','active','archived')),
  headline text,
  intro_text text,
  success_message text,
  submit_button_text text default 'Submit request',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references public.form_templates(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null,
  required boolean not null default false,
  placeholder text,
  help_text text,
  options_json jsonb,
  conditional_logic_json jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  form_template_id uuid references public.form_templates(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  source text not null default 'website_form',
  status text not null default 'submitted',
  raw_payload_json jsonb not null,
  utm_json jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  ref_code text not null,
  title text not null,
  stage text not null check (stage in (
    'new',
    'reviewing',
    'awaiting_info',
    'sent_for_pricing',
    'supplier_response_received',
    'quote_ready',
    'quote_sent',
    'won',
    'lost'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  owner_user_id uuid references auth.users(id) on delete set null,
  summary text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  outcome_reason text,
  unique (workspace_id, ref_code)
);

create table if not exists public.structured_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  product_type text,
  format text,
  target_benefit text,
  market text,
  quantity_units integer,
  pack_size text,
  packaging_type text,
  formulation_support_needed boolean,
  target_positioning text,
  timeline text,
  requirement_json jsonb not null default '{}'::jsonb,
  cleaned_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_rfqs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  supplier_name text not null,
  supplier_contact_name text,
  supplier_email text,
  rfq_subject text,
  rfq_body text,
  status text not null default 'draft' check (status in ('draft','sent','replied','closed')),
  sent_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_responses (
  id uuid primary key default gen_random_uuid(),
  supplier_rfq_id uuid not null references public.supplier_rfqs(id) on delete cascade,
  moq integer,
  unit_price numeric(12,2),
  currency text not null default 'GBP',
  tooling_cost numeric(12,2),
  formulation_cost numeric(12,2),
  lead_time_days integer,
  shipping_notes text,
  compliance_notes text,
  response_notes text,
  raw_response_text text,
  selected_for_quote boolean not null default false,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_quotes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  quote_number text not null,
  version_number integer not null default 1,
  title text not null,
  currency text not null default 'GBP',
  unit_price numeric(12,2),
  moq integer,
  estimated_lead_time_days integer,
  included_items_json jsonb not null default '[]'::jsonb,
  assumptions_json jsonb not null default '[]'::jsonb,
  quote_notes text,
  valid_until date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  activity_text text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.get_my_workspace_ids()
returns setof uuid
language sql
stable
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid()
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  )
$$;

create or replace function public.is_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  )
$$;

create sequence if not exists public.workspace_ref_sequence start 1;

create or replace function public.generate_workspace_ref_code(target_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_prefix text;
  next_num bigint;
begin
  select coalesce(quote_prefix, 'Q')
  into workspace_prefix
  from public.workspaces
  where id = target_workspace_id;

  if workspace_prefix is null then
    raise exception 'Workspace not found for ref code generation';
  end if;

  next_num := nextval('public.workspace_ref_sequence');

  return workspace_prefix || lpad(next_num::text, 4, '0');
end;
$$;

create or replace function public.touch_activity_log(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_user_id uuid,
  p_activity_type text,
  p_activity_text text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (
    workspace_id,
    opportunity_id,
    user_id,
    activity_type,
    activity_text,
    metadata_json
  ) values (
    p_workspace_id,
    p_opportunity_id,
    p_user_id,
    p_activity_type,
    p_activity_text,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.handle_request_opportunity_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_ref text;
  generated_title text;
  new_opp_id uuid;
begin
  generated_ref := public.generate_workspace_ref_code(new.workspace_id);
  generated_title := coalesce(
    new.raw_payload_json ->> 'product_type',
    new.raw_payload_json ->> 'product_goal',
    'New Request'
  );

  insert into public.opportunities (
    workspace_id,
    request_id,
    contact_id,
    ref_code,
    title,
    stage,
    priority,
    summary
  ) values (
    new.workspace_id,
    new.id,
    new.contact_id,
    generated_ref,
    generated_title,
    'new',
    'normal',
    'Opportunity created automatically from public request'
  )
  returning id into new_opp_id;

  insert into public.structured_requirements (
    opportunity_id,
    product_type,
    target_benefit,
    quantity_units,
    market,
    formulation_support_needed,
    target_positioning,
    timeline,
    requirement_json,
    cleaned_summary
  ) values (
    new_opp_id,
    new.raw_payload_json ->> 'product_type',
    new.raw_payload_json ->> 'product_goal',
    nullif(new.raw_payload_json ->> 'target_quantity', '')::integer,
    new.raw_payload_json ->> 'target_market',
    case
      when lower(coalesce(new.raw_payload_json ->> 'needs_formulation_help', 'false')) in ('true', 'yes', '1') then true
      else false
    end,
    new.raw_payload_json ->> 'budget_positioning',
    new.raw_payload_json ->> 'launch_timeline',
    new.raw_payload_json,
    'Auto-created from public request. Review and refine before sending for pricing.'
  );

  perform public.touch_activity_log(
    new.workspace_id,
    new_opp_id,
    auth.uid(),
    'request_created',
    'Request submitted and opportunity auto-created',
    jsonb_build_object('request_id', new.id, 'ref_code', generated_ref)
  );

  return new;
end;
$$;

create or replace function public.handle_contact_upsert(
  p_workspace_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_company_name text,
  p_country text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_contact_id uuid;
  new_contact_id uuid;
begin
  if p_email is not null and length(trim(p_email)) > 0 then
    select c.id
    into existing_contact_id
    from public.contacts c
    where c.workspace_id = p_workspace_id
      and lower(c.email) = lower(trim(p_email))
    limit 1;

    if existing_contact_id is not null then
      update public.contacts
      set
        first_name = coalesce(nullif(p_first_name, ''), first_name),
        last_name = coalesce(nullif(p_last_name, ''), last_name),
        phone = coalesce(nullif(p_phone, ''), phone),
        company_name = coalesce(nullif(p_company_name, ''), company_name),
        country = coalesce(nullif(p_country, ''), country),
        updated_at = now()
      where id = existing_contact_id;

      return existing_contact_id;
    end if;
  end if;

  insert into public.contacts (
    workspace_id,
    first_name,
    last_name,
    email,
    phone,
    company_name,
    country
  ) values (
    p_workspace_id,
    nullif(p_first_name, ''),
    nullif(p_last_name, ''),
    nullif(p_email, ''),
    nullif(p_phone, ''),
    nullif(p_company_name, ''),
    nullif(p_country, '')
  ) returning id into new_contact_id;

  return new_contact_id;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_form_templates_updated_at on public.form_templates;
create trigger trg_form_templates_updated_at
before update on public.form_templates
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_form_fields_updated_at on public.form_fields;
create trigger trg_form_fields_updated_at
before update on public.form_fields
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_opportunities_updated_at on public.opportunities;
create trigger trg_opportunities_updated_at
before update on public.opportunities
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_structured_requirements_updated_at on public.structured_requirements;
create trigger trg_structured_requirements_updated_at
before update on public.structured_requirements
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_supplier_rfqs_updated_at on public.supplier_rfqs;
create trigger trg_supplier_rfqs_updated_at
before update on public.supplier_rfqs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_supplier_responses_updated_at on public.supplier_responses;
create trigger trg_supplier_responses_updated_at
before update on public.supplier_responses
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_customer_quotes_updated_at on public.customer_quotes;
create trigger trg_customer_quotes_updated_at
before update on public.customer_quotes
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_requests_create_opportunity on public.requests;
create trigger trg_requests_create_opportunity
after insert on public.requests
for each row execute procedure public.handle_request_opportunity_creation();

create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_contacts_workspace_id on public.contacts(workspace_id);
create index if not exists idx_contacts_workspace_email on public.contacts(workspace_id, lower(email));
create index if not exists idx_form_templates_workspace_id on public.form_templates(workspace_id);
create index if not exists idx_form_fields_template_id on public.form_fields(form_template_id);
create index if not exists idx_requests_workspace_id on public.requests(workspace_id);
create index if not exists idx_requests_submitted_at on public.requests(submitted_at desc);
create index if not exists idx_opportunities_workspace_id on public.opportunities(workspace_id);
create index if not exists idx_opportunities_stage on public.opportunities(stage);
create index if not exists idx_opportunities_owner_user_id on public.opportunities(owner_user_id);
create index if not exists idx_opportunities_updated_at on public.opportunities(updated_at desc);
create index if not exists idx_structured_requirements_opportunity_id on public.structured_requirements(opportunity_id);
create index if not exists idx_supplier_rfqs_opportunity_id on public.supplier_rfqs(opportunity_id);
create index if not exists idx_supplier_responses_supplier_rfq_id on public.supplier_responses(supplier_rfq_id);
create index if not exists idx_customer_quotes_opportunity_id on public.customer_quotes(opportunity_id);
create index if not exists idx_activity_logs_workspace_id on public.activity_logs(workspace_id);
create index if not exists idx_activity_logs_opportunity_id on public.activity_logs(opportunity_id);
create index if not exists idx_files_workspace_id on public.files(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.form_templates enable row level security;
alter table public.form_fields enable row level security;
alter table public.requests enable row level security;
alter table public.opportunities enable row level security;
alter table public.structured_requirements enable row level security;
alter table public.supplier_rfqs enable row level security;
alter table public.supplier_responses enable row level security;
alter table public.customer_quotes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.files enable row level security;

drop policy if exists "profiles_select_own_or_workspace_member" on public.profiles;
create policy "profiles_select_own_or_workspace_member"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm_self
    join public.workspace_members wm_target
      on wm_self.workspace_id = wm_target.workspace_id
    where wm_self.user_id = auth.uid()
      and wm_target.user_id = profiles.id
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner"
on public.workspaces
for update
to authenticated
using (public.is_workspace_role(id, array['owner']))
with check (public.is_workspace_role(id, array['owner']));

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_manage_owner" on public.workspace_members;
create policy "workspace_members_manage_owner"
on public.workspace_members
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner']))
with check (public.is_workspace_role(workspace_id, array['owner']));

drop policy if exists "contacts_select_member" on public.contacts;
create policy "contacts_select_member"
on public.contacts
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "contacts_modify_sales_up" on public.contacts;
create policy "contacts_modify_sales_up"
on public.contacts
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner','manager','sales']))
with check (public.is_workspace_role(workspace_id, array['owner','manager','sales']));

drop policy if exists "form_templates_select_member" on public.form_templates;
create policy "form_templates_select_member"
on public.form_templates
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "form_templates_modify_manager_up" on public.form_templates;
create policy "form_templates_modify_manager_up"
on public.form_templates
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner','manager']))
with check (public.is_workspace_role(workspace_id, array['owner','manager']));

drop policy if exists "form_fields_select_member" on public.form_fields;
create policy "form_fields_select_member"
on public.form_fields
for select
to authenticated
using (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_fields.form_template_id
      and public.is_workspace_member(ft.workspace_id)
  )
);

drop policy if exists "form_fields_modify_manager_up" on public.form_fields;
create policy "form_fields_modify_manager_up"
on public.form_fields
for all
to authenticated
using (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_fields.form_template_id
      and public.is_workspace_role(ft.workspace_id, array['owner','manager'])
  )
)
with check (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_fields.form_template_id
      and public.is_workspace_role(ft.workspace_id, array['owner','manager'])
  )
);

drop policy if exists "requests_select_member" on public.requests;
create policy "requests_select_member"
on public.requests
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "requests_modify_sales_up" on public.requests;
create policy "requests_modify_sales_up"
on public.requests
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner','manager','sales']))
with check (public.is_workspace_role(workspace_id, array['owner','manager','sales']));

drop policy if exists "opportunities_select_member" on public.opportunities;
create policy "opportunities_select_member"
on public.opportunities
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "opportunities_modify_sales_up" on public.opportunities;
create policy "opportunities_modify_sales_up"
on public.opportunities
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner','manager','sales']))
with check (public.is_workspace_role(workspace_id, array['owner','manager','sales']));

drop policy if exists "structured_requirements_select_member" on public.structured_requirements;
create policy "structured_requirements_select_member"
on public.structured_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = structured_requirements.opportunity_id
      and public.is_workspace_member(o.workspace_id)
  )
);

drop policy if exists "structured_requirements_modify_sales_up" on public.structured_requirements;
create policy "structured_requirements_modify_sales_up"
on public.structured_requirements
for all
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = structured_requirements.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
)
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = structured_requirements.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
);

drop policy if exists "supplier_rfqs_select_member" on public.supplier_rfqs;
create policy "supplier_rfqs_select_member"
on public.supplier_rfqs
for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = supplier_rfqs.opportunity_id
      and public.is_workspace_member(o.workspace_id)
  )
);

drop policy if exists "supplier_rfqs_modify_sales_up" on public.supplier_rfqs;
create policy "supplier_rfqs_modify_sales_up"
on public.supplier_rfqs
for all
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = supplier_rfqs.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
)
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = supplier_rfqs.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
);

drop policy if exists "supplier_responses_select_member" on public.supplier_responses;
create policy "supplier_responses_select_member"
on public.supplier_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.supplier_rfqs sr
    join public.opportunities o on o.id = sr.opportunity_id
    where sr.id = supplier_responses.supplier_rfq_id
      and public.is_workspace_member(o.workspace_id)
  )
);

drop policy if exists "supplier_responses_modify_sales_up" on public.supplier_responses;
create policy "supplier_responses_modify_sales_up"
on public.supplier_responses
for all
to authenticated
using (
  exists (
    select 1
    from public.supplier_rfqs sr
    join public.opportunities o on o.id = sr.opportunity_id
    where sr.id = supplier_responses.supplier_rfq_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
)
with check (
  exists (
    select 1
    from public.supplier_rfqs sr
    join public.opportunities o on o.id = sr.opportunity_id
    where sr.id = supplier_responses.supplier_rfq_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
);

drop policy if exists "customer_quotes_select_member" on public.customer_quotes;
create policy "customer_quotes_select_member"
on public.customer_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = customer_quotes.opportunity_id
      and public.is_workspace_member(o.workspace_id)
  )
);

drop policy if exists "customer_quotes_modify_sales_up" on public.customer_quotes;
create policy "customer_quotes_modify_sales_up"
on public.customer_quotes
for all
to authenticated
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = customer_quotes.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
)
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = customer_quotes.opportunity_id
      and public.is_workspace_role(o.workspace_id, array['owner','manager','sales'])
  )
);

drop policy if exists "activity_logs_select_member" on public.activity_logs;
create policy "activity_logs_select_member"
on public.activity_logs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "activity_logs_insert_sales_up" on public.activity_logs;
create policy "activity_logs_insert_sales_up"
on public.activity_logs
for insert
to authenticated
with check (public.is_workspace_role(workspace_id, array['owner','manager','sales']));

drop policy if exists "files_select_member" on public.files;
create policy "files_select_member"
on public.files
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "files_modify_sales_up" on public.files;
create policy "files_modify_sales_up"
on public.files
for all
to authenticated
using (public.is_workspace_role(workspace_id, array['owner','manager','sales']))
with check (public.is_workspace_role(workspace_id, array['owner','manager','sales']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-files',
  'workspace-files',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists "workspace_files_select_member" on storage.objects;
create policy "workspace_files_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and exists (
    select 1
    from public.files f
    where f.storage_path = storage.objects.name
      and public.is_workspace_member(f.workspace_id)
  )
);

drop policy if exists "workspace_files_insert_sales_up" on storage.objects;
create policy "workspace_files_insert_sales_up"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
);

drop policy if exists "workspace_files_update_sales_up" on storage.objects;
create policy "workspace_files_update_sales_up"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'workspace-files'
  and exists (
    select 1
    from public.files f
    where f.storage_path = storage.objects.name
      and public.is_workspace_role(f.workspace_id, array['owner','manager','sales'])
  )
)
with check (
  bucket_id = 'workspace-files'
);

drop policy if exists "workspace_files_delete_sales_up" on storage.objects;
create policy "workspace_files_delete_sales_up"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and exists (
    select 1
    from public.files f
    where f.storage_path = storage.objects.name
      and public.is_workspace_role(f.workspace_id, array['owner','manager','sales'])
  )
);

commit;
