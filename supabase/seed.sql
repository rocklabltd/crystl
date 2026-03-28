-- Crystl V1 seed data
-- Creates Supplement Lab workspace, default form, form fields, and sample demo data
-- Safe to rerun in local environments because inserts are guarded where possible

begin;

do $$
declare
  ws_id uuid;
  ft_id uuid;
  demo_contact_id uuid;
  demo_request_id uuid;
  demo_opportunity_id uuid;
  demo_rfq_id uuid;
begin
  insert into public.workspaces (
    name,
    slug,
    industry_type,
    brand_name,
    default_currency,
    quote_prefix,
    primary_colour
  )
  values (
    'Supplement Lab',
    'supplement-lab',
    'supplement_manufacturing',
    'Supplement Lab',
    'GBP',
    'SL',
    '#171717'
  )
  on conflict (slug) do update
    set brand_name = excluded.brand_name,
        default_currency = excluded.default_currency,
        quote_prefix = excluded.quote_prefix,
        primary_colour = excluded.primary_colour,
        updated_at = now()
  returning id into ws_id;

  insert into public.form_templates (
    workspace_id,
    name,
    slug,
    status,
    headline,
    intro_text,
    success_message,
    submit_button_text
  )
  values (
    ws_id,
    'Supplement Lab Product Request',
    'product-request',
    'active',
    'Tell us what you want to create',
    'Give us the key details of your product idea and we will review your brief and come back with the best next step for formulation and manufacturing.',
    'Thanks, your request has been received. We will review it and come back to you shortly.',
    'Submit request'
  )
  on conflict (workspace_id, slug) do update
    set name = excluded.name,
        status = excluded.status,
        headline = excluded.headline,
        intro_text = excluded.intro_text,
        success_message = excluded.success_message,
        submit_button_text = excluded.submit_button_text,
        updated_at = now()
  returning id into ft_id;

  delete from public.form_fields where form_template_id = ft_id;

  insert into public.form_fields (
    form_template_id,
    field_key,
    label,
    field_type,
    required,
    placeholder,
    help_text,
    options_json,
    conditional_logic_json,
    sort_order,
    is_active
  ) values
    (ft_id, 'full_name', 'Full name', 'short_text', true, 'Your full name', null, null, null, 10, true),
    (ft_id, 'email', 'Email address', 'email', true, 'name@company.com', null, null, null, 20, true),
    (ft_id, 'phone', 'Phone number', 'phone', false, 'Optional', null, null, null, 30, true),
    (ft_id, 'brand_or_company_name', 'Brand or company name', 'short_text', false, 'Your brand or company', null, null, null, 40, true),
    (ft_id, 'country', 'Country', 'short_text', false, 'United Kingdom', null, null, null, 50, true),
    (ft_id, 'product_type', 'Product type', 'select', true, null, null,
      '["Capsules","Powder","Gummies","Liquid","Softgels","Not sure yet"]'::jsonb,
      null, 60, true),
    (ft_id, 'product_goal', 'Product goal', 'select', true, null, null,
      '["Sleep","Weight management","Focus","Energy","Gut health","Women''s health","Sports nutrition","General wellness","Custom"]'::jsonb,
      null, 70, true),
    (ft_id, 'formula_direction', 'Formula direction', 'radio', true, null, null,
      '[
        {"label":"I already have a formula","value":"have_formula"},
        {"label":"I have some ingredients in mind","value":"have_ingredients"},
        {"label":"I need help developing the formula","value":"need_help"}
      ]'::jsonb,
      null, 80, true),
    (ft_id, 'ingredients_and_dosages', 'Ingredients and dosages if known', 'long_text', false, 'List ingredients, forms, and dosages if you know them', null,
      null,
      '{
        "showWhen": {
          "field": "formula_direction",
          "operator": "in",
          "value": ["have_formula", "have_ingredients"]
        }
      }'::jsonb,
      90, true),
    (ft_id, 'target_quantity', 'Target quantity', 'number', false, 'e.g. 1000', null, null, null, 100, true),
    (ft_id, 'pack_size', 'Pack size', 'short_text', false, 'e.g. 60 capsules', null, null, null, 110, true),
    (ft_id, 'packaging_preference', 'Packaging preference', 'select', false, null, null,
      '["Bottle","Pouch","Sachet","Tub","Not sure"]'::jsonb,
      null, 120, true),
    (ft_id, 'budget_positioning', 'Budget positioning', 'select', false, null, null,
      '["Budget","Mid range","Premium","Not sure"]'::jsonb,
      null, 130, true),
    (ft_id, 'target_market', 'Target market', 'select', false, null, null,
      '["UK","EU","USA","Other"]'::jsonb,
      null, 140, true),
    (ft_id, 'launch_timeline', 'Launch timeline', 'select', false, null, null,
      '["ASAP","1 month","1 to 3 months","3 plus months","Just exploring"]'::jsonb,
      null, 150, true),
    (ft_id, 'needs_formulation_help', 'Do you need help with formulation?', 'radio', false, null, null,
      '[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]'::jsonb,
      null, 160, true),
    (ft_id, 'needs_packaging_label_help', 'Do you need help with packaging or label guidance?', 'radio', false, null, null,
      '[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]'::jsonb,
      null, 170, true),
    (ft_id, 'extra_notes', 'Anything else we should know?', 'long_text', false, 'Add anything useful here', null, null, null, 180, true);

  insert into public.contacts (
    workspace_id,
    first_name,
    last_name,
    email,
    phone,
    company_name,
    country,
    notes
  )
  select
    ws_id,
    'Katie',
    'Tams',
    'demo-katie@mamabefit.example',
    '07123 456789',
    'Mama Be Fit',
    'United Kingdom',
    'Demo seeded contact for local development'
  where not exists (
    select 1
    from public.contacts
    where workspace_id = ws_id
      and email = 'demo-katie@mamabefit.example'
  )
  returning id into demo_contact_id;

  if demo_contact_id is null then
    select id
    into demo_contact_id
    from public.contacts
    where workspace_id = ws_id
      and email = 'demo-katie@mamabefit.example'
    limit 1;
  end if;

  insert into public.requests (
    workspace_id,
    form_template_id,
    contact_id,
    source,
    status,
    raw_payload_json,
    utm_json
  )
  select
    ws_id,
    ft_id,
    demo_contact_id,
    'website_form',
    'submitted',
    '{
      "full_name": "Katie Tams",
      "email": "demo-katie@mamabefit.example",
      "phone": "07123 456789",
      "brand_or_company_name": "Mama Be Fit",
      "country": "United Kingdom",
      "product_type": "Capsules",
      "product_goal": "Women''s health",
      "formula_direction": "need_help",
      "ingredients_and_dosages": "",
      "target_quantity": "1000",
      "pack_size": "60 capsules",
      "packaging_preference": "Bottle",
      "budget_positioning": "Premium",
      "target_market": "UK",
      "launch_timeline": "1 to 3 months",
      "needs_formulation_help": "yes",
      "needs_packaging_label_help": "yes",
      "extra_notes": "Looking for support with an energy, recovery, and hormone support concept."
    }'::jsonb,
    '{"source":"seed"}'::jsonb
  where not exists (
    select 1
    from public.requests
    where workspace_id = ws_id
      and contact_id = demo_contact_id
      and source = 'website_form'
      and utm_json = '{"source":"seed"}'::jsonb
  )
  returning id into demo_request_id;

  if demo_request_id is null then
    select r.id
    into demo_request_id
    from public.requests r
    where r.workspace_id = ws_id
      and r.contact_id = demo_contact_id
      and r.source = 'website_form'
      and r.utm_json = '{"source":"seed"}'::jsonb
    order by r.created_at desc
    limit 1;
  end if;

  select o.id
  into demo_opportunity_id
  from public.opportunities o
  where o.request_id = demo_request_id
  limit 1;

  if demo_opportunity_id is not null then
    update public.opportunities
    set
      stage = 'supplier_response_received',
      priority = 'high',
      summary = 'Demo seeded opportunity for a women''s health capsule product',
      internal_notes = 'Use this record to test the full request to quote flow.',
      updated_at = now()
    where id = demo_opportunity_id;

    update public.structured_requirements
    set
      product_type = 'Capsules',
      format = 'Vegan capsules',
      target_benefit = 'Women''s health',
      market = 'UK',
      quantity_units = 1000,
      pack_size = '60 capsules',
      packaging_type = 'Bottle',
      formulation_support_needed = true,
      target_positioning = 'Premium',
      timeline = '1 to 3 months',
      requirement_json = '{
        "brand_stage": "new brand",
        "notes": "Energy, recovery, hormone support direction",
        "label_support": true
      }'::jsonb,
      cleaned_summary = 'Prospect wants a premium women''s health capsule product for the UK market. They need formulation support, label guidance, and an initial 1,000 unit quote.'
    where opportunity_id = demo_opportunity_id;

    insert into public.supplier_rfqs (
      opportunity_id,
      supplier_name,
      supplier_contact_name,
      supplier_email,
      rfq_subject,
      rfq_body,
      status,
      sent_at
    )
    select
      demo_opportunity_id,
      'Demo Supplier UK',
      'Account Manager',
      'quotes@demo-supplier.example',
      'RFQ - Women''s Health Capsules - 1000 Units',
      'Please quote for a premium UK-focused women''s health capsule product, 60 capsules per bottle, 1000 units, with formulation support and packaging guidance.',
      'sent',
      now() - interval '1 day'
    where not exists (
      select 1
      from public.supplier_rfqs
      where opportunity_id = demo_opportunity_id
        and supplier_name = 'Demo Supplier UK'
    )
    returning id into demo_rfq_id;

    if demo_rfq_id is null then
      select id
      into demo_rfq_id
      from public.supplier_rfqs
      where opportunity_id = demo_opportunity_id
        and supplier_name = 'Demo Supplier UK'
      limit 1;
    end if;

    insert into public.supplier_responses (
      supplier_rfq_id,
      moq,
      unit_price,
      currency,
      tooling_cost,
      formulation_cost,
      lead_time_days,
      shipping_notes,
      compliance_notes,
      response_notes,
      raw_response_text,
      selected_for_quote,
      received_at
    )
    select
      demo_rfq_id,
      1000,
      4.85,
      'GBP',
      0.00,
      250.00,
      35,
      'UK pallet delivery included',
      'Final formula subject to compliance review',
      'Strong fit for startup launch',
      'MOQ 1000 units, lead time 5 weeks, formulation support available.',
      true,
      now() - interval '12 hours'
    where not exists (
      select 1
      from public.supplier_responses
      where supplier_rfq_id = demo_rfq_id
    );

    insert into public.customer_quotes (
      opportunity_id,
      quote_number,
      version_number,
      title,
      currency,
      unit_price,
      moq,
      estimated_lead_time_days,
      included_items_json,
      assumptions_json,
      quote_notes,
      valid_until,
      status,
      sent_at
    )
    select
      demo_opportunity_id,
      'SL-Q-0001-V1',
      1,
      'Premium Women''s Health Capsules',
      'GBP',
      5.95,
      1000,
      35,
      '[
        "Custom formulation support",
        "Capsule manufacturing",
        "Bottle filling",
        "Basic packaging guidance"
      ]'::jsonb,
      '[
        "Final price subject to formula confirmation",
        "Artwork and print costs excluded unless agreed"
      ]'::jsonb,
      'Demo quote seeded for local development and workflow testing.',
      current_date + 14,
      'sent',
      now() - interval '6 hours'
    where not exists (
      select 1
      from public.customer_quotes
      where opportunity_id = demo_opportunity_id
        and quote_number = 'SL-Q-0001-V1'
    );

    perform public.touch_activity_log(
      ws_id,
      demo_opportunity_id,
      null,
      'seed_data_created',
      'Demo opportunity data seeded for local development',
      jsonb_build_object('quote_number', 'SL-Q-0001-V1')
    );
  end if;
end $$;

commit;
