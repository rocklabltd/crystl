import { requireAuthenticatedUser } from "@/lib/auth";

export default async function NoWorkspacePage() {
  const user = await requireAuthenticatedUser();

  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
        Workspace status
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-neutral-950">
        Your account is signed in, but it is not linked to a workspace yet.
      </h1>
      <p className="mt-4 text-neutral-600">
        Ask a workspace owner to add <span className="font-medium text-neutral-900">{user.email}</span> as a team member, or use the first local signup flow to bootstrap the default workspace owner.
      </p>
    </div>
  );
}
