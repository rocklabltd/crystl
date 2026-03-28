'use server'

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validatePublicFormSubmission } from "@/lib/validators/public-form";

export type PublicFormField = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  options_json: unknown;
  conditional_logic_json: unknown;
};

export type PublicFormState = {
  fieldErrors: Record<string, string>;
  message: string | null;
  values: Record<string, string>;
};

export const initialPublicFormState: PublicFormState = {
  fieldErrors: {},
  message: null,
  values: {},
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

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function submitPublicForm(
  workspaceSlug: string,
  formSlug: string,
  workspaceId: string,
  formId: string,
  fields: PublicFormField[],
  _prevState: PublicFormState,
  formData: FormData
) {
  const actionCookieStore = await cookies();
  const actionSupabase = createSupabaseServerClient(actionCookieStore);
  const validation = validatePublicFormSubmission(fields, formData);

  if (!validation.success) {
    return {
      fieldErrors: validation.fieldErrors,
      message: "Please check the highlighted fields and try again.",
      values: validation.payload,
    };
  }

  const payload = validation.payload;
  const emailField = fields.find(
    (field) => field.field_key === "email" || field.field_type === "email"
  );
  const fullName = payload.full_name ?? "";
  const { firstName, lastName } = splitFullName(fullName);
  const email = emailField ? payload[emailField.field_key] ?? "" : "";

  const { data: contactId, error: contactError } = await actionSupabase.rpc(
    "handle_contact_upsert",
    {
      p_workspace_id: workspaceId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: payload.phone ?? "",
      p_company_name: payload.brand_or_company_name ?? "",
      p_country: payload.country ?? "",
    }
  );

  if (contactError || !contactId) {
    console.error("Contact upsert error:", contactError);
    return {
      fieldErrors: {},
      message: "We could not save your contact details. Please try again.",
      values: payload,
    };
  }

  const { error: requestError } = await actionSupabase.from("requests").insert({
    workspace_id: workspaceId,
    form_template_id: formId,
    contact_id: contactId,
    source: "website_form",
    status: "submitted",
    raw_payload_json: payload,
  });

  if (requestError) {
    console.error("Request insert error:", requestError);
    return {
      fieldErrors: {},
      message: "We could not submit your request. Please try again.",
      values: payload,
    };
  }

  redirect(`/w/${workspaceSlug}/f/${formSlug}/success`);
}
