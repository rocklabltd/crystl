import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { PublicForm } from "./PublicForm";
import { submitPublicForm, type PublicFormField } from "./actions";

type PageParams = {
  workspaceSlug: string;
  formSlug: string;
};

function createSupabaseServerClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { workspaceSlug, formSlug } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .single();

  if (workspaceError) {
    console.error("Workspace query error:", workspaceError);
  }

  if (!workspace) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold">Workspace not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          Checked slug: {workspaceSlug}
        </p>
      </main>
    );
  }

  const { data: form, error: formError } = await supabase
    .from("form_templates")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("slug", formSlug)
    .single();

  if (formError) {
    console.error("Form query error:", formError);
  }

  if (!form) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold">Form not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          Checked form slug: {formSlug}
        </p>
      </main>
    );
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("form_fields")
    .select("*")
    .eq("form_template_id", form.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (fieldsError) {
    console.error("Fields query error:", fieldsError);
  }

  const formAction = submitPublicForm.bind(
    null,
    workspaceSlug,
    formSlug,
    workspace.id,
    form.id,
    (fields ?? []) as PublicFormField[]
  );

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 border-l-4 pl-4" style={{ borderColor: workspace.primary_colour || "#171717" }}>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
          {workspace.brand_name || workspace.name}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{form.headline}</h1>
        <p className="mt-2 text-gray-500">{form.intro_text}</p>
      </div>

      <PublicForm
        action={formAction}
        fields={(fields ?? []) as PublicFormField[]}
        introText={form.intro_text}
        submitButtonText={form.submit_button_text}
      />
    </main>
  );
}
