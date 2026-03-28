import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  primary_colour: string | null;
  logo_url: string | null;
  quote_prefix: string | null;
  default_currency: string | null;
};

type WorkspaceMembershipRecord = {
  workspace_id: string;
  role: string;
};

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export const getCurrentWorkspaceContext = cache(async () => {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: membershipRows, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.error("Workspace membership query error:", {
      message: membershipError.message,
      code: membershipError.code,
      details: membershipError.details,
      hint: membershipError.hint,
    });
    return { user, membership: null, workspace: null };
  }

  const memberships = (membershipRows ?? []) as WorkspaceMembershipRecord[];
  if (memberships.length === 0) {
    return { user, membership: null, workspace: null };
  }

  const workspaceIds = memberships.map((membership) => membership.workspace_id);
  const { data: workspaceRows, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, name, slug, brand_name, primary_colour, logo_url, quote_prefix, default_currency")
    .in("id", workspaceIds);

  if (workspaceError) {
    console.error("Workspace lookup error:", {
      message: workspaceError.message,
      code: workspaceError.code,
      details: workspaceError.details,
      hint: workspaceError.hint,
    });
    return { user, membership: null, workspace: null };
  }

  const workspaceMap = new Map(((workspaceRows ?? []) as WorkspaceRecord[]).map((workspace) => [workspace.id, workspace]));
  const preferredWorkspaceSlug = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG;
  const membership =
    memberships.find((entry) => {
      const workspace = workspaceMap.get(entry.workspace_id);
      return workspace?.slug === preferredWorkspaceSlug;
    }) ?? memberships[0];

  const workspace = workspaceMap.get(membership.workspace_id) ?? null;

  return {
    user,
    membership: {
      workspace_id: membership.workspace_id,
      role: membership.role,
    },
    workspace,
  };
});

export async function requireWorkspaceContext() {
  const context = await getCurrentWorkspaceContext();

  if (!context?.user) {
    redirect("/login");
  }

  if (!context.workspace || !context.membership) {
    redirect("/app/no-workspace");
  }

  return context as {
    user: NonNullable<typeof context.user>;
    membership: NonNullable<typeof context.membership>;
    workspace: NonNullable<typeof context.workspace>;
  };
}
