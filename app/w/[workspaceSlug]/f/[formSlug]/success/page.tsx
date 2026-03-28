import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export default async function PublicFormSuccessPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { workspaceSlug, formSlug } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, brand_name, primary_colour")
    .eq("slug", workspaceSlug)
    .single();

  const { data: form } = await supabase
    .from("form_templates")
    .select("headline, success_message")
    .eq("workspace_id", workspace?.id ?? "")
    .eq("slug", formSlug)
    .single();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center p-8">
      <div className="w-full rounded-2xl border bg-white p-8 shadow-sm">
        <div className="border-l-4 pl-4" style={{ borderColor: workspace?.primary_colour || "#171717" }}>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
            {workspace?.brand_name || workspace?.name || "Crystl"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Request received</h1>
        </div>

        <p className="mt-6 text-gray-700">
          {form?.success_message || "Thanks, your request has been received. We will review it and come back to you shortly."}
        </p>

        <p className="mt-4 text-sm text-gray-500">
          You can close this page now, or go back if you need to submit another request.
        </p>

        <a
          href={`/w/${workspaceSlug}/f/${formSlug}`}
          className="mt-6 inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Submit another request
        </a>
      </div>
    </main>
  );
}
