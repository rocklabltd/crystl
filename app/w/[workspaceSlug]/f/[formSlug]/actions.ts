'use server'

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validatePublicFormSubmission } from "@/lib/validators/public-form";

import type { PublicFormField, PublicFormState } from "./form-state";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

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

function normalizeFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : "";
  const safeBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${safeBaseName || "attachment"}${extension}`;
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
  const attachment = formData.get("attachment");

  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_FILE_SIZE_BYTES) {
      return {
        fieldErrors: {},
        message: "Attachments must be 10 MB or smaller.",
        values: payload,
      };
    }

    if (!ALLOWED_FILE_TYPES.has(attachment.type)) {
      return {
        fieldErrors: {},
        message: "That attachment type is not allowed.",
        values: payload,
      };
    }
  }

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

  const requestId = crypto.randomUUID();
  let uploadedFile:
    | {
        storagePath: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      }
    | null = null;

  if (attachment instanceof File && attachment.size > 0) {
    const normalizedName = normalizeFileName(attachment.name);
    const storagePath = `${workspaceId}/requests/${requestId}/${Date.now()}-${normalizedName}`;
    const fileBuffer = Buffer.from(await attachment.arrayBuffer());

    const { error: uploadError } = await actionSupabase.storage
      .from("workspace-files")
      .upload(storagePath, fileBuffer, {
        contentType: attachment.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Public form attachment upload error:", uploadError);
      return {
        fieldErrors: {},
        message: "We could not upload your attachment. Please try again.",
        values: payload,
      };
    }

    uploadedFile = {
      storagePath,
      fileName: attachment.name,
      mimeType: attachment.type,
      fileSize: attachment.size,
    };
    payload.attachment_file_name = attachment.name;
  }

  const { error: requestError } = await actionSupabase.from("requests").insert({
    id: requestId,
    workspace_id: workspaceId,
    form_template_id: formId,
    contact_id: contactId,
    source: "website_form",
    status: "submitted",
    raw_payload_json: payload,
  });

  if (requestError) {
    console.error("Request insert error:", requestError);

    if (uploadedFile) {
      await actionSupabase.storage.from("workspace-files").remove([uploadedFile.storagePath]);
    }

    return {
      fieldErrors: {},
      message: "We could not submit your request. Please try again.",
      values: payload,
    };
  }

  if (uploadedFile) {
    const { error: fileError } = await actionSupabase.from("files").insert({
      workspace_id: workspaceId,
      request_id: requestId,
      storage_path: uploadedFile.storagePath,
      file_name: uploadedFile.fileName,
      mime_type: uploadedFile.mimeType,
      file_size: uploadedFile.fileSize,
      uploaded_by_user_id: null,
    });

    if (fileError) {
      console.error("Public form file record insert error:", fileError);
      await actionSupabase.storage.from("workspace-files").remove([uploadedFile.storagePath]);
    }
  }

  redirect(`/w/${workspaceSlug}/f/${formSlug}/success`);
}
