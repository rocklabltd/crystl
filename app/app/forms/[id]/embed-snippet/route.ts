import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/\"/g, "&quot;");
}

export async function GET(request: Request, { params }: RouteContext) {
  const { workspace } = await requireWorkspaceContext();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: form, error } = await supabase
    .from("form_templates")
    .select("id, name, slug")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !form) {
    return new Response("Form not found", { status: 404 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const publicFormUrl = `${appUrl}/w/${workspace.slug}/f/${form.slug}`;
  const escapedUrl = escapeAttribute(publicFormUrl);
  const escapedTitle = escapeAttribute(`${workspace.brand_name || workspace.name} ${form.name}`);

  const mode = new URL(request.url).searchParams.get("mode") || "iframe";

  const snippet = mode === "button"
    ? `<!-- Crystl hosted form button -->\n<a href="${escapedUrl}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:14px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;">Request a quote</a>\n`
    : `<!-- Crystl hosted form embed -->\n<div id="crystl-form-${form.slug}"></div>\n<script>\n(function () {\n  var container = document.getElementById("crystl-form-${form.slug}");\n  if (!container) return;\n\n  var iframe = document.createElement("iframe");\n  iframe.src = "${escapedUrl}";\n  iframe.title = "${escapedTitle}";\n  iframe.loading = "lazy";\n  iframe.style.width = "100%";\n  iframe.style.minHeight = "1100px";\n  iframe.style.border = "0";\n  iframe.style.background = "transparent";\n\n  container.appendChild(iframe);\n})();\n</script>\n<noscript>\n  <a href="${escapedUrl}" target="_blank" rel="noreferrer">Open the form</a>\n</noscript>\n`;

  const filename = mode === "button"
    ? `crystl-${form.slug}-button-snippet.html`
    : `crystl-${form.slug}-embed-snippet.html`;

  return new Response(snippet, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
