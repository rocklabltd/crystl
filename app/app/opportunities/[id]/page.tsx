import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

import {
  createCustomerQuoteAction,
  createSupplierResponseAction,
  createSupplierRfqAction,
  saveStructuredRequirementAction,
  updateOpportunityWorkflowAction,
} from "./actions";

type PageParams = { id: string };
type SearchParams = { tab?: string; saved?: string; error?: string };
type ContactRecord = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; company_name: string | null; country: string | null };
type RequestRecord = { id: string; source: string; status: string; submitted_at: string; raw_payload_json: Record<string, unknown> };
type StructuredRequirementRecord = { product_type: string | null; format: string | null; target_benefit: string | null; market: string | null; quantity_units: number | null; pack_size: string | null; packaging_type: string | null; formulation_support_needed: boolean | null; target_positioning: string | null; timeline: string | null; cleaned_summary: string | null; requirement_json: Record<string, unknown> | null };
type SupplierRfqRecord = { id: string; supplier_name: string; supplier_contact_name: string | null; supplier_email: string | null; rfq_subject: string | null; status: string; sent_at: string | null; created_at: string };
type SupplierResponseRecord = { id: string; supplier_rfq_id: string; moq: number | null; unit_price: number | null; currency: string; lead_time_days: number | null; response_notes: string | null; selected_for_quote: boolean; received_at: string | null };
type QuoteRecord = { id: string; quote_number: string; version_number: number; title: string; currency: string; unit_price: number | null; moq: number | null; status: string; valid_until: string | null; sent_at: string | null };
type ActivityRecord = { id: string; activity_type: string; activity_text: string; created_at: string };

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "raw-request", label: "Raw request" },
  { id: "requirement", label: "Structured requirement" },
  { id: "rfqs", label: "Supplier RFQs" },
  { id: "responses", label: "Supplier responses" },
  { id: "quotes", label: "Customer quotes" },
  { id: "activity", label: "Activity" },
] as const;

const stages = [
  "new",
  "reviewing",
  "awaiting_info",
  "sent_for_pricing",
  "supplier_response_received",
  "quote_ready",
  "quote_sent",
  "won",
  "lost",
] as const;

const priorities = ["low", "normal", "high", "urgent"] as const;

function humanize(value: string) { return value.replaceAll("_", " "); }
function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function contactName(contact?: ContactRecord | null) {
  if (!contact) return "No contact linked";
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.company_name || "Unnamed contact";
}
function getFlashMessage(error?: string, saved?: string) {
  const successMap: Record<string, string> = { workflow: "Opportunity workflow updated.", requirement: "Structured requirement saved.", rfq: "Supplier RFQ created.", response: "Supplier response logged.", quote: "Customer quote created." };
  if (saved && successMap[saved]) return { tone: "success", text: successMap[saved] };
  switch (error) {
    case "forbidden": return { tone: "error", text: "Your role cannot edit this opportunity." };
    case "validation": return { tone: "error", text: "Please check the form and try again." };
    case "json": return { tone: "error", text: "Requirement JSON must be valid JSON." };
    case "rfq": return { tone: "error", text: "Choose a supplier RFQ linked to this opportunity." };
    case "save": return { tone: "error", text: "We could not save your changes." };
    default: return null;
  }
}

export default async function OpportunityDetailPage({ params, searchParams }: { params: Promise<PageParams>; searchParams: Promise<SearchParams> }) {
  const { workspace, membership } = await requireWorkspaceContext();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const activeTab = tabs.some((tab) => tab.id === resolvedSearchParams.tab) ? resolvedSearchParams.tab! : "overview";
  const flashMessage = getFlashMessage(resolvedSearchParams.error, resolvedSearchParams.saved);
  const supabase = await createSupabaseServerComponentClient();
  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("*").eq("id", id).eq("workspace_id", workspace.id).single();
  if (opportunityError || !opportunity) notFound();

  const [contactResult, requestResult, requirementResult, rfqsResult, quotesResult, activityResult] = await Promise.all([
    opportunity.contact_id ? supabase.from("contacts").select("id, first_name, last_name, email, phone, company_name, country").eq("id", opportunity.contact_id).single() : Promise.resolve({ data: null }),
    opportunity.request_id ? supabase.from("requests").select("id, source, status, submitted_at, raw_payload_json").eq("id", opportunity.request_id).single() : Promise.resolve({ data: null }),
    supabase.from("structured_requirements").select("product_type, format, target_benefit, market, quantity_units, pack_size, packaging_type, formulation_support_needed, target_positioning, timeline, cleaned_summary, requirement_json").eq("opportunity_id", opportunity.id).maybeSingle(),
    supabase.from("supplier_rfqs").select("id, supplier_name, supplier_contact_name, supplier_email, rfq_subject, status, sent_at, created_at").eq("opportunity_id", opportunity.id).order("created_at", { ascending: false }),
    supabase.from("customer_quotes").select("id, quote_number, version_number, title, currency, unit_price, moq, status, valid_until, sent_at").eq("opportunity_id", opportunity.id).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select("id, activity_type, activity_text, created_at").eq("workspace_id", workspace.id).eq("opportunity_id", opportunity.id).order("created_at", { ascending: false }),
  ]);

  const contact = (contactResult.data ?? null) as ContactRecord | null;
  const request = (requestResult.data ?? null) as RequestRecord | null;
  const requirement = (requirementResult.data ?? null) as StructuredRequirementRecord | null;
  const rfqs = (rfqsResult.data ?? []) as SupplierRfqRecord[];
  const quotes = (quotesResult.data ?? []) as QuoteRecord[];
  const activity = (activityResult.data ?? []) as ActivityRecord[];
  const rfqIds = rfqs.map((rfq) => rfq.id);
  const responsesResult = rfqIds.length ? await supabase.from("supplier_responses").select("id, supplier_rfq_id, moq, unit_price, currency, lead_time_days, response_notes, selected_for_quote, received_at").in("supplier_rfq_id", rfqIds).order("received_at", { ascending: false }) : { data: [] as SupplierResponseRecord[] };
  const responses = (responsesResult.data ?? []) as SupplierResponseRecord[];
  const preferredResponse = responses.find((response) => response.selected_for_quote) ?? responses[0] ?? null;
  const rfqMap = new Map(rfqs.map((rfq) => [rfq.id, rfq]));
  const updateWorkflow = updateOpportunityWorkflowAction.bind(null, opportunity.id);
  const saveRequirement = saveStructuredRequirementAction.bind(null, opportunity.id);
  const createRfq = createSupplierRfqAction.bind(null, opportunity.id);
  const createResponse = createSupplierResponseAction.bind(null, opportunity.id);
  const createQuote = createCustomerQuoteAction.bind(null, opportunity.id);
  const defaultRfqSubject = requirement?.product_type ? `RFQ - ${requirement.product_type} - ${opportunity.ref_code}` : `RFQ - ${opportunity.title}`;
  const defaultRfqBody = [`Opportunity: ${opportunity.title}`, requirement?.product_type ? `Product type: ${requirement.product_type}` : null, requirement?.target_benefit ? `Target benefit: ${requirement.target_benefit}` : null, requirement?.market ? `Market: ${requirement.market}` : null, requirement?.quantity_units ? `Quantity: ${requirement.quantity_units}` : null, requirement?.cleaned_summary ? `Summary: ${requirement.cleaned_summary}` : null].filter(Boolean).join("\n");
  const defaultQuoteItems = ["Custom formulation support", requirement?.product_type ? `${requirement.product_type} manufacturing` : null, requirement?.packaging_type ? `${requirement.packaging_type} packaging` : null].filter(Boolean).join("\n");

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-black/8 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/app/opportunities" className="text-sm text-neutral-500 underline underline-offset-4">Back to opportunities</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Opportunity detail</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">{opportunity.title}</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-600">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1 font-medium text-neutral-900">{opportunity.ref_code}</span>
            <span>Stage: {humanize(opportunity.stage)}</span>
            <span>Priority: {opportunity.priority}</span>
            <span>Owner role: {membership.role}</span>
          </div>
        </div>
        <div className="grid gap-3 rounded-3xl border border-black/8 bg-white p-5 text-sm text-neutral-600 sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Contact</p><p className="mt-1 font-medium text-neutral-950">{contactName(contact)}</p><p className="mt-1">{contact?.company_name || "No company added"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Last updated</p><p className="mt-1 font-medium text-neutral-950">{formatDate(opportunity.updated_at)}</p><p className="mt-1">Created {formatDate(opportunity.created_at)}</p></div>
        </div>
      </div>
      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Workflow control</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">Manage stage and priority</h2>
          </div>
          {opportunity.closed_at ? <p className="text-sm text-neutral-500">Closed {formatDate(opportunity.closed_at)}</p> : null}
        </div>
        <form action={updateWorkflow} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr_auto] lg:items-end">
          <div><label htmlFor="workflow_stage" className="block text-sm font-medium text-neutral-800">Stage</label><select id="workflow_stage" name="stage" defaultValue={opportunity.stage} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3">{stages.map((stage) => <option key={stage} value={stage}>{humanize(stage)}</option>)}</select></div>
          <div><label htmlFor="workflow_priority" className="block text-sm font-medium text-neutral-800">Priority</label><select id="workflow_priority" name="priority" defaultValue={opportunity.priority} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3">{priorities.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}</select></div>
          <div><label htmlFor="workflow_outcome_reason" className="block text-sm font-medium text-neutral-800">Outcome reason</label><input id="workflow_outcome_reason" name="outcome_reason" defaultValue={opportunity.outcome_reason || ""} placeholder="Required when stage is won or lost" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <button type="submit" className="inline-flex h-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Update workflow</button>
        </form>
      </section>
      <nav className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => <Link key={tab.id} href={`/app/opportunities/${opportunity.id}?tab=${tab.id}`} className={["rounded-full px-4 py-2 text-sm transition", activeTab === tab.id ? "bg-neutral-950 text-white" : "border border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"].join(" ")}>{tab.label}</Link>)}
      </nav>
      {flashMessage ? <p className={["mt-6 rounded-2xl px-4 py-3 text-sm", flashMessage.tone === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"].join(" ")}>{flashMessage.text}</p> : null}
      {activeTab === "overview" ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <h2 className="text-xl font-semibold text-neutral-950">Requirement summary</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Product type</p><p className="mt-1 text-sm text-neutral-800">{requirement?.product_type || request?.raw_payload_json?.product_type?.toString() || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Target benefit</p><p className="mt-1 text-sm text-neutral-800">{requirement?.target_benefit || request?.raw_payload_json?.product_goal?.toString() || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Market</p><p className="mt-1 text-sm text-neutral-800">{requirement?.market || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Quantity</p><p className="mt-1 text-sm text-neutral-800">{requirement?.quantity_units || request?.raw_payload_json?.target_quantity?.toString() || "Not set"}</p></div>
              </div>
              <p className="mt-5 rounded-2xl bg-[#faf7f2] p-4 text-sm leading-6 text-neutral-700">{requirement?.cleaned_summary || "No cleaned summary has been added yet. Use the structured requirement tab to turn the raw request into a quotable brief."}</p>
            </div>
            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <h2 className="text-xl font-semibold text-neutral-950">Contact card</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Name</p><p className="mt-1 text-sm text-neutral-800">{contactName(contact)}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Company</p><p className="mt-1 text-sm text-neutral-800">{contact?.company_name || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Email</p><p className="mt-1 text-sm text-neutral-800">{contact?.email || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Phone</p><p className="mt-1 text-sm text-neutral-800">{contact?.phone || "Not set"}</p></div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <h2 className="text-xl font-semibold text-neutral-950">Latest supplier response</h2>
              {responses[0] ? <div className="mt-4 text-sm text-neutral-700"><p className="font-medium text-neutral-950">{rfqMap.get(responses[0].supplier_rfq_id)?.supplier_name || "Supplier"}</p><p className="mt-2">MOQ: {responses[0].moq || "Not set"}</p><p>Unit price: {responses[0].unit_price ? `${responses[0].currency} ${responses[0].unit_price}` : "Not set"}</p><p>Lead time: {responses[0].lead_time_days ? `${responses[0].lead_time_days} days` : "Not set"}</p></div> : <p className="mt-4 text-sm text-neutral-600">No supplier responses logged yet.</p>}
            </div>
            <div className="rounded-3xl border border-black/8 bg-white p-6">
              <h2 className="text-xl font-semibold text-neutral-950">Latest customer quote</h2>
              {quotes[0] ? <div className="mt-4 text-sm text-neutral-700"><p className="font-medium text-neutral-950">{quotes[0].quote_number}</p><p className="mt-2">{quotes[0].title}</p><p>Status: {quotes[0].status}</p><p>Price: {quotes[0].unit_price ? `${quotes[0].currency} ${quotes[0].unit_price}` : "Not set"}</p></div> : <p className="mt-4 text-sm text-neutral-600">No customer quotes created yet.</p>}
            </div>
          </div>
        </section>
      ) : null}
      {activeTab === "raw-request" ? (
        <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
          <div className="flex flex-wrap gap-4 text-sm text-neutral-600"><span>Submitted: {formatDate(request?.submitted_at)}</span><span>Source: {request?.source || "Unknown"}</span><span>Status: {request?.status || "Unknown"}</span></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">{Object.entries(request?.raw_payload_json ?? {}).map(([key, value]) => <div key={key} className="rounded-2xl border border-black/8 bg-[#faf7f2] p-4"><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{humanize(key)}</p><p className="mt-2 text-sm leading-6 text-neutral-800">{String(value || "-")}</p></div>)}</div>
        </section>
      ) : null}
      {activeTab === "requirement" ? (
        <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
          <form action={saveRequirement} className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div><label htmlFor="product_type" className="block text-sm font-medium text-neutral-800">Product type</label><input id="product_type" name="product_type" defaultValue={requirement?.product_type || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="format" className="block text-sm font-medium text-neutral-800">Format</label><input id="format" name="format" defaultValue={requirement?.format || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="target_benefit" className="block text-sm font-medium text-neutral-800">Target benefit</label><input id="target_benefit" name="target_benefit" defaultValue={requirement?.target_benefit || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="market" className="block text-sm font-medium text-neutral-800">Market</label><input id="market" name="market" defaultValue={requirement?.market || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="quantity_units" className="block text-sm font-medium text-neutral-800">Quantity units</label><input id="quantity_units" name="quantity_units" type="number" defaultValue={requirement?.quantity_units?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="pack_size" className="block text-sm font-medium text-neutral-800">Pack size</label><input id="pack_size" name="pack_size" defaultValue={requirement?.pack_size || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="packaging_type" className="block text-sm font-medium text-neutral-800">Packaging type</label><input id="packaging_type" name="packaging_type" defaultValue={requirement?.packaging_type || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="target_positioning" className="block text-sm font-medium text-neutral-800">Target positioning</label><input id="target_positioning" name="target_positioning" defaultValue={requirement?.target_positioning || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="timeline" className="block text-sm font-medium text-neutral-800">Timeline</label><input id="timeline" name="timeline" defaultValue={requirement?.timeline || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="formulation_support_needed" className="block text-sm font-medium text-neutral-800">Formulation support needed</label><select id="formulation_support_needed" name="formulation_support_needed" defaultValue={requirement?.formulation_support_needed ? "true" : "false"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="false">No</option><option value="true">Yes</option></select></div>
            </div>
            <div><label htmlFor="cleaned_summary" className="block text-sm font-medium text-neutral-800">Cleaned summary</label><textarea id="cleaned_summary" name="cleaned_summary" defaultValue={requirement?.cleaned_summary || ""} className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="requirement_json" className="block text-sm font-medium text-neutral-800">Flexible requirement JSON</label><textarea id="requirement_json" name="requirement_json" defaultValue={JSON.stringify(requirement?.requirement_json || {}, null, 2)} className="mt-1 min-h-48 w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono text-sm" /></div>
            <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Save structured requirement</button>
          </form>
        </section>
      ) : null}
      {activeTab === "rfqs" ? (
        <section className="mt-6 space-y-6">
          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Create supplier RFQ</h2>
            <form action={createRfq} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><label htmlFor="supplier_name" className="block text-sm font-medium text-neutral-800">Supplier name</label><input id="supplier_name" name="supplier_name" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" required /></div>
                <div><label htmlFor="supplier_contact_name" className="block text-sm font-medium text-neutral-800">Supplier contact</label><input id="supplier_contact_name" name="supplier_contact_name" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="supplier_email" className="block text-sm font-medium text-neutral-800">Supplier email</label><input id="supplier_email" name="supplier_email" type="email" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="rfq_status" className="block text-sm font-medium text-neutral-800">Status</label><select id="rfq_status" name="status" defaultValue="draft" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="draft">Draft</option><option value="sent">Sent</option></select></div>
              </div>
              <div><label htmlFor="rfq_subject" className="block text-sm font-medium text-neutral-800">Subject</label><input id="rfq_subject" name="rfq_subject" defaultValue={defaultRfqSubject} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="rfq_body" className="block text-sm font-medium text-neutral-800">RFQ body</label><textarea id="rfq_body" name="rfq_body" defaultValue={defaultRfqBody} className="mt-1 min-h-40 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Create supplier RFQ</button>
            </form>
          </div>
          {rfqs.length ? rfqs.map((rfq) => <div key={rfq.id} className="rounded-3xl border border-black/8 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-neutral-950">{rfq.supplier_name}</h2><p className="mt-1 text-sm text-neutral-600">{rfq.rfq_subject || "No subject"}</p></div><span className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-neutral-700">{rfq.status}</span></div><div className="mt-4 grid gap-3 text-sm text-neutral-600 md:grid-cols-3"><p>Contact: {rfq.supplier_contact_name || "Not set"}</p><p>Email: {rfq.supplier_email || "Not set"}</p><p>Sent: {formatDate(rfq.sent_at)}</p></div></div>) : <div className="rounded-3xl border border-black/8 bg-white p-8 text-sm text-neutral-600">No supplier RFQs created yet.</div>}
        </section>
      ) : null}
      {activeTab === "responses" ? (
        <section className="mt-6 space-y-6">
          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Log supplier response</h2>
            <form action={createResponse} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div><label htmlFor="supplier_rfq_id" className="block text-sm font-medium text-neutral-800">Supplier RFQ</label><select id="supplier_rfq_id" name="supplier_rfq_id" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" required><option value="">Choose RFQ</option>{rfqs.map((rfq) => <option key={rfq.id} value={rfq.id}>{rfq.supplier_name}</option>)}</select></div>
                <div><label htmlFor="moq" className="block text-sm font-medium text-neutral-800">MOQ</label><input id="moq" name="moq" type="number" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="unit_price" className="block text-sm font-medium text-neutral-800">Unit price</label><input id="unit_price" name="unit_price" type="number" step="0.01" defaultValue={preferredResponse?.unit_price?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="currency" className="block text-sm font-medium text-neutral-800">Currency</label><input id="currency" name="currency" defaultValue={preferredResponse?.currency || workspace.default_currency || "GBP"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" required /></div>
                <div><label htmlFor="tooling_cost" className="block text-sm font-medium text-neutral-800">Tooling cost</label><input id="tooling_cost" name="tooling_cost" type="number" step="0.01" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="formulation_cost" className="block text-sm font-medium text-neutral-800">Formulation cost</label><input id="formulation_cost" name="formulation_cost" type="number" step="0.01" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="lead_time_days" className="block text-sm font-medium text-neutral-800">Lead time days</label><input id="lead_time_days" name="lead_time_days" type="number" defaultValue={preferredResponse?.lead_time_days?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <label className="flex items-end gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"><input type="checkbox" name="selected_for_quote" value="true" defaultChecked={!preferredResponse} />Mark as preferred response</label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><label htmlFor="shipping_notes" className="block text-sm font-medium text-neutral-800">Shipping notes</label><textarea id="shipping_notes" name="shipping_notes" className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="compliance_notes" className="block text-sm font-medium text-neutral-800">Compliance notes</label><textarea id="compliance_notes" name="compliance_notes" className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              </div>
              <div><label htmlFor="response_notes" className="block text-sm font-medium text-neutral-800">Response notes</label><textarea id="response_notes" name="response_notes" className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <div><label htmlFor="raw_response_text" className="block text-sm font-medium text-neutral-800">Raw supplier response</label><textarea id="raw_response_text" name="raw_response_text" className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white" disabled={!rfqs.length}>Log supplier response</button>
            </form>
          </div>
          {responses.length ? responses.map((response) => <div key={response.id} className="rounded-3xl border border-black/8 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-neutral-950">{rfqMap.get(response.supplier_rfq_id)?.supplier_name || "Supplier response"}</h2><p className="mt-1 text-sm text-neutral-600">Received {formatDate(response.received_at)}</p></div>{response.selected_for_quote ? <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">Preferred</span> : null}</div><div className="mt-4 grid gap-3 text-sm text-neutral-700 md:grid-cols-4"><p>MOQ: {response.moq || "Not set"}</p><p>Unit price: {response.unit_price ? `${response.currency} ${response.unit_price}` : "Not set"}</p><p>Lead time: {response.lead_time_days ? `${response.lead_time_days} days` : "Not set"}</p><p>Currency: {response.currency}</p></div><p className="mt-4 text-sm leading-6 text-neutral-600">{response.response_notes || "No notes added."}</p></div>) : <div className="rounded-3xl border border-black/8 bg-white p-8 text-sm text-neutral-600">No supplier responses logged yet.</div>}
        </section>
      ) : null}
      {activeTab === "quotes" ? (
        <section className="mt-6 space-y-6">
          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Create customer quote</h2>
            <form action={createQuote} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2"><label htmlFor="quote_title" className="block text-sm font-medium text-neutral-800">Quote title</label><input id="quote_title" name="title" defaultValue={opportunity.title} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" required /></div>
                <div><label htmlFor="quote_currency" className="block text-sm font-medium text-neutral-800">Currency</label><input id="quote_currency" name="currency" defaultValue={preferredResponse?.currency || workspace.default_currency || "GBP"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" required /></div>
                <div><label htmlFor="quote_status" className="block text-sm font-medium text-neutral-800">Status</label><select id="quote_status" name="status" defaultValue="draft" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="draft">Draft</option><option value="sent">Sent</option></select></div>
                <div><label htmlFor="quote_price" className="block text-sm font-medium text-neutral-800">Unit price</label><input id="quote_price" name="unit_price" type="number" step="0.01" defaultValue={preferredResponse?.unit_price?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="quote_moq" className="block text-sm font-medium text-neutral-800">MOQ</label><input id="quote_moq" name="moq" type="number" defaultValue={preferredResponse?.moq?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="quote_lead_time" className="block text-sm font-medium text-neutral-800">Lead time days</label><input id="quote_lead_time" name="estimated_lead_time_days" type="number" defaultValue={preferredResponse?.lead_time_days?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="quote_valid_until" className="block text-sm font-medium text-neutral-800">Valid until</label><input id="quote_valid_until" name="valid_until" type="date" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><label htmlFor="included_items" className="block text-sm font-medium text-neutral-800">Included items</label><textarea id="included_items" name="included_items" defaultValue={defaultQuoteItems} className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label htmlFor="assumptions" className="block text-sm font-medium text-neutral-800">Assumptions</label><textarea id="assumptions" name="assumptions" defaultValue="Final price subject to formula confirmation" className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              </div>
              <div><label htmlFor="quote_notes" className="block text-sm font-medium text-neutral-800">Quote notes</label><textarea id="quote_notes" name="quote_notes" className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
              <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Create customer quote</button>
            </form>
          </div>
          {quotes.length ? quotes.map((quote) => <div key={quote.id} className="rounded-3xl border border-black/8 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-neutral-950">{quote.quote_number}</h2><p className="mt-1 text-sm text-neutral-600">{quote.title}</p></div><span className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-neutral-700">{quote.status}</span></div><div className="mt-4 grid gap-3 text-sm text-neutral-700 md:grid-cols-4"><p>Version: V{quote.version_number}</p><p>Price: {quote.unit_price ? `${quote.currency} ${quote.unit_price}` : "Not set"}</p><p>MOQ: {quote.moq || "Not set"}</p><p>Valid until: {quote.valid_until || "Not set"}</p></div></div>) : <div className="rounded-3xl border border-black/8 bg-white p-8 text-sm text-neutral-600">No customer quotes created yet.</div>}
        </section>
      ) : null}
      {activeTab === "activity" ? (
        <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6"><div className="space-y-4">{activity.length ? activity.map((entry) => <div key={entry.id} className="border-l-2 border-neutral-200 pl-4"><p className="text-sm font-medium text-neutral-900">{entry.activity_text}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">{humanize(entry.activity_type)} • {formatDate(entry.created_at)}</p></div>) : <p className="text-sm text-neutral-600">No activity logged for this opportunity yet.</p>}</div></section>
      ) : null}
    </div>
  );
}

