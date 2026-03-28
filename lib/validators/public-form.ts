import { z } from "zod";

export type PublicFormField = {
  field_key: string;
  field_type: string;
  label: string;
  required: boolean;
  conditional_logic_json?: unknown;
};

type ConditionalRule = {
  showWhen?: {
    field?: string;
    operator?: string;
    value?: unknown;
  };
};

function normaliseValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isFieldVisible(
  field: Pick<PublicFormField, "conditional_logic_json">,
  payload: Record<string, string>
) {
  const rule = field.conditional_logic_json as ConditionalRule | null;
  const showWhen = rule?.showWhen;

  if (!showWhen?.field || !showWhen.operator) {
    return true;
  }

  const actualValue = payload[showWhen.field] ?? "";

  if (showWhen.operator === "in" && Array.isArray(showWhen.value)) {
    return showWhen.value.includes(actualValue);
  }

  if (showWhen.operator === "equals" && typeof showWhen.value === "string") {
    return actualValue === showWhen.value;
  }

  return true;
}

function buildFieldSchema(field: PublicFormField) {
  if (field.field_type === "email") {
    return z.string().email(`${field.label} must be a valid email address`);
  }

  if (field.field_type === "number") {
    return z
      .string()
      .refine((value) => value === "" || !Number.isNaN(Number(value)), {
        message: `${field.label} must be a valid number`,
      });
  }

  return z.string();
}

export function validatePublicFormSubmission(
  fields: PublicFormField[],
  formData: FormData
) {
  const payload = Object.fromEntries(
    fields.map((field) => [field.field_key, normaliseValue(formData.get(field.field_key))])
  ) as Record<string, string>;

  const fieldErrors: Record<string, string> = {};

  for (const field of fields) {
    if (!isFieldVisible(field, payload)) {
      payload[field.field_key] = "";
      continue;
    }

    if (field.required && !payload[field.field_key]) {
      fieldErrors[field.field_key] = `${field.label} is required`;
      continue;
    }

    if (!payload[field.field_key]) {
      continue;
    }

    const result = buildFieldSchema(field).safeParse(payload[field.field_key]);

    if (!result.success) {
      fieldErrors[field.field_key] = result.error.issues[0]?.message || `${field.label} is invalid`;
    }
  }

  return {
    payload,
    fieldErrors,
    success: Object.keys(fieldErrors).length === 0,
  };
}
