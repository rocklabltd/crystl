'use server'

import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { workspaceSettingsSchema } from "@/lib/validators/settings";

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const { workspace, membership } = await requireWorkspaceContext();

  if (membership.role !== "owner") {
    redirect("/app/settings/workspace?error=forbidden");
  }

  const parsed = workspaceSettingsSchema.safeParse({
    name: formData.get("name"),
    brand_name: formData.get("brand_name"),
    default_currency: formData.get("default_currency"),
    quote_prefix: formData.get("quote_prefix"),
    primary_colour: String(formData.get("primary_colour") ?? "").trim(),
    logo_url: String(formData.get("logo_url") ?? "").trim(),
  });

  if (!parsed.success) {
    redirect("/app/settings/workspace?error=validation");
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      name: parsed.data.name,
      brand_name: parsed.data.brand_name || null,
      default_currency: parsed.data.default_currency,
      quote_prefix: parsed.data.quote_prefix,
      primary_colour: parsed.data.primary_colour || null,
      logo_url: parsed.data.logo_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.id);

  if (error) {
    console.error("Workspace settings update error:", error);
    redirect("/app/settings/workspace?error=save");
  }

  redirect("/app/settings/workspace?saved=workspace");
}
