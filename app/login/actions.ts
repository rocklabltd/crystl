'use server'

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { authSchema, type AuthFormState } from "@/lib/validators/auth";

async function maybeAssignDefaultWorkspaceOwner(userId: string) {
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

  const { count, error: countError } = await admin
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  if (countError) {
    console.error("Workspace member count error:", countError);
    return false;
  }

  if ((count ?? 0) > 0) {
    return false;
  }

  const { error: insertError } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  });

  if (insertError) {
    console.error("Workspace bootstrap insert error:", insertError);
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      message: "We could not sign you in with those details.",
      values: { email },
    };
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

  if (data.user?.id) {
    await maybeAssignDefaultWorkspaceOwner(data.user.id);
  }

  if (data.session) {
    redirect("/app/dashboard");
  }

  return {
    message: "Account created. You can now sign in.",
    values: { email },
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseActionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
