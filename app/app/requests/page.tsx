import Link from "next/link";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RequestRecord = {
  id: string;
  status: string;
  source: string;
  submitted_at: string;
  contact_id: string | null;
  form_template_id: string | null;
  raw_payload_json: Record<string, unknown>;
};

type ContactRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
};

type FormRecord = {
  id: string;
  name: string;
};

type OpportunityRecord = {
  id: string;
  request_id: string | null;
  ref_code: string;
  title: string;
  stage: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function contactName(contact?: ContactRecord) {
  if (!contact) {
    return "No contact linked";
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.company_name || contact.email || "Unnamed contact";
}

export default async function RequestsPage() {
  const { workspace } = await requireWorkspaceContext();
  const supabase = createSupabaseAdminClient();

  const { data: requestRows } = await supabase
    .from("requests")
    .select("id, status, source, submitted_at, contact_id, form_template_id, raw_payload_json")
    .eq("workspace_id", workspace.id)
    .order("submitted_at", { ascending: false });

  const requests = (requestRows ?? []) as RequestRecord[];
  const contactIds = Array.from(new Set(requests.map((request) => request.contact_id).filter(Boolean))) as string[];
  const formIds = Array.from(new Set(requests.map((request) => request.form_template_id).filter(Boolean))) as string[];
  const requestIds = requests.map((request) => request.id);

  const [{ data: contacts }, { data: forms }, { data: opportunities }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, first_name, last_name, company_name, email").in("id", contactIds)
      : Promise.resolve({ data: [] as ContactRecord[] }),
    formIds.length
      ? supabase.from("form_templates").select("id, name").in("id", formIds)
      : Promise.resolve({ data: [] as FormRecord[] }),
    requestIds.length
      ? supabase.from("opportunities").select("id, request_id, ref_code, title, stage").in("request_id", requestIds)
      : Promise.resolve({ data: [] as OpportunityRecord[] }),
  ]);

  const contactMap = new Map((contacts ?? []).map((contact) => [contact.id, contact]));
  const formMap = new Map((forms ?? []).map((form) => [form.id, form]));
  const opportunityMap = new Map((opportunities ?? []).map((opportunity) => [opportunity.request_id, opportunity]));

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Requests</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Inbound requests</h1>
        <p className="mt-2 text-neutral-600">Review every raw submission coming into {workspace.brand_name || workspace.name}.</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-black/8 bg-white">
        <div className="grid grid-cols-[170px_1.4fr_1.1fr_1fr_170px] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span>Submitted</span>
          <span>Contact</span>
          <span>Form</span>
          <span>Opportunity</span>
          <span>Status</span>
        </div>
        {requests.length ? (
          requests.map((request) => {
            const contact = request.contact_id ? contactMap.get(request.contact_id) : undefined;
            const form = request.form_template_id ? formMap.get(request.form_template_id) : undefined;
            const opportunity = opportunityMap.get(request.id);
            const productType = request.raw_payload_json.product_type?.toString();

            return (
              <div key={request.id} className="grid grid-cols-[170px_1.4fr_1.1fr_1fr_170px] gap-4 border-b border-black/6 px-6 py-4 text-sm last:border-b-0">
                <div className="text-neutral-700">{formatDate(request.submitted_at)}</div>
                <div>
                  <p className="font-medium text-neutral-950">{contactName(contact)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500">{productType || "No product type"}</p>
                </div>
                <div className="text-neutral-700">{form?.name || "Unknown form"}</div>
                <div>
                  {opportunity ? (
                    <Link href={`/app/opportunities/${opportunity.id}`} className="font-medium text-neutral-950 underline underline-offset-4">
                      {opportunity.ref_code}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">Not created</span>
                  )}
                  {opportunity ? <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500">{opportunity.stage.replaceAll("_", " ")}</p> : null}
                </div>
                <div className="text-neutral-700">{request.status}</div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-neutral-600">No requests have been submitted yet.</div>
        )}
      </div>
    </div>
  );
}
