'use server'

import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { workspaceMemberRoleSchema } from "@/lib/validators/settings";

export async function updateWorkspaceMemberRoleAction(memberId: string, formData: FormData) {
  const { workspace, membership, user } = await requireWorkspaceContext();

  if (membership.role !== "owner") {
    redirect("/app/settings/team?error=forbidden");
  }

  const parsed = workspaceMemberRoleSchema.safeParse({
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect("/app/settings/team?error=validation");
  }

  const supabase = await createSupabaseActionClient();
  const { data: targetMembership, error: targetError } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspace.id)
    .single();

  if (targetError || !targetMembership) {
    redirect("/app/settings/team?error=save");
  }

  if (targetMembership.role === "owner" && parsed.data.role !== "owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      redirect("/app/settings/team?error=last-owner");
    }
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("id", memberId)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("Workspace member role update error:", error);
    redirect("/app/settings/team?error=save");
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: null,
    user_id: user.id,
    activity_type: "workspace_member_role_updated",
    activity_text: `Workspace member role updated to ${parsed.data.role}`,
    metadata_json: { workspace_member_id: memberId, role: parsed.data.role },
  });

  redirect("/app/settings/team?saved=role");
}
