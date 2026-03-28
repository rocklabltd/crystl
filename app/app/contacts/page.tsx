import Link from "next/link";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type ContactRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
};

type OpportunityRecord = {
  id: string;
  contact_id: string | null;
  ref_code: string;
  title: string;
  stage: string;
};

type RequestRecord = {
  id: string;
  contact_id: string | null;
  submitted_at: string;
  raw_payload_json: Record<string, unknown>;
};

function contactName(contact: ContactRecord) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.company_name || contact.email || "Unnamed contact";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const { workspace } = await requireWorkspaceContext();
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerComponentClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_name, country, notes, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const contactIds = (contacts ?? []).map((contact) => contact.id);

  const [{ data: opportunities }, { data: requests }] = await Promise.all([
    contactIds.length
      ? supabase.from("opportunities").select("id, contact_id, ref_code, title, stage").in("contact_id", contactIds)
      : Promise.resolve({ data: [] as OpportunityRecord[] }),
    contactIds.length
      ? supabase.from("requests").select("id, contact_id, submitted_at, raw_payload_json").in("contact_id", contactIds)
      : Promise.resolve({ data: [] as RequestRecord[] }),
  ]);

  const selectedContact = ((contacts ?? []) as ContactRecord[]).find((contact) => contact.id === resolvedSearchParams.contact) ?? ((contacts ?? [])[0] as ContactRecord | undefined);
  const selectedOpportunities = (opportunities ?? []).filter((opportunity) => opportunity.contact_id === selectedContact?.id);
  const selectedRequests = (requests ?? []).filter((request) => request.contact_id === selectedContact?.id).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Contacts</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Workspace contacts</h1>
        <p className="mt-2 text-neutral-600">Prospects and customers captured from hosted forms and quote work for {workspace.brand_name || workspace.name}.</p>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-hidden rounded-3xl border border-black/8 bg-white">
          <div className="grid grid-cols-[1.2fr_1fr_140px] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            <span>Contact</span>
            <span>Company</span>
            <span>Country</span>
          </div>
          {(contacts ?? []).length ? (
            contacts?.map((contact) => (
              <Link key={contact.id} href={`/app/contacts?contact=${contact.id}`} className={["grid grid-cols-[1.2fr_1fr_140px] gap-4 border-b border-black/6 px-6 py-4 text-sm transition last:border-b-0", selectedContact?.id === contact.id ? "bg-[#faf7f2]" : "hover:bg-[#faf7f2]"].join(" ")}>
                <div>
                  <p className="font-medium text-neutral-950">{contactName(contact)}</p>
                  <p className="mt-1 text-neutral-600">{contact.email || "No email"}</p>
                </div>
                <span className="text-neutral-700">{contact.company_name || "Not set"}</span>
                <span className="text-neutral-700">{contact.country || "Not set"}</span>
              </Link>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-sm text-neutral-600">No contacts yet.</div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Contact detail</h2>
            {selectedContact ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Name</p><p className="mt-1 text-sm text-neutral-800">{contactName(selectedContact)}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Company</p><p className="mt-1 text-sm text-neutral-800">{selectedContact.company_name || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Email</p><p className="mt-1 text-sm text-neutral-800">{selectedContact.email || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Phone</p><p className="mt-1 text-sm text-neutral-800">{selectedContact.phone || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Country</p><p className="mt-1 text-sm text-neutral-800">{selectedContact.country || "Not set"}</p></div>
                <div><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Created</p><p className="mt-1 text-sm text-neutral-800">{formatDate(selectedContact.created_at)}</p></div>
                <div className="md:col-span-2"><p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Notes</p><p className="mt-1 text-sm leading-6 text-neutral-800">{selectedContact.notes || "No notes yet."}</p></div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-neutral-600">Choose a contact to inspect their recent request and opportunity history.</p>
            )}
          </div>

          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Recent opportunities</h2>
            <div className="mt-4 space-y-3">
              {selectedOpportunities.length ? selectedOpportunities.map((opportunity) => <Link key={opportunity.id} href={`/app/opportunities/${opportunity.id}`} className="block rounded-2xl border border-black/6 bg-[#faf7f2] p-4"><p className="text-sm font-medium text-neutral-950">{opportunity.ref_code}</p><p className="mt-1 text-sm text-neutral-700">{opportunity.title}</p><p className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-500">{opportunity.stage.replaceAll("_", " ")}</p></Link>) : <p className="text-sm text-neutral-600">No linked opportunities.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-950">Recent requests</h2>
            <div className="mt-4 space-y-3">
              {selectedRequests.length ? selectedRequests.map((request) => <div key={request.id} className="rounded-2xl border border-black/6 p-4"><p className="text-sm font-medium text-neutral-950">{formatDate(request.submitted_at)}</p><p className="mt-1 text-sm text-neutral-700">{request.raw_payload_json.product_type?.toString() || "No product type"}</p></div>) : <p className="text-sm text-neutral-600">No linked requests.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
