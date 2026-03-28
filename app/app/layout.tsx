import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { getCurrentWorkspaceContext, requireAuthenticatedUser } from "@/lib/auth";

const navigation = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/opportunities", label: "Opportunities" },
  { href: "/app/requests", label: "Requests" },
  { href: "/app/contacts", label: "Contacts" },
  { href: "/app/forms", label: "Forms" },
  { href: "/app/settings/workspace", label: "Workspace settings" },
  { href: "/app/settings/team", label: "Team settings" },
];

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuthenticatedUser();
  const context = await getCurrentWorkspaceContext();

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 lg:flex-row lg:gap-6 lg:px-6">
        <aside className="w-full rounded-[28px] bg-[#1b1713] p-6 text-[#f8f4ec] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72 lg:flex-none">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#b9a995]">Crystl V1</p>
            <h2 className="mt-4 text-2xl font-semibold">
              {context?.workspace?.brand_name || context?.workspace?.name || "Workspace"}
            </h2>
            <p className="mt-2 text-sm text-[#d7cab8]">
              {context?.workspace?.slug || "No workspace linked yet"}
            </p>
          </div>

          <nav className="mt-10 space-y-2 text-sm">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-3 transition hover:bg-white/8">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#e8ddcf]">
            <p className="font-medium">Signed in as</p>
            <p className="mt-1 break-all text-[#d7cab8]">{user.email}</p>
            {context?.membership ? (
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[#b9a995]">
                Role: {context.membership.role}
              </p>
            ) : null}
          </div>

          <form action={signOutAction} className="mt-4">
            <button
              type="submit"
              className="w-full rounded-xl border border-white/15 px-4 py-3 text-left text-sm transition hover:bg-white/8"
            >
              Sign out
            </button>
          </form>
        </aside>

        <div className="mt-4 flex-1 lg:mt-0">
          <div className="rounded-[32px] border border-black/8 bg-[#fcfaf7] p-6 shadow-[0_30px_80px_rgba(24,24,27,0.06)] lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
