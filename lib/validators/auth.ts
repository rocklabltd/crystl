import { z } from "zod";

export const authSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .optional()
    .or(z.literal("")),
  email: z.email("Please enter a valid email address").trim(),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters long"),
});

export type AuthFieldErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
};

export type AuthFormState = {
  errors?: AuthFieldErrors;
  message?: string;
  values?: {
    name?: string;
    email?: string;
  };
};
