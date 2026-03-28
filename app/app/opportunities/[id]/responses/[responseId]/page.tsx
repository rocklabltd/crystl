import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { updateSupplierResponseAction } from "../../actions";

type PageParams = { id: string; responseId: string };

type SearchParams = { error?: string };

function flashMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Please check the supplier response and try again.";
    case "rfq":
      return "Choose a supplier RFQ linked to this opportunity.";
    case "save":
      return "We could not save this supplier response.";
    default:
      return null;
  }
}

export default async function SupplierResponseEditPage({ params, searchParams }: { params: Promise<PageParams>; searchParams: Promise<SearchParams> }) {
  const { workspace, default_currency } = await requireWorkspaceContext().then((context) => ({ workspace: context.workspace, default_currency: context.workspace.default_currency }));
  const { id, responseId } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: response, error } = await supabase
    .from("supplier_responses")
    .select("id, supplier_rfq_id, moq, unit_price, currency, tooling_cost, formulation_cost, lead_time_days, shipping_notes, compliance_notes, response_notes, raw_response_text, selected_for_quote, received_at")
    .eq("id", responseId)
    .single();

  if (error || !response) {
    notFound();
  }

  const { data: rfqs } = await supabase
    .from("supplier_rfqs")
    .select("id, supplier_name, opportunity_id")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });

  if (!(rfqs ?? []).some((rfq) => rfq.id === response.supplier_rfq_id)) {
    notFound();
  }

  const updateResponse = updateSupplierResponseAction.bind(null, id, response.id);
  const message = flashMessage(resolvedSearchParams.error);

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <Link href={`/app/opportunities/${id}?tab=responses`} className="text-sm text-neutral-500 underline underline-offset-4">Back to supplier responses</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Supplier response</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Edit supplier response</h1>
        <p className="mt-2 text-neutral-600">Workspace: {workspace.brand_name || workspace.name}</p>
      </div>

      {message ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}

      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <form action={updateResponse} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div><label htmlFor="supplier_rfq_id" className="block text-sm font-medium text-neutral-800">Supplier RFQ</label><select id="supplier_rfq_id" name="supplier_rfq_id" defaultValue={response.supplier_rfq_id} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3">{(rfqs ?? []).map((rfq) => <option key={rfq.id} value={rfq.id}>{rfq.supplier_name}</option>)}</select></div>
            <div><label htmlFor="moq" className="block text-sm font-medium text-neutral-800">MOQ</label><input id="moq" name="moq" type="number" defaultValue={response.moq?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="unit_price" className="block text-sm font-medium text-neutral-800">Unit price</label><input id="unit_price" name="unit_price" type="number" step="0.01" defaultValue={response.unit_price?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="currency" className="block text-sm font-medium text-neutral-800">Currency</label><input id="currency" name="currency" defaultValue={response.currency || default_currency || "GBP"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="tooling_cost" className="block text-sm font-medium text-neutral-800">Tooling cost</label><input id="tooling_cost" name="tooling_cost" type="number" step="0.01" defaultValue={response.tooling_cost?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="formulation_cost" className="block text-sm font-medium text-neutral-800">Formulation cost</label><input id="formulation_cost" name="formulation_cost" type="number" step="0.01" defaultValue={response.formulation_cost?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="lead_time_days" className="block text-sm font-medium text-neutral-800">Lead time days</label><input id="lead_time_days" name="lead_time_days" type="number" defaultValue={response.lead_time_days?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <label className="flex items-end gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"><input type="checkbox" name="selected_for_quote" value="true" defaultChecked={response.selected_for_quote} />Mark as preferred response</label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="shipping_notes" className="block text-sm font-medium text-neutral-800">Shipping notes</label><textarea id="shipping_notes" name="shipping_notes" defaultValue={response.shipping_notes || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="compliance_notes" className="block text-sm font-medium text-neutral-800">Compliance notes</label><textarea id="compliance_notes" name="compliance_notes" defaultValue={response.compliance_notes || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          </div>
          <div><label htmlFor="response_notes" className="block text-sm font-medium text-neutral-800">Response notes</label><textarea id="response_notes" name="response_notes" defaultValue={response.response_notes || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <div><label htmlFor="raw_response_text" className="block text-sm font-medium text-neutral-800">Raw supplier response</label><textarea id="raw_response_text" name="raw_response_text" defaultValue={response.raw_response_text || ""} className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Save supplier response</button>
        </form>
      </section>
    </div>
  );
}
