'use server'

import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import { formFieldSchema, formTemplateBasicsSchema } from "@/lib/validators/settings";

async function requireEditableForm(formId: string) {
  const context = await requireWorkspaceContext();

  if (context.membership.role === "viewer" || context.membership.role === "sales") {
    redirect(`/app/forms/${formId}?error=forbidden`);
  }

  const supabase = await createSupabaseActionClient();
  const { data: form, error } = await supabase
    .from("form_templates")
    .select("id, workspace_id, name")
    .eq("id", formId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (error || !form) {
    redirect("/app/forms?error=not-found");
  }

  return { ...context, supabase, form };
}

export async function updateFormTemplateBasicsAction(formId: string, formData: FormData) {
  const { supabase } = await requireEditableForm(formId);

  const parsed = formTemplateBasicsSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status"),
    headline: formData.get("headline"),
    intro_text: formData.get("intro_text"),
    success_message: formData.get("success_message"),
    submit_button_text: formData.get("submit_button_text"),
  });

  if (!parsed.success) {
    redirect(`/app/forms/${formId}?error=validation`);
  }

  const { error } = await supabase
    .from("form_templates")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      headline: parsed.data.headline || null,
      intro_text: parsed.data.intro_text || null,
      success_message: parsed.data.success_message || null,
      submit_button_text: parsed.data.submit_button_text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId);

  if (error) {
    console.error("Form template update error:", error);
    redirect(`/app/forms/${formId}?error=save`);
  }

  redirect(`/app/forms/${formId}?saved=basics`);
}

export async function updateFormFieldAction(formId: string, fieldId: string, formData: FormData) {
  const { supabase } = await requireEditableForm(formId);

  const parsed = formFieldSchema.safeParse({
    label: formData.get("label"),
    placeholder: formData.get("placeholder"),
    help_text: formData.get("help_text"),
    required: formData.get("required") ?? "false",
    is_active: formData.get("is_active") ?? "false",
    sort_order: formData.get("sort_order"),
    option_lines: formData.get("option_lines"),
    conditional_enabled: formData.get("conditional_enabled") ?? "false",
    conditional_field: formData.get("conditional_field"),
    conditional_operator: formData.get("conditional_operator") ?? "equals",
    conditional_value: formData.get("conditional_value"),
  });

  if (!parsed.success) {
    redirect(`/app/forms/${formId}?error=validation`);
  }

  const sortOrder = Number(parsed.data.sort_order);
  if (!Number.isFinite(sortOrder)) {
    redirect(`/app/forms/${formId}?error=validation`);
  }

  const optionLines = (parsed.data.option_lines || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const optionsJson = optionLines.length
    ? optionLines.map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          return { label: parts[0], value: parts[1] };
        }

        return line;
      })
    : null;

  let conditionalLogicJson = null;
  if (parsed.data.conditional_enabled === "true" && parsed.data.conditional_field && parsed.data.conditional_value) {
    const values = parsed.data.conditional_operator === "in"
      ? parsed.data.conditional_value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : parsed.data.conditional_value.trim();

    conditionalLogicJson = {
      showWhen: {
        field: parsed.data.conditional_field,
        operator: parsed.data.conditional_operator,
        value: values,
      },
    };
  }

  const { error } = await supabase
    .from("form_fields")
    .update({
      label: parsed.data.label,
      placeholder: parsed.data.placeholder || null,
      help_text: parsed.data.help_text || null,
      required: parsed.data.required === "true",
      is_active: parsed.data.is_active === "true",
      sort_order: sortOrder,
      options_json: optionsJson,
      conditional_logic_json: conditionalLogicJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fieldId)
    .eq("form_template_id", formId);

  if (error) {
    console.error("Form field update error:", error);
    redirect(`/app/forms/${formId}?error=save`);
  }

  redirect(`/app/forms/${formId}?saved=field`);
}
