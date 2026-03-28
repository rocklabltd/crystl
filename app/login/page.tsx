import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getAuthenticatedUser } from "@/lib/auth";

import { loginAction } from "./actions";

export default async function LoginPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/app/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(241,245,249,0.9)_45%,_rgba(226,232,240,0.75))] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center gap-16">
        <div className="hidden max-w-xl lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
            Request To Quote Workspace
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight text-neutral-950">
            Turn inbound requests into clear, quotable work.
          </h1>
          <p className="mt-6 text-lg leading-8 text-neutral-600">
            Crystl helps your team receive structured enquiries, turn them into opportunities, and move them through pricing and quoting without the usual admin drag.
          </p>
        </div>

        <AuthForm
          action={loginAction}
          ctaHref="/signup"
          ctaLabel="Create one"
          mode="login"
          subtitle="Sign in to access your workspace dashboard, opportunities, and request pipeline."
          title="Welcome back"
        />
      </div>
    </main>
  );
}
