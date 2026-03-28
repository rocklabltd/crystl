import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { updateFormFieldAction, updateFormTemplateBasicsAction } from "./actions";

type PageParams = { id: string };
type SearchParams = { saved?: string; error?: string };
function flashMessage(error?: string, saved?: string) {
  if (saved === "basics") {
    return { tone: "success", text: "Form basics updated." };
  }
  if (saved === "field") {
    return { tone: "success", text: "Field updated." };
  }
  switch (error) {
    case "forbidden":
      return { tone: "error", text: "Only managers and owners can edit forms." };
    case "validation":
      return { tone: "error", text: "Please check the form values and try again." };
    case "json":
      return { tone: "error", text: "Options and conditional logic must be valid JSON." };
    case "save":
      return { tone: "error", text: "We could not save those form changes." };
    default:
      return null;
  }
}

export default async function FormDetailPage({ params, searchParams }: { params: Promise<PageParams>; searchParams: Promise<SearchParams> }) {
  const { workspace, membership } = await requireWorkspaceContext();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const message = flashMessage(resolvedSearchParams.error, resolvedSearchParams.saved);
  const supabase = createSupabaseAdminClient();

  const { data: form, error } = await supabase
    .from("form_templates")
    .select("id, name, slug, status, headline, intro_text, success_message, submit_button_text, updated_at")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !form) {
    notFound();
  }

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, field_key, label, field_type, required, placeholder, help_text, options_json, conditional_logic_json, sort_order, is_active")
    .eq("form_template_id", form.id)
    .order("sort_order", { ascending: true });

  const updateBasics = updateFormTemplateBasicsAction.bind(null, form.id);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-black/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/app/forms" className="text-sm text-neutral-500 underline underline-offset-4">Back to forms</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Form detail</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">{form.name}</h1>
          <p className="mt-2 text-neutral-600">Public URL: /w/{workspace.slug}/f/{form.slug}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href={`/w/${workspace.slug}/f/${form.slug}`} target="_blank" className="inline-flex rounded-xl border border-black/10 px-4 py-3 font-medium text-neutral-700">
              Open hosted form
            </Link>
            <a href={`/app/forms/${form.id}/embed-snippet`} className="inline-flex rounded-xl border border-black/10 px-4 py-3 font-medium text-neutral-700">
              Download iframe snippet
            </a>
            <a href={`/app/forms/${form.id}/embed-snippet?mode=button`} className="inline-flex rounded-xl border border-black/10 px-4 py-3 font-medium text-neutral-700">
              Download button snippet
            </a>
          </div>
        </div>
        <p className="text-sm text-neutral-500">Current role: {membership.role}</p>
      </div>

      {message ? <p className={["mt-6 rounded-2xl px-4 py-3 text-sm", message.tone === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"].join(" ")}>{message.text}</p> : null}

      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <h2 className="text-xl font-semibold text-neutral-950">Template basics</h2>
        <form action={updateBasics} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="name" className="block text-sm font-medium text-neutral-800">Name</label><input id="name" name="name" defaultValue={form.name} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="slug" className="block text-sm font-medium text-neutral-800">Slug</label><input id="slug" name="slug" defaultValue={form.slug} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="status" className="block text-sm font-medium text-neutral-800">Status</label><select id="status" name="status" defaultValue={form.status} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
            <div><label htmlFor="submit_button_text" className="block text-sm font-medium text-neutral-800">Submit button text</label><input id="submit_button_text" name="submit_button_text" defaultValue={form.submit_button_text || "Submit request"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          </div>
          <div><label htmlFor="headline" className="block text-sm font-medium text-neutral-800">Headline</label><input id="headline" name="headline" defaultValue={form.headline || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <div><label htmlFor="intro_text" className="block text-sm font-medium text-neutral-800">Intro text</label><textarea id="intro_text" name="intro_text" defaultValue={form.intro_text || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <div><label htmlFor="success_message" className="block text-sm font-medium text-neutral-800">Success message</label><textarea id="success_message" name="success_message" defaultValue={form.success_message || ""} className="mt-1 min-h-28 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          <button type="submit" disabled={membership.role === "viewer" || membership.role === "sales"} className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300">Save basics</button>
        </form>
      </section>

      <section className="mt-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-950">Fields</h2>
          <p className="mt-1 text-sm text-neutral-600">Edit labels, helpers, ordering, options, and conditional visibility for each hosted field without touching raw JSON.</p>
        </div>
        {(fields ?? []).map((field) => {
          const updateField = updateFormFieldAction.bind(null, form.id, field.id);
          return (
            <form key={field.id} action={updateField} className="rounded-3xl border border-black/8 bg-white p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{field.field_key}</p>
                  <h3 className="mt-1 text-lg font-semibold text-neutral-950">{field.label}</h3>
                </div>
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-neutral-700">{field.field_type}</span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div><label className="block text-sm font-medium text-neutral-800">Label</label><input name="label" defaultValue={field.label} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label className="block text-sm font-medium text-neutral-800">Sort order</label><input name="sort_order" type="number" defaultValue={field.sort_order} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label className="block text-sm font-medium text-neutral-800">Placeholder</label><input name="placeholder" defaultValue={field.placeholder || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label className="block text-sm font-medium text-neutral-800">Help text</label><input name="help_text" defaultValue={field.help_text || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
                <div><label className="block text-sm font-medium text-neutral-800">Required</label><select name="required" defaultValue={field.required ? "true" : "false"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="true">Required</option><option value="false">Optional</option></select></div>
                <div><label className="block text-sm font-medium text-neutral-800">Active</label><select name="is_active" defaultValue={field.is_active ? "true" : "false"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3"><option value="true">Active</option><option value="false">Hidden</option></select></div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-800">Options</label>
                  <textarea
                    name="option_lines"
                    defaultValue={Array.isArray(field.options_json) ? field.options_json.map((option) => typeof option === "string" ? option : `${option.label || option.value || ""}|${option.value || option.label || ""}`).join("\n") : ""}
                    className="mt-1 min-h-32 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm"
                    placeholder={field.field_type === "select" || field.field_type === "radio" ? "One option per line. Use Label|value for custom values." : "Only needed for select or radio fields."}
                  />
                  <p className="mt-2 text-xs text-neutral-500">Use one option per line. For custom values, write `Label|value`.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-800">Conditional visibility</label>
                  <div className="mt-1 grid gap-3 rounded-2xl border border-neutral-200 p-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Rule enabled</label>
                      <select name="conditional_enabled" defaultValue={field.conditional_logic_json ? "true" : "false"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm">
                        <option value="false">Always show</option>
                        <option value="true">Only show when another field matches</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Field key to watch</label>
                      <input name="conditional_field" defaultValue={typeof field.conditional_logic_json === "object" && field.conditional_logic_json && "showWhen" in field.conditional_logic_json && typeof field.conditional_logic_json.showWhen === "object" && field.conditional_logic_json.showWhen && "field" in field.conditional_logic_json.showWhen ? String(field.conditional_logic_json.showWhen.field || "") : ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm" placeholder="e.g. formula_direction" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Operator</label>
                      <select name="conditional_operator" defaultValue={typeof field.conditional_logic_json === "object" && field.conditional_logic_json && "showWhen" in field.conditional_logic_json && typeof field.conditional_logic_json.showWhen === "object" && field.conditional_logic_json.showWhen && "operator" in field.conditional_logic_json.showWhen ? String(field.conditional_logic_json.showWhen.operator || "equals") : "equals"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm">
                        <option value="equals">Equals one value</option>
                        <option value="in">Matches any in list</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Value or values</label>
                      <input name="conditional_value" defaultValue={typeof field.conditional_logic_json === "object" && field.conditional_logic_json && "showWhen" in field.conditional_logic_json && typeof field.conditional_logic_json.showWhen === "object" && field.conditional_logic_json.showWhen && "value" in field.conditional_logic_json.showWhen ? Array.isArray(field.conditional_logic_json.showWhen.value) ? field.conditional_logic_json.showWhen.value.join(", ") : String(field.conditional_logic_json.showWhen.value || "") : ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm" placeholder="e.g. have_formula, have_ingredients" />
                      <p className="mt-2 text-xs text-neutral-500">Use commas when the operator is `Matches any in list`.</p>
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={membership.role === "viewer" || membership.role === "sales"} className="mt-4 inline-flex rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300">Save field</button>
            </form>
          );
        })}
      </section>
    </div>
  );
}


