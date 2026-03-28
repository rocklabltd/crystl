import { z } from "zod";

export const structuredRequirementSchema = z.object({
  product_type: z.string().trim().optional(),
  format: z.string().trim().optional(),
  target_benefit: z.string().trim().optional(),
  market: z.string().trim().optional(),
  quantity_units: z.string().trim().optional(),
  pack_size: z.string().trim().optional(),
  packaging_type: z.string().trim().optional(),
  formulation_support_needed: z.enum(["true", "false"]).default("false"),
  target_positioning: z.string().trim().optional(),
  timeline: z.string().trim().optional(),
  cleaned_summary: z.string().trim().optional(),
  requirement_json: z.string().trim().optional(),
});

export const supplierRfqSchema = z.object({
  supplier_name: z.string().trim().min(1, "Supplier name is required"),
  supplier_contact_name: z.string().trim().optional(),
  supplier_email: z.union([z.literal(""), z.email("Supplier email must be valid")]),
  rfq_subject: z.string().trim().optional(),
  rfq_body: z.string().trim().optional(),
  status: z.enum(["draft", "sent"]).default("draft"),
});

export const supplierResponseSchema = z.object({
  supplier_rfq_id: z.string().trim().min(1, "Supplier RFQ is required"),
  moq: z.string().trim().optional(),
  unit_price: z.string().trim().optional(),
  currency: z.string().trim().min(1, "Currency is required"),
  tooling_cost: z.string().trim().optional(),
  formulation_cost: z.string().trim().optional(),
  lead_time_days: z.string().trim().optional(),
  shipping_notes: z.string().trim().optional(),
  compliance_notes: z.string().trim().optional(),
  response_notes: z.string().trim().optional(),
  raw_response_text: z.string().trim().optional(),
  selected_for_quote: z.enum(["true", "false"]).default("false"),
});

export const customerQuoteSchema = z.object({
  title: z.string().trim().min(1, "Quote title is required"),
  currency: z.string().trim().min(1, "Currency is required"),
  unit_price: z.string().trim().optional(),
  moq: z.string().trim().optional(),
  estimated_lead_time_days: z.string().trim().optional(),
  included_items: z.string().trim().optional(),
  assumptions: z.string().trim().optional(),
  quote_notes: z.string().trim().optional(),
  valid_until: z.string().trim().optional(),
  status: z.enum(["draft", "sent"]).default("draft"),
});

export const opportunityWorkflowSchema = z
  .object({
    stage: z.enum([
      "new",
      "reviewing",
      "awaiting_info",
      "sent_for_pricing",
      "supplier_response_received",
      "quote_ready",
      "quote_sent",
      "won",
      "lost",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    outcome_reason: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.stage === "won" || value.stage === "lost") && !value.outcome_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcome_reason"],
        message: "Outcome reason is required when closing an opportunity",
      });
    }
  });
