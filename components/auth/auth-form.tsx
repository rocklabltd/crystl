'use client'

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { AuthFormState } from "@/lib/validators/auth";

type AuthFormProps = {
  action: (state: AuthFormState | void, formData: FormData) => Promise<AuthFormState | void>;
  ctaHref: string;
  ctaLabel: string;
  mode: "login" | "signup";
  subtitle: string;
  title: string;
};

const initialState: AuthFormState = {
  values: {
    name: "",
    email: "",
  },
};

function initialValues(mode: "login" | "signup") {
  return {
    name: "",
    email: "",
    password: "",
    ...(mode === "signup" ? { name: "" } : {}),
  };
}

export function AuthForm({
  action,
  ctaHref,
  ctaLabel,
  mode,
  subtitle,
  title,
}: AuthFormProps) {
  const [maybeState, formAction, pending] = useActionState(action, initialState);
  const state = maybeState ?? initialState;
  const values = {
    ...initialValues(mode),
    ...(state.values ?? {}),
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-[0_30px_80px_rgba(0,0,0,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
        Crystl V1
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-neutral-950">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{subtitle}</p>

      <form action={formAction} className="mt-8 space-y-4">
        {mode === "signup" ? (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-800">
              Full name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={values.name}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-neutral-400"
              placeholder="Jane Smith"
            />
            {state.errors?.name?.[0] ? (
              <p className="mt-1 text-sm text-red-700">{state.errors.name[0]}</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-neutral-400"
            placeholder="you@company.com"
            required
          />
          {state.errors?.email?.[0] ? (
            <p className="mt-1 text-sm text-red-700">{state.errors.email[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-neutral-400"
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            required
          />
          {state.errors?.password?.[0] ? (
            <p className="mt-1 text-sm text-red-700">{state.errors.password[0]}</p>
          ) : null}
        </div>

        {state.message ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
          {pending
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
        <Link href={ctaHref} className="font-medium text-neutral-950 underline underline-offset-4">
          {ctaLabel}
        </Link>
      </p>
    </div>
  );
}
