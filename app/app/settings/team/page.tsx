import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { updateWorkspaceMemberRoleAction } from "./actions";

type MemberRecord = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function flashMessage(error?: string, saved?: string) {
  if (saved === "role") {
    return { tone: "success", text: "Team member role updated." };
  }
  switch (error) {
    case "forbidden":
      return { tone: "error", text: "Only owners can manage workspace roles." };
    case "validation":
      return { tone: "error", text: "Please choose a valid role." };
    case "last-owner":
      return { tone: "error", text: "You must keep at least one owner in the workspace." };
    case "save":
      return { tone: "error", text: "We could not save that role change." };
    default:
      return null;
  }
}

export default async function TeamSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { workspace, membership, user } = await requireWorkspaceContext();
  const resolvedSearchParams = await searchParams;
  const message = flashMessage(resolvedSearchParams.error, resolvedSearchParams.saved);
  const supabase = createSupabaseAdminClient();

  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const members = (memberRows ?? []) as MemberRecord[];
  const userIds = members.map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as ProfileRecord[] };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div>
      <div className="border-b border-black/8 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Team settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-950">Workspace members</h1>
        <p className="mt-2 text-neutral-600">Review access levels for everyone working in {workspace.brand_name || workspace.name}.</p>
      </div>

      {message ? <p className={["mt-6 rounded-2xl px-4 py-3 text-sm", message.tone === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"].join(" ")}>{message.text}</p> : null}

      <div className="mt-6 overflow-hidden rounded-3xl border border-black/8 bg-white">
        <div className="grid grid-cols-[1.2fr_1fr_180px_140px] gap-4 border-b border-black/8 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span>Member</span>
          <span>Email</span>
          <span>Role</span>
          <span>Joined</span>
        </div>
        {members.length ? (
          members.map((member) => {
            const profile = profileMap.get(member.user_id);
            const updateRole = updateWorkspaceMemberRoleAction.bind(null, member.id);

            return (
              <div key={member.id} className="grid grid-cols-[1.2fr_1fr_180px_140px] gap-4 border-b border-black/6 px-6 py-4 text-sm last:border-b-0">
                <div>
                  <p className="font-medium text-neutral-950">{profile?.full_name || "Unnamed teammate"}</p>
                  {member.user_id === user.id ? <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500">You</p> : null}
                </div>
                <div className="text-neutral-700">{profile?.email || "No email"}</div>
                <form action={updateRole}>
                  <select name="role" defaultValue={member.role} disabled={membership.role !== "owner"} className="w-full rounded-xl border border-neutral-200 px-4 py-3 disabled:cursor-not-allowed disabled:bg-neutral-100">
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="sales">Sales</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {membership.role === "owner" ? <button type="submit" className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 underline underline-offset-4">Save role</button> : null}
                </form>
                <div className="text-neutral-700">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(member.created_at))}</div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-neutral-600">No workspace members found.</div>
        )}
      </div>
    </div>
  );
}
