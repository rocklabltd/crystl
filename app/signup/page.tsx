import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getAuthenticatedUser } from "@/lib/auth";

import { signupAction } from "@/app/login/actions";

export default async function SignupPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/app/dashboard");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_rgba(250,250,249,1),_rgba(245,245,244,1)_48%,_rgba(231,229,228,0.85))] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center gap-16">
        <div className="hidden max-w-xl lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
            Supplement Lab Ready
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight text-neutral-950">
            Create your first workspace login and start handling live requests.
          </h1>
          <p className="mt-6 text-lg leading-8 text-neutral-600">
            In local setup, the first account can automatically become the owner of the default workspace so you can get straight into the request-to-quote workflow.
          </p>
        </div>

        <AuthForm
          action={signupAction}
          ctaHref="/login"
          ctaLabel="Sign in"
          mode="signup"
          subtitle="Create an internal account for your workspace team."
          title="Create account"
        />
      </div>
    </main>
  );
}
