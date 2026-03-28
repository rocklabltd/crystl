import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

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
  workspaces: WorkspaceRecord | WorkspaceRecord[] | null;
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

  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "workspace_id, role, workspaces(id, name, slug, brand_name, primary_colour, logo_url, quote_prefix, default_currency)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Workspace membership query error:", error);
    return null;
  }

  const memberships = (data ?? []) as WorkspaceMembershipRecord[];
  if (memberships.length === 0) {
    return { user, membership: null, workspace: null };
  }

  const preferredWorkspaceSlug = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG;
  const membership =
    memberships.find((entry) => {
      const workspace = Array.isArray(entry.workspaces)
        ? entry.workspaces[0]
        : entry.workspaces;

      return workspace?.slug === preferredWorkspaceSlug;
    }) ?? memberships[0];

  const workspace = Array.isArray(membership.workspaces)
    ? membership.workspaces[0] ?? null
    : membership.workspaces;

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
