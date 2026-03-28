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
