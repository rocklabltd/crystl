import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { createQuoteRevisionAction, updateCustomerQuoteAction } from "../../actions";

type PageParams = { id: string; quoteId: string };

type SearchParams = { error?: string };

function flashMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Please check the quote values and try again.";
    case "save":
      return "We could not save this customer quote.";
    default:
      return null;
  }
}

function toLineText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.map((item) => String(item)).join("\n");
}

export default async function CustomerQuoteEditPage({ params, searchParams }: { params: Promise<PageParams>; searchParams: Promise<SearchParams> }) {
  const { workspace } = await requireWorkspaceContext();
  const { id, quoteId } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: quote, error } = await supabase
    .from("customer_quotes")
    .select("id, quote_number, version_number, title, currency, unit_price, moq, estimated_lead_time_days, included_items_json, assumptions_json, quote_notes, valid_until, status, sent_at")
    .eq("id", quoteId)
    .eq("opportunity_id", id)
    .single();

  if (error || !quote) {
    notFound();
  }

  const updateQuote = updateCustomerQuoteAction.bind(null, id, quote.id);
  const createRevision = createQuoteRevisionAction.bind(null, id, quote.id);
  const message = flashMessage(resolvedSearchParams.error);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-black/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/app/opportunities/${id}?tab=quotes`} className="text-sm text-neutral-500 underline underline-offset-4">Back to customer quotes</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Customer quote</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Edit {quote.quote_number}</h1>
          <p className="mt-2 text-neutral-600">Workspace: {workspace.brand_name || workspace.name}</p>
        </div>
        <form action={createRevision}>
          <button type="submit" className="inline-flex rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-neutral-800">Create revision</button>
        </form>
      </div>

      {message ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}

      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <form action={updateQuote} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2"><label htmlFor="title" className="block text-sm font-medium text-neutral-800">Quote title</label><input id="title" name="title" defaultValue={quote.title} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="currency" className="block text-sm font-medium text-neutral-800">Currency</label><input id="currency" name="currency" defaultValue={quote.currency} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="status" className="block text-sm font-medium text-neutral-800">Status</label><select id="status" name="status" defaultValue={quote.status} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="draft">Draft</option><option value="sent">Sent</option></select></div>
            <div><label htmlFor="unit_price" className="block text-sm font-medium text-neutral-800">Unit price</label><input id="unit_price" name="unit_price" type="number" step="0.01" defaultValue={quote.unit_price?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="moq" className="block text-sm font-medium text-neutral-800">MOQ</label><input id="moq" name="moq" type="number" defaultValue={quote.moq?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="estimated_lead_time_days" className="block text-sm font-medium text-neutral-800">Lead time days</label><input id="estimated_lead_time_days" name="estimated_lead_time_days" type="number" defaultValue={quote.estimated_lead_time_days?.toString() || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="valid_until" className="block text-sm font-medium text-neutral-800">Valid until</label><input id="valid_until" name="valid_until" type="date" defaultValue={quote.valid_until || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="included_items" className="block text-sm font-medium text-neutral-800">Included items</label><textarea id="included_items" name="included_items" defaultValue={toLineText(quote.included_items_json)} className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="assumptions" className="block text-sm font-medium text-neutral-800">Assumptions</label><textarea id="assumptions" name="assumptions" defaultValue={toLineText(quote.assumptions_json)} className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          </div>
          <div><label htmlFor="quote_notes" className="block text-sm font-medium text-neutral-800">Quote notes</label><textarea id="quote_notes" name="quote_notes" defaultValue={quote.quote_notes || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Save customer quote</button>
        </form>
      </section>
    </div>
  );
}
