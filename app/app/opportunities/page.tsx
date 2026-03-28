import Link from "next/link";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SearchParams = {
  stage?: string;
  search?: string;
};

type OpportunityRecord = {
  id: string;
  ref_code: string;
  title: string;
  stage: string;
  priority: string;
  updated_at: string;
  contact_id: string | null;
};

type ContactRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

function stageLabel(value: string) {
  return value.replaceAll("_", " ");
}

function contactName(contact?: ContactRecord) {
  if (!contact) {
    return "No contact linked";
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.company_name || "Unnamed contact";
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { workspace } = await requireWorkspaceContext();
  const resolvedSearchParams = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, ref_code, title, stage, priority, updated_at, contact_id")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const contactIds = Array.from(
    new Set((opportunities ?? []).map((item) => item.contact_id).filter(Boolean))
  ) as string[];

  const { data: contacts } = contactIds.length
    ? await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_name")
        .in("id", contactIds)
    : { data: [] as ContactRecord[] };

  const contactMap = new Map((contacts ?? []).map((contact) => [contact.id, contact]));
  const normalizedSearch = (resolvedSearchParams.search ?? "").trim().toLowerCase();

  const filteredOpportunities = ((opportunities ?? []) as OpportunityRecord[]).filter((opportunity) => {
    if (resolvedSearchParams.stage && opportunity.stage !== resolvedSearchParams.stage) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const contact = opportunity.contact_id ? contactMap.get(opportunity.contact_id) : undefined;
    const haystack = [
      opportunity.ref_code,
      opportunity.title,
      contactName(contact),
      contact?.company_name ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const stages = Array.from(new Set((opportunities ?? []).map((opportunity) => opportunity.stage)));

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
          Opportunities
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Working inbox</h1>
        <p className="mt-2 text-neutral-600">
          Review and filter active quote jobs across the workspace.
        </p>
      </div>

      <form className="mt-6 grid gap-4 rounded-3xl border border-black/8 bg-white p-5 md:grid-cols-[1fr_220px_auto]">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-neutral-800">
            Search
          </label>
          <input
            id="search"
            name="search"
            defaultValue={resolvedSearchParams.search ?? ""}
            placeholder="Ref code, title, contact, company"
            className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"
          />
        </div>
        <div>
          <label htmlFor="stage" className="block text-sm font-medium text-neutral-800">
            Stage
          </label>
          <select
            id="stage"
            name="stage"
            defaultValue={resolvedSearchParams.stage ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-fit self-end rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white"
        >
          Apply filters
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-3xl border border-black/8 bg-white">
        <div className="grid grid-cols-[140px_1.4fr_1.2fr_160px_120px] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span>Ref</span>
          <span>Title</span>
          <span>Contact</span>
          <span>Stage</span>
          <span>Priority</span>
        </div>

        {filteredOpportunities.length ? (
          filteredOpportunities.map((opportunity) => {
            const contact = opportunity.contact_id ? contactMap.get(opportunity.contact_id) : undefined;

            return (
              <Link
                key={opportunity.id}
                href={`/app/opportunities/${opportunity.id}`}
                className="grid grid-cols-[140px_1.4fr_1.2fr_160px_120px] gap-4 border-b border-black/6 px-6 py-4 text-sm transition hover:bg-[#faf7f2] last:border-b-0"
              >
                <span className="font-medium text-neutral-950">{opportunity.ref_code}</span>
                <span className="text-neutral-800">{opportunity.title}</span>
                <span className="text-neutral-600">
                  {contactName(contact)}
                  {contact?.company_name ? (
                    <span className="block text-xs uppercase tracking-[0.18em] text-neutral-400">
                      {contact.company_name}
                    </span>
                  ) : null}
                </span>
                <span className="text-neutral-700">{stageLabel(opportunity.stage)}</span>
                <span className="text-neutral-700">{opportunity.priority}</span>
              </Link>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-neutral-600">
            No opportunities match those filters yet.
          </div>
        )}
      </div>
    </div>
  );
}
