'use client'

import { useActionState, useState } from "react";

import {
  initialPublicFormState,
  type PublicFormField,
  type PublicFormState,
} from "./actions";

type PublicFormProps = {
  action: (state: PublicFormState, formData: FormData) => Promise<PublicFormState>;
  fields: PublicFormField[];
  introText: string | null;
  submitButtonText: string | null;
};

function getFieldOptions(options: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.flatMap((option) => {
    if (typeof option === "string") {
      return [{ label: option, value: option }];
    }

    if (
      option &&
      typeof option === "object" &&
      "label" in option &&
      "value" in option &&
      typeof option.label === "string" &&
      typeof option.value === "string"
    ) {
      return [{ label: option.label, value: option.value }];
    }

    return [];
  });
}

function getInputType(fieldType: string) {
  switch (fieldType) {
    case "email":
      return "email";
    case "phone":
      return "tel";
    case "number":
      return "number";
    default:
      return "text";
  }
}

function isFieldVisible(field: PublicFormField, values: Record<string, string>) {
  const rule = field.conditional_logic_json as
    | {
        showWhen?: {
          field?: string;
          operator?: string;
          value?: unknown;
        };
      }
    | null;
  const showWhen = rule?.showWhen;

  if (!showWhen?.field || !showWhen.operator) {
    return true;
  }

  const actualValue = values[showWhen.field] ?? "";

  if (showWhen.operator === "in" && Array.isArray(showWhen.value)) {
    return showWhen.value.includes(actualValue);
  }

  if (showWhen.operator === "equals" && typeof showWhen.value === "string") {
    return actualValue === showWhen.value;
  }

  return true;
}

function buildInitialValues(fields: PublicFormField[], stateValues: Record<string, string>) {
  return Object.fromEntries(
    fields.map((field) => [field.field_key, stateValues[field.field_key] ?? ""])
  ) as Record<string, string>;
}

export function PublicForm({
  action,
  fields,
  introText,
  submitButtonText,
}: PublicFormProps) {
  const [state, formAction, pending] = useActionState(action, initialPublicFormState);
  const formStateKey = JSON.stringify(state.values);

  return (
    <PublicFormFields
      key={formStateKey}
      fields={fields}
      formAction={formAction}
      introText={introText}
      pending={pending}
      state={state}
      submitButtonText={submitButtonText}
    />
  );
}

type PublicFormFieldsProps = {
  fields: PublicFormField[];
  formAction: (formData: FormData) => void;
  introText: string | null;
  pending: boolean;
  state: PublicFormState;
  submitButtonText: string | null;
};

function PublicFormFields({
  fields,
  formAction,
  introText,
  pending,
  state,
  submitButtonText,
}: PublicFormFieldsProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(fields, state.values)
  );

  function setFieldValue(fieldKey: string, nextValue: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldKey]: nextValue,
    }));
  }

  function renderField(field: PublicFormField) {
    const options = getFieldOptions(field.options_json);
    const value = values[field.field_key] ?? "";
    const error = state.fieldErrors[field.field_key];
    const describedBy = [
      field.help_text ? `${field.field_key}-help` : null,
      error ? `${field.field_key}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    if (!isFieldVisible(field, values)) {
      return null;
    }

    if (field.field_type === "long_text") {
      return (
        <>
          <textarea
            id={field.field_key}
            name={field.field_key}
            className="mt-1 min-h-28 w-full rounded border px-3 py-2"
            placeholder={field.placeholder || ""}
            required={field.required}
            value={value}
            onChange={(event) => setFieldValue(field.field_key, event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
          />
          {field.help_text ? (
            <p id={`${field.field_key}-help`} className="mt-1 text-xs text-gray-500">
              {field.help_text}
            </p>
          ) : null}
          {error ? (
            <p id={`${field.field_key}-error`} className="mt-1 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </>
      );
    }

    if (field.field_type === "select") {
      return (
        <>
          <select
            id={field.field_key}
            name={field.field_key}
            className="mt-1 w-full rounded border px-3 py-2"
            required={field.required}
            value={value}
            onChange={(event) => setFieldValue(field.field_key, event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
          >
            <option value="" disabled>
              {field.placeholder || `Select ${field.label.toLowerCase()}`}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.help_text ? (
            <p id={`${field.field_key}-help`} className="mt-1 text-xs text-gray-500">
              {field.help_text}
            </p>
          ) : null}
          {error ? (
            <p id={`${field.field_key}-error`} className="mt-1 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </>
      );
    }

    if (field.field_type === "radio") {
      return (
        <>
          <div className="mt-2 space-y-2" aria-describedby={describedBy || undefined}>
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.field_key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(event) => setFieldValue(field.field_key, event.target.value)}
                  required={field.required}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {field.help_text ? (
            <p id={`${field.field_key}-help`} className="mt-1 text-xs text-gray-500">
              {field.help_text}
            </p>
          ) : null}
          {error ? (
            <p id={`${field.field_key}-error`} className="mt-1 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </>
      );
    }

    return (
      <>
        <input
          id={field.field_key}
          name={field.field_key}
          type={getInputType(field.field_type)}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder={field.placeholder || ""}
          required={field.required}
          value={value}
          onChange={(event) => setFieldValue(field.field_key, event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
        />
        {field.help_text ? (
          <p id={`${field.field_key}-help`} className="mt-1 text-xs text-gray-500">
            {field.help_text}
          </p>
        ) : null}
        {error ? (
          <p id={`${field.field_key}-error`} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.message ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      {fields.map((field) =>
        isFieldVisible(field, values) ? (
          <div key={field.id}>
            <label htmlFor={field.field_key} className="block text-sm font-medium">
              {field.label}
            </label>
            {renderField(field)}
          </div>
        ) : null
      )}

      <p className="text-sm text-gray-500">
        {introText
          ? "Your request goes straight to the team for review. We will come back with the best next step for formulation and manufacturing."
          : "Your request goes straight to the team for review."}
      </p>

      <button
        type="submit"
        className="mt-4 w-full rounded bg-black py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Submitting..." : submitButtonText || "Submit request"}
      </button>
    </form>
  );
}
