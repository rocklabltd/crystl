import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

import { duplicateSupplierRfqAction, updateSupplierRfqAction } from "../../actions";

type PageParams = { id: string; rfqId: string };

type SearchParams = { error?: string };

function flashMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Please check the RFQ fields and try again.";
    case "save":
      return "We could not save this RFQ.";
    default:
      return null;
  }
}

export default async function SupplierRfqEditPage({ params, searchParams }: { params: Promise<PageParams>; searchParams: Promise<SearchParams> }) {
  const { workspace } = await requireWorkspaceContext();
  const { id, rfqId } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerComponentClient();

  const { data: rfq, error } = await supabase
    .from("supplier_rfqs")
    .select("id, supplier_name, supplier_contact_name, supplier_email, rfq_subject, rfq_body, status, sent_at")
    .eq("id", rfqId)
    .eq("opportunity_id", id)
    .single();

  if (error || !rfq) {
    notFound();
  }

  const updateRfq = updateSupplierRfqAction.bind(null, id, rfq.id);
  const duplicateRfq = duplicateSupplierRfqAction.bind(null, id, rfq.id);
  const message = flashMessage(resolvedSearchParams.error);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-black/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/app/opportunities/${id}?tab=rfqs`} className="text-sm text-neutral-500 underline underline-offset-4">Back to supplier RFQs</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Supplier RFQ</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Edit {rfq.supplier_name}</h1>
          <p className="mt-2 text-neutral-600">Workspace: {workspace.brand_name || workspace.name}</p>
        </div>
        <form action={duplicateRfq}>
          <button type="submit" className="inline-flex rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-neutral-800">Duplicate as draft</button>
        </form>
      </div>

      {message ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}

      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <form action={updateRfq} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="supplier_name" className="block text-sm font-medium text-neutral-800">Supplier name</label><input id="supplier_name" name="supplier_name" defaultValue={rfq.supplier_name} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="supplier_contact_name" className="block text-sm font-medium text-neutral-800">Supplier contact</label><input id="supplier_contact_name" name="supplier_contact_name" defaultValue={rfq.supplier_contact_name || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="supplier_email" className="block text-sm font-medium text-neutral-800">Supplier email</label><input id="supplier_email" name="supplier_email" type="email" defaultValue={rfq.supplier_email || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="status" className="block text-sm font-medium text-neutral-800">Status</label><select id="status" name="status" defaultValue={rfq.status} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="draft">Draft</option><option value="sent">Sent</option></select></div>
          </div>
          <div><label htmlFor="rfq_subject" className="block text-sm font-medium text-neutral-800">Subject</label><input id="rfq_subject" name="rfq_subject" defaultValue={rfq.rfq_subject || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <div><label htmlFor="rfq_body" className="block text-sm font-medium text-neutral-800">RFQ body</label><textarea id="rfq_body" name="rfq_body" defaultValue={rfq.rfq_body || ""} className="mt-1 min-h-48 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <button type="submit" className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white">Save RFQ</button>
        </form>
      </section>
    </div>
  );
}
