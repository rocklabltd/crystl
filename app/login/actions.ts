'use server'

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { authSchema, type AuthFormState } from "@/lib/validators/auth";

async function ensureDefaultWorkspaceMembership(userId: string) {
  const workspaceSlug = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG;
  if (!workspaceSlug) {
    return false;
  }

  const admin = createSupabaseAdminClient();
  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceError || !workspace) {
    console.error("Workspace bootstrap lookup error:", workspaceError);
    return false;
  }

  const { data: existingMembership, error: existingMembershipError } = await admin
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembershipError) {
    console.error("Workspace membership lookup error:", existingMembershipError);
    return false;
  }

  if (existingMembership) {
    return true;
  }

  const { count, error: countError } = await admin
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  if (countError) {
    console.error("Workspace member count error:", countError);
    return false;
  }

  const role = (count ?? 0) > 0 ? "sales" : "owner";
  const { error: insertError } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role,
  });

  if (insertError) {
    console.error("Workspace bootstrap insert error:", insertError);
    return false;
  }

  return true;
}

function isLocalAppEnv() {
  return (process.env.APP_ENV || "").toLowerCase() === "local";
}

async function autoConfirmLocalUserByEmail(email: string) {
  if (!isLocalAppEnv()) {
    return false;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();

  if (error) {
    console.error("Local auth user lookup error:", error);
    return false;
  }

  const targetUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!targetUser?.id) {
    return false;
  }

  const { error: confirmError } = await admin.auth.admin.updateUserById(targetUser.id, {
    email_confirm: true,
  });

  if (confirmError) {
    console.error("Local auth confirm error:", confirmError);
    return false;
  }

  return true;
}

export async function loginAction(
  _state: AuthFormState | void,
  formData: FormData
): Promise<AuthFormState | void> {
  const validatedFields = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      values: {
        email: String(formData.get("email") ?? "").trim(),
      },
    };
  }

  const { email, password } = validatedFields.data;
  const supabase = await createSupabaseActionClient();
  let signInResult = await supabase.auth.signInWithPassword({ email, password });

  if (signInResult.error && signInResult.error.message.toLowerCase().includes("email not confirmed")) {
    const confirmed = await autoConfirmLocalUserByEmail(email);
    if (confirmed) {
      signInResult = await supabase.auth.signInWithPassword({ email, password });
    }
  }

  if (signInResult.error) {
    return {
      message: signInResult.error.message.toLowerCase().includes("email not confirmed")
        ? "This account still needs email confirmation. In local mode, try signing in one more time."
        : "We could not sign you in with those details.",
      values: { email },
    };
  }

  if (isLocalAppEnv() && signInResult.data.user?.id) {
    await ensureDefaultWorkspaceMembership(signInResult.data.user.id);
  }

  redirect("/app/dashboard");
}

export async function signupAction(
  _state: AuthFormState | void,
  formData: FormData
): Promise<AuthFormState | void> {
  const validatedFields = authSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      values: {
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
      },
    };
  }

  const { name, email, password } = validatedFields.data;
  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name || email,
      },
    },
  });

  if (error) {
    return {
      message: error.message,
      values: { name, email },
    };
  }

  if (data.user?.id && isLocalAppEnv()) {
    await ensureDefaultWorkspaceMembership(data.user.id);
  }

  if (!data.session && isLocalAppEnv()) {
    const confirmed = await autoConfirmLocalUserByEmail(email);

    if (confirmed) {
      const signInResult = await supabase.auth.signInWithPassword({ email, password });

      if (!signInResult.error) {
        if (signInResult.data.user?.id) {
          await ensureDefaultWorkspaceMembership(signInResult.data.user.id);
        }
        redirect("/app/dashboard");
      }
    }
  }

  if (data.session) {
    if (data.user?.id && isLocalAppEnv()) {
      await ensureDefaultWorkspaceMembership(data.user.id);
    }
    redirect("/app/dashboard");
  }

  return {
    message: isLocalAppEnv()
      ? "Account created, but we could not start the session automatically. Try signing in now."
      : "Account created. Check your email to confirm the account before signing in.",
    values: { email },
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseActionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
