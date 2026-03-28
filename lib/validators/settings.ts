import { z } from "zod";

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required"),
  brand_name: z.string().trim().optional(),
  default_currency: z.string().trim().min(1, "Default currency is required"),
  quote_prefix: z.string().trim().min(1, "Quote prefix is required").max(10, "Quote prefix is too long"),
  primary_colour: z.union([
    z.literal(""),
    z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Primary colour must be a hex value"),
  ]),
  logo_url: z.union([z.literal(""), z.url("Logo URL must be valid")]),
});

export const workspaceMemberRoleSchema = z.object({
  role: z.enum(["owner", "manager", "sales", "viewer"]),
});

export const formTemplateBasicsSchema = z.object({
  name: z.string().trim().min(1, "Form name is required"),
  slug: z.string().trim().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens"),
  status: z.enum(["draft", "active", "archived"]),
  headline: z.string().trim().optional(),
  intro_text: z.string().trim().optional(),
  success_message: z.string().trim().optional(),
  submit_button_text: z.string().trim().min(1, "Submit button text is required"),
});

export const formFieldSchema = z.object({
  label: z.string().trim().min(1, "Field label is required"),
  placeholder: z.string().trim().optional(),
  help_text: z.string().trim().optional(),
  required: z.enum(["true", "false"]).default("false"),
  is_active: z.enum(["true", "false"]).default("true"),
  sort_order: z.string().trim().min(1, "Sort order is required"),
  option_lines: z.string().trim().optional(),
  conditional_enabled: z.enum(["true", "false"]).default("false"),
  conditional_field: z.string().trim().optional(),
  conditional_operator: z.enum(["equals", "in"]).default("equals"),
  conditional_value: z.string().trim().optional(),
});
