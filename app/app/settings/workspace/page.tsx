import { requireWorkspaceContext } from "@/lib/auth";

import { updateWorkspaceSettingsAction } from "./actions";

function flashMessage(error?: string, saved?: string) {
  if (saved === "workspace") {
    return { tone: "success", text: "Workspace settings updated." };
  }
  switch (error) {
    case "forbidden":
      return { tone: "error", text: "Only owners can update workspace settings." };
    case "validation":
      return { tone: "error", text: "Please check the workspace values and try again." };
    case "save":
      return { tone: "error", text: "We could not save the workspace settings." };
    default:
      return null;
  }
}

export default async function WorkspaceSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { workspace, membership } = await requireWorkspaceContext();
  const resolvedSearchParams = await searchParams;
  const message = flashMessage(resolvedSearchParams.error, resolvedSearchParams.saved);

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Workspace settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Brand and quoting defaults</h1>
        <p className="mt-2 text-neutral-600">Keep workspace identity and quote defaults aligned for the whole team.</p>
      </div>

      {message ? <p className={["mt-6 rounded-2xl px-4 py-3 text-sm", message.tone === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"].join(" ")}>{message.text}</p> : null}

      <section className="mt-6 rounded-3xl border border-black/8 bg-white p-6">
        <form action={updateWorkspaceSettingsAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="name" className="block text-sm font-medium text-neutral-800">Workspace name</label><input id="name" name="name" defaultValue={workspace.name} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="brand_name" className="block text-sm font-medium text-neutral-800">Brand name</label><input id="brand_name" name="brand_name" defaultValue={workspace.brand_name || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="default_currency" className="block text-sm font-medium text-neutral-800">Default currency</label><input id="default_currency" name="default_currency" defaultValue={workspace.default_currency || "GBP"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="quote_prefix" className="block text-sm font-medium text-neutral-800">Quote prefix</label><input id="quote_prefix" name="quote_prefix" defaultValue={workspace.quote_prefix || "Q"} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="primary_colour" className="block text-sm font-medium text-neutral-800">Primary colour</label><input id="primary_colour" name="primary_colour" defaultValue={workspace.primary_colour || ""} placeholder="#171717" className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
            <div><label htmlFor="logo_url" className="block text-sm font-medium text-neutral-800">Logo URL</label><input id="logo_url" name="logo_url" defaultValue={workspace.logo_url || ""} className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3" /></div>
          </div>
          <button type="submit" disabled={membership.role !== "owner"} className="inline-flex w-fit rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300">Save workspace settings</button>
        </form>
      </section>
    </div>
  );
}
