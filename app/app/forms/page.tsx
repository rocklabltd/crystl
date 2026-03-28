import Link from "next/link";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type FormRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  headline: string | null;
  updated_at: string;
};

type FieldCountRecord = {
  form_template_id: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

export default async function FormsPage() {
  const { workspace, membership } = await requireWorkspaceContext();
  const supabase = await createSupabaseServerComponentClient();

  const { data: formRows } = await supabase
    .from("form_templates")
    .select("id, name, slug, status, headline, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const forms = (formRows ?? []) as FormRecord[];
  const formIds = forms.map((form) => form.id);
  const { data: fields } = formIds.length
    ? await supabase.from("form_fields").select("form_template_id").in("form_template_id", formIds)
    : { data: [] as FieldCountRecord[] };

  const fieldCounts = (fields ?? []).reduce<Record<string, number>>((acc, field) => {
    acc[field.form_template_id] = (acc[field.form_template_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-black/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Forms</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Hosted form templates</h1>
          <p className="mt-2 text-neutral-600">Manage public intake forms and the fields your workspace exposes.</p>
        </div>
        <p className="text-sm text-neutral-500">Editing available for {membership.role === "viewer" || membership.role === "sales" ? "managers and owners" : membership.role}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {forms.length ? (
          forms.map((form) => (
            <Link key={form.id} href={`/app/forms/${form.id}`} className="rounded-3xl border border-black/8 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(24,24,27,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">/{workspace.slug}/f/{form.slug}</p>
                  <h2 className="mt-2 text-xl font-semibold text-neutral-950">{form.name}</h2>
                </div>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-neutral-700">{form.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-600">{form.headline || "No headline configured yet."}</p>
              <div className="mt-5 flex items-center justify-between text-sm text-neutral-500">
                <span>{fieldCounts[form.id] ?? 0} fields</span>
                <span>Updated {formatDate(form.updated_at)}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-3xl border border-black/8 bg-white p-8 text-sm text-neutral-600">No form templates have been created yet.</div>
        )}
      </div>
    </div>
  );
}
