'use server'

import { redirect } from "next/navigation";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseActionClient } from "@/lib/supabase/server";
import {
  customerQuoteSchema,
  opportunityWorkflowSchema,
  structuredRequirementSchema,
  supplierResponseSchema,
  supplierRfqSchema,
} from "@/lib/validators/structured-requirement";

function parseNumber(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toLineArray(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toLineText(value?: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.map((item) => String(item)).join("\n");
}

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

function normalizeFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : "";
  const safeBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${safeBaseName || "file"}${extension}`;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const opportunityStageOrder = [
  "new",
  "reviewing",
  "awaiting_info",
  "sent_for_pricing",
  "supplier_response_received",
  "quote_ready",
  "quote_sent",
  "won",
  "lost",
] as const;

async function advanceOpportunityStage(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  opportunity: { id: string; stage: string },
  nextStage: (typeof opportunityStageOrder)[number]
) {
  if (opportunity.stage === "won" || opportunity.stage === "lost") {
    return opportunity.stage;
  }

  const currentIndex = opportunityStageOrder.indexOf(opportunity.stage as (typeof opportunityStageOrder)[number]);
  const nextIndex = opportunityStageOrder.indexOf(nextStage);

  if (currentIndex >= nextIndex) {
    return opportunity.stage;
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage: nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunity.id);

  if (error) {
    console.error("Opportunity stage advance error:", error);
    return opportunity.stage;
  }

  opportunity.stage = nextStage;
  return nextStage;
}

async function requireEditableOpportunity(opportunityId: string) {
  const context = await requireWorkspaceContext();

  if (context.membership.role === "viewer") {
    redirect(`/app/opportunities/${opportunityId}?error=forbidden`);
  }

  const supabase = await createSupabaseActionClient();
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id, request_id, title, stage, priority, outcome_reason")
    .eq("id", opportunityId)
    .eq("workspace_id", context.workspace.id)
    .single();

  if (error || !opportunity) {
    redirect("/app/opportunities?error=not-found");
  }

  return {
    ...context,
    supabase,
    opportunity,
  };
}

async function requireSupplierRfq(opportunityId: string, rfqId: string) {
  const context = await requireEditableOpportunity(opportunityId);
  const { data: rfq, error } = await context.supabase
    .from("supplier_rfqs")
    .select("id, supplier_name, supplier_contact_name, supplier_email, rfq_subject, rfq_body, status, sent_at")
    .eq("id", rfqId)
    .eq("opportunity_id", opportunityId)
    .single();

  if (error || !rfq) {
    redirect(`/app/opportunities/${opportunityId}?tab=rfqs&error=save`);
  }

  return { ...context, rfq };
}

async function requireSupplierResponse(opportunityId: string, responseId: string) {
  const context = await requireEditableOpportunity(opportunityId);
  const { data: response, error } = await context.supabase
    .from("supplier_responses")
    .select("id, supplier_rfq_id, moq, unit_price, currency, tooling_cost, formulation_cost, lead_time_days, shipping_notes, compliance_notes, response_notes, raw_response_text, selected_for_quote, received_at")
    .eq("id", responseId)
    .single();

  if (error || !response) {
    redirect(`/app/opportunities/${opportunityId}?tab=responses&error=save`);
  }

  const { data: rfq } = await context.supabase
    .from("supplier_rfqs")
    .select("id, supplier_name, opportunity_id")
    .eq("id", response.supplier_rfq_id)
    .single();

  if (!rfq || rfq.opportunity_id !== opportunityId) {
    redirect(`/app/opportunities/${opportunityId}?tab=responses&error=rfq`);
  }

  return { ...context, response, rfq };
}

async function requireCustomerQuote(opportunityId: string, quoteId: string) {
  const context = await requireEditableOpportunity(opportunityId);
  const { data: quote, error } = await context.supabase
    .from("customer_quotes")
    .select("id, quote_number, version_number, title, currency, unit_price, moq, estimated_lead_time_days, included_items_json, assumptions_json, quote_notes, valid_until, status, sent_at, accepted_at")
    .eq("id", quoteId)
    .eq("opportunity_id", opportunityId)
    .single();

  if (error || !quote) {
    redirect(`/app/opportunities/${opportunityId}?tab=quotes&error=save`);
  }

  return { ...context, quote };
}

async function createQuoteNumber(opportunityId: string, workspaceId: string, quotePrefix: string | null) {
  const supabase = await createSupabaseActionClient();
  const { data: opportunityIds } = await supabase
    .from("opportunities")
    .select("id")
    .eq("workspace_id", workspaceId);

  const ids = (opportunityIds ?? []).map((item) => item.id);
  const { data: quotes } = ids.length
    ? await supabase
        .from("customer_quotes")
        .select("id")
        .in("opportunity_id", ids)
    : { data: [] as { id: string }[] };

  const nextNumber = String((quotes?.length ?? 0) + 1).padStart(4, "0");
  const prefix = quotePrefix || "Q";

  return `${prefix}-Q-${nextNumber}-V1`;
}

function createRevisionQuoteNumber(quoteNumber: string, nextVersion: number) {
  if (/-V\d+$/i.test(quoteNumber)) {
    return quoteNumber.replace(/-V\d+$/i, `-V${nextVersion}`);
  }

  return `${quoteNumber}-V${nextVersion}`;
}

export async function updateOpportunityWorkflowAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase, opportunity } = await requireEditableOpportunity(opportunityId);

  const parsed = opportunityWorkflowSchema.safeParse({
    stage: formData.get("stage"),
    priority: formData.get("priority"),
    outcome_reason: formData.get("outcome_reason"),
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}?error=validation`);
  }

  const stageChanged = opportunity.stage !== parsed.data.stage;
  const priorityChanged = opportunity.priority !== parsed.data.priority;
  const normalizedOutcomeReason = parsed.data.stage === "won" || parsed.data.stage === "lost"
    ? parsed.data.outcome_reason || null
    : null;

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage: parsed.data.stage,
      priority: parsed.data.priority,
      outcome_reason: normalizedOutcomeReason,
      closed_at: parsed.data.stage === "won" || parsed.data.stage === "lost" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("Opportunity workflow update error:", error);
    redirect(`/app/opportunities/${opportunityId}?error=save`);
  }

  const activityParts = [] as string[];
  if (stageChanged) {
    activityParts.push(`stage changed to ${parsed.data.stage.replaceAll("_", " ")}`);
  }
  if (priorityChanged) {
    activityParts.push(`priority set to ${parsed.data.priority}`);
  }
  if ((parsed.data.stage === "won" || parsed.data.stage === "lost") && normalizedOutcomeReason) {
    activityParts.push(`outcome noted: ${normalizedOutcomeReason}`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: stageChanged ? "opportunity_stage_updated" : "opportunity_priority_updated",
    activity_text: activityParts.length
      ? `Opportunity updated - ${activityParts.join(", ")}`
      : "Opportunity workflow updated",
    metadata_json: {
      stage: parsed.data.stage,
      priority: parsed.data.priority,
      outcome_reason: normalizedOutcomeReason,
    },
  });

  redirect(`/app/opportunities/${opportunityId}?saved=workflow`);
}

export async function saveStructuredRequirementAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase } = await requireEditableOpportunity(opportunityId);

  const parsed = structuredRequirementSchema.safeParse({
    product_type: formData.get("product_type"),
    format: formData.get("format"),
    target_benefit: formData.get("target_benefit"),
    market: formData.get("market"),
    quantity_units: formData.get("quantity_units"),
    pack_size: formData.get("pack_size"),
    packaging_type: formData.get("packaging_type"),
    formulation_support_needed: formData.get("formulation_support_needed"),
    target_positioning: formData.get("target_positioning"),
    timeline: formData.get("timeline"),
    cleaned_summary: formData.get("cleaned_summary"),
    requirement_json: formData.get("requirement_json"),
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}?tab=requirement&error=validation`);
  }

  let requirementJson = {};
  const requirementJsonText = parsed.data.requirement_json?.trim();

  if (requirementJsonText) {
    try {
      requirementJson = JSON.parse(requirementJsonText);
    } catch {
      redirect(`/app/opportunities/${opportunityId}?tab=requirement&error=json`);
    }
  }

  const quantityUnits = parseNumber(parsed.data.quantity_units);

  const { error: saveError } = await supabase.from("structured_requirements").upsert(
    {
      opportunity_id: opportunityId,
      product_type: parsed.data.product_type || null,
      format: parsed.data.format || null,
      target_benefit: parsed.data.target_benefit || null,
      market: parsed.data.market || null,
      quantity_units: quantityUnits,
      pack_size: parsed.data.pack_size || null,
      packaging_type: parsed.data.packaging_type || null,
      formulation_support_needed: parsed.data.formulation_support_needed === "true",
      target_positioning: parsed.data.target_positioning || null,
      timeline: parsed.data.timeline || null,
      cleaned_summary: parsed.data.cleaned_summary || null,
      requirement_json: requirementJson,
    },
    { onConflict: "opportunity_id" }
  );

  if (saveError) {
    console.error("Structured requirement save error:", saveError);
    redirect(`/app/opportunities/${opportunityId}?tab=requirement&error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "structured_requirement_updated",
    activity_text: "Structured requirement updated",
    metadata_json: { source: "opportunity_detail" },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=requirement&saved=requirement`);
}

export async function createSupplierRfqAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase, opportunity } = await requireEditableOpportunity(opportunityId);
  const submitIntent = String(formData.get("submit_intent") ?? "draft");
  const nextStatus = submitIntent === "sent" ? "sent" : "draft";

  const parsed = supplierRfqSchema.safeParse({
    supplier_name: formData.get("supplier_name"),
    supplier_contact_name: formData.get("supplier_contact_name"),
    supplier_email: String(formData.get("supplier_email") ?? "").trim(),
    rfq_subject: formData.get("rfq_subject"),
    rfq_body: formData.get("rfq_body"),
    status: nextStatus,
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}?tab=rfqs&error=validation`);
  }

  const sentAt = parsed.data.status === "sent" ? new Date().toISOString() : null;
  const { data: createdRfq, error } = await supabase
    .from("supplier_rfqs")
    .insert({
      opportunity_id: opportunityId,
      supplier_name: parsed.data.supplier_name,
      supplier_contact_name: parsed.data.supplier_contact_name || null,
      supplier_email: parsed.data.supplier_email || null,
      rfq_subject: parsed.data.rfq_subject || null,
      rfq_body: parsed.data.rfq_body || null,
      status: parsed.data.status,
      sent_at: sentAt,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !createdRfq) {
    console.error("Supplier RFQ create error:", error);
    redirect(`/app/opportunities/${opportunityId}?tab=rfqs&error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: parsed.data.status === "sent" ? "rfq_marked_sent" : "rfq_created",
    activity_text:
      parsed.data.status === "sent"
        ? `Supplier RFQ sent to ${parsed.data.supplier_name}`
        : `Supplier RFQ created for ${parsed.data.supplier_name}`,
    metadata_json: { supplier_name: parsed.data.supplier_name, supplier_rfq_id: createdRfq.id },
  });

  if (parsed.data.status === "sent") {
    await advanceOpportunityStage(supabase, opportunity, "sent_for_pricing");
    redirect(`/app/opportunities/${opportunityId}?tab=responses&saved=rfq_sent&rfqId=${createdRfq.id}`);
  }

  redirect(`/app/opportunities/${opportunityId}?tab=rfqs&saved=rfq`);
}

export async function markSupplierRfqSentAction(opportunityId: string, rfqId: string) {
  const { workspace, user, supabase, opportunity, rfq } = await requireSupplierRfq(opportunityId, rfqId);
  const sentAt = rfq.sent_at || new Date().toISOString();

  const { error } = await supabase
    .from("supplier_rfqs")
    .update({
      status: "sent",
      sent_at: sentAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("opportunity_id", opportunityId);

  if (error) {
    console.error("Supplier RFQ mark sent error:", error);
    redirect(`/app/opportunities/${opportunityId}?tab=rfqs&error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "rfq_marked_sent",
    activity_text: `Supplier RFQ sent to ${rfq.supplier_name}`,
    metadata_json: { supplier_rfq_id: rfqId, supplier_name: rfq.supplier_name },
  });

  await advanceOpportunityStage(supabase, opportunity, "sent_for_pricing");

  redirect(`/app/opportunities/${opportunityId}?tab=responses&saved=rfq_sent&rfqId=${rfqId}`);
}

export async function updateSupplierRfqAction(opportunityId: string, rfqId: string, formData: FormData) {
  const { workspace, user, supabase } = await requireSupplierRfq(opportunityId, rfqId);

  const parsed = supplierRfqSchema.safeParse({
    supplier_name: formData.get("supplier_name"),
    supplier_contact_name: formData.get("supplier_contact_name"),
    supplier_email: String(formData.get("supplier_email") ?? "").trim(),
    rfq_subject: formData.get("rfq_subject"),
    rfq_body: formData.get("rfq_body"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}/rfqs/${rfqId}?error=validation`);
  }

  const sentAt = parsed.data.status === "sent" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("supplier_rfqs")
    .update({
      supplier_name: parsed.data.supplier_name,
      supplier_contact_name: parsed.data.supplier_contact_name || null,
      supplier_email: parsed.data.supplier_email || null,
      rfq_subject: parsed.data.rfq_subject || null,
      rfq_body: parsed.data.rfq_body || null,
      status: parsed.data.status,
      sent_at: sentAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rfqId)
    .eq("opportunity_id", opportunityId);

  if (error) {
    console.error("Supplier RFQ update error:", error);
    redirect(`/app/opportunities/${opportunityId}/rfqs/${rfqId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "rfq_updated",
    activity_text: `Supplier RFQ updated for ${parsed.data.supplier_name}`,
    metadata_json: { supplier_rfq_id: rfqId },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=rfqs&saved=rfq_updated`);
}

export async function duplicateSupplierRfqAction(opportunityId: string, rfqId: string) {
  const { workspace, user, supabase, rfq } = await requireSupplierRfq(opportunityId, rfqId);

  const { error } = await supabase.from("supplier_rfqs").insert({
    opportunity_id: opportunityId,
    supplier_name: rfq.supplier_name,
    supplier_contact_name: rfq.supplier_contact_name,
    supplier_email: rfq.supplier_email,
    rfq_subject: rfq.rfq_subject,
    rfq_body: rfq.rfq_body,
    status: "draft",
    sent_at: null,
    created_by_user_id: user.id,
  });

  if (error) {
    console.error("Supplier RFQ duplicate error:", error);
    redirect(`/app/opportunities/${opportunityId}/rfqs/${rfqId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "rfq_duplicated",
    activity_text: `Supplier RFQ duplicated for ${rfq.supplier_name}`,
    metadata_json: { supplier_rfq_id: rfqId },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=rfqs&saved=rfq_duplicated`);
}

export async function createSupplierResponseAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase, opportunity } = await requireEditableOpportunity(opportunityId);

  const parsed = supplierResponseSchema.safeParse({
    supplier_rfq_id: formData.get("supplier_rfq_id"),
    moq: formData.get("moq"),
    unit_price: formData.get("unit_price"),
    currency: formData.get("currency"),
    tooling_cost: formData.get("tooling_cost"),
    formulation_cost: formData.get("formulation_cost"),
    lead_time_days: formData.get("lead_time_days"),
    shipping_notes: formData.get("shipping_notes"),
    compliance_notes: formData.get("compliance_notes"),
    response_notes: formData.get("response_notes"),
    raw_response_text: formData.get("raw_response_text"),
    selected_for_quote: formData.get("selected_for_quote") ?? "false",
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}?tab=responses&error=validation`);
  }

  const { data: rfq, error: rfqError } = await supabase
    .from("supplier_rfqs")
    .select("id, supplier_name")
    .eq("id", parsed.data.supplier_rfq_id)
    .eq("opportunity_id", opportunityId)
    .single();

  if (rfqError || !rfq) {
    redirect(`/app/opportunities/${opportunityId}?tab=responses&error=rfq`);
  }

  if (parsed.data.selected_for_quote === "true") {
    const { data: rfqs } = await supabase
      .from("supplier_rfqs")
      .select("id")
      .eq("opportunity_id", opportunityId);

    const rfqIds = (rfqs ?? []).map((item) => item.id);
    if (rfqIds.length) {
      await supabase
        .from("supplier_responses")
        .update({ selected_for_quote: false })
        .in("supplier_rfq_id", rfqIds);
    }
  }

  const { error } = await supabase.from("supplier_responses").insert({
    supplier_rfq_id: parsed.data.supplier_rfq_id,
    moq: parseNumber(parsed.data.moq),
    unit_price: parseNumber(parsed.data.unit_price),
    currency: parsed.data.currency,
    tooling_cost: parseNumber(parsed.data.tooling_cost),
    formulation_cost: parseNumber(parsed.data.formulation_cost),
    lead_time_days: parseNumber(parsed.data.lead_time_days),
    shipping_notes: parsed.data.shipping_notes || null,
    compliance_notes: parsed.data.compliance_notes || null,
    response_notes: parsed.data.response_notes || null,
    raw_response_text: parsed.data.raw_response_text || null,
    selected_for_quote: parsed.data.selected_for_quote === "true",
    received_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Supplier response create error:", error);
    redirect(`/app/opportunities/${opportunityId}?tab=responses&error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "supplier_response_logged",
    activity_text: `Supplier response logged for ${rfq.supplier_name}`,
    metadata_json: {
      supplier_rfq_id: parsed.data.supplier_rfq_id,
      preferred: parsed.data.selected_for_quote === "true",
    },
  });

  await advanceOpportunityStage(supabase, opportunity, "supplier_response_received");

  if (parsed.data.selected_for_quote === "true") {
    redirect(`/app/opportunities/${opportunityId}?tab=quotes&saved=response_preferred`);
  }

  redirect(`/app/opportunities/${opportunityId}?tab=responses&saved=response`);
}

export async function updateSupplierResponseAction(opportunityId: string, responseId: string, formData: FormData) {
  const { workspace, user, supabase, rfq } = await requireSupplierResponse(opportunityId, responseId);

  const parsed = supplierResponseSchema.safeParse({
    supplier_rfq_id: formData.get("supplier_rfq_id"),
    moq: formData.get("moq"),
    unit_price: formData.get("unit_price"),
    currency: formData.get("currency"),
    tooling_cost: formData.get("tooling_cost"),
    formulation_cost: formData.get("formulation_cost"),
    lead_time_days: formData.get("lead_time_days"),
    shipping_notes: formData.get("shipping_notes"),
    compliance_notes: formData.get("compliance_notes"),
    response_notes: formData.get("response_notes"),
    raw_response_text: formData.get("raw_response_text"),
    selected_for_quote: formData.get("selected_for_quote") ?? "false",
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}/responses/${responseId}?error=validation`);
  }

  const { data: nextRfq, error: rfqError } = await supabase
    .from("supplier_rfqs")
    .select("id, supplier_name")
    .eq("id", parsed.data.supplier_rfq_id)
    .eq("opportunity_id", opportunityId)
    .single();

  if (rfqError || !nextRfq) {
    redirect(`/app/opportunities/${opportunityId}/responses/${responseId}?error=rfq`);
  }

  if (parsed.data.selected_for_quote === "true") {
    const { data: rfqs } = await supabase
      .from("supplier_rfqs")
      .select("id")
      .eq("opportunity_id", opportunityId);

    const rfqIds = (rfqs ?? []).map((item) => item.id);
    if (rfqIds.length) {
      await supabase
        .from("supplier_responses")
        .update({ selected_for_quote: false })
        .in("supplier_rfq_id", rfqIds);
    }
  }

  const { error } = await supabase
    .from("supplier_responses")
    .update({
      supplier_rfq_id: parsed.data.supplier_rfq_id,
      moq: parseNumber(parsed.data.moq),
      unit_price: parseNumber(parsed.data.unit_price),
      currency: parsed.data.currency,
      tooling_cost: parseNumber(parsed.data.tooling_cost),
      formulation_cost: parseNumber(parsed.data.formulation_cost),
      lead_time_days: parseNumber(parsed.data.lead_time_days),
      shipping_notes: parsed.data.shipping_notes || null,
      compliance_notes: parsed.data.compliance_notes || null,
      response_notes: parsed.data.response_notes || null,
      raw_response_text: parsed.data.raw_response_text || null,
      selected_for_quote: parsed.data.selected_for_quote === "true",
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", responseId);

  if (error) {
    console.error("Supplier response update error:", error);
    redirect(`/app/opportunities/${opportunityId}/responses/${responseId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "supplier_response_updated",
    activity_text: `Supplier response updated for ${nextRfq.supplier_name}`,
    metadata_json: { supplier_response_id: responseId, previous_supplier_name: rfq.supplier_name },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=responses&saved=response_updated`);
}

export async function createCustomerQuoteAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase, opportunity } = await requireEditableOpportunity(opportunityId);

  const parsed = customerQuoteSchema.safeParse({
    title: formData.get("title"),
    currency: formData.get("currency"),
    unit_price: formData.get("unit_price"),
    moq: formData.get("moq"),
    estimated_lead_time_days: formData.get("estimated_lead_time_days"),
    included_items: formData.get("included_items"),
    assumptions: formData.get("assumptions"),
    quote_notes: formData.get("quote_notes"),
    valid_until: formData.get("valid_until"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}?tab=quotes&error=validation`);
  }

  const quoteNumber = await createQuoteNumber(opportunityId, workspace.id, workspace.quote_prefix || null);
  const sentAt = parsed.data.status === "sent" ? new Date().toISOString() : null;

  const { error } = await supabase.from("customer_quotes").insert({
    opportunity_id: opportunityId,
    quote_number: quoteNumber,
    version_number: 1,
    title: parsed.data.title,
    currency: parsed.data.currency,
    unit_price: parseNumber(parsed.data.unit_price),
    moq: parseNumber(parsed.data.moq),
    estimated_lead_time_days: parseNumber(parsed.data.estimated_lead_time_days),
    included_items_json: toLineArray(parsed.data.included_items),
    assumptions_json: toLineArray(parsed.data.assumptions),
    quote_notes: parsed.data.quote_notes || null,
    valid_until: parsed.data.valid_until || null,
    status: parsed.data.status,
    sent_at: sentAt,
  });

  if (error) {
    console.error("Customer quote create error:", error);
    redirect(`/app/opportunities/${opportunityId}?tab=quotes&error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: parsed.data.status === "sent" ? "quote_marked_sent" : "quote_created",
    activity_text:
      parsed.data.status === "sent"
        ? `Customer quote ${quoteNumber} created and marked sent`
        : `Customer quote ${quoteNumber} created`,
    metadata_json: { quote_number: quoteNumber },
  });

  await advanceOpportunityStage(supabase, opportunity, parsed.data.status === "sent" ? "quote_sent" : "quote_ready");

  redirect(`/app/opportunities/${opportunityId}?tab=quotes&saved=${parsed.data.status === "sent" ? "quote_sent" : "quote"}`);
}

export async function updateCustomerQuoteAction(opportunityId: string, quoteId: string, formData: FormData) {
  const { workspace, user, supabase, quote } = await requireCustomerQuote(opportunityId, quoteId);

  const parsed = customerQuoteSchema.safeParse({
    title: formData.get("title"),
    currency: formData.get("currency"),
    unit_price: formData.get("unit_price"),
    moq: formData.get("moq"),
    estimated_lead_time_days: formData.get("estimated_lead_time_days"),
    included_items: formData.get("included_items"),
    assumptions: formData.get("assumptions"),
    quote_notes: formData.get("quote_notes"),
    valid_until: formData.get("valid_until"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect(`/app/opportunities/${opportunityId}/quotes/${quoteId}?error=validation`);
  }

  const sentAt = parsed.data.status === "sent" ? quote.sent_at || new Date().toISOString() : null;
  const { error } = await supabase
    .from("customer_quotes")
    .update({
      title: parsed.data.title,
      currency: parsed.data.currency,
      unit_price: parseNumber(parsed.data.unit_price),
      moq: parseNumber(parsed.data.moq),
      estimated_lead_time_days: parseNumber(parsed.data.estimated_lead_time_days),
      included_items_json: toLineArray(parsed.data.included_items),
      assumptions_json: toLineArray(parsed.data.assumptions),
      quote_notes: parsed.data.quote_notes || null,
      valid_until: parsed.data.valid_until || null,
      status: parsed.data.status,
      sent_at: sentAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("opportunity_id", opportunityId);

  if (error) {
    console.error("Customer quote update error:", error);
    redirect(`/app/opportunities/${opportunityId}/quotes/${quoteId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "quote_updated",
    activity_text: `Customer quote ${quote.quote_number} updated`,
    metadata_json: { quote_id: quoteId },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=quotes&saved=quote_updated`);
}

export async function createQuoteRevisionAction(opportunityId: string, quoteId: string) {
  const { workspace, user, supabase, quote } = await requireCustomerQuote(opportunityId, quoteId);

  const nextVersion = quote.version_number + 1;
  const nextQuoteNumber = createRevisionQuoteNumber(quote.quote_number, nextVersion);
  const { error } = await supabase.from("customer_quotes").insert({
    opportunity_id: opportunityId,
    quote_number: nextQuoteNumber,
    version_number: nextVersion,
    title: quote.title,
    currency: quote.currency,
    unit_price: quote.unit_price,
    moq: quote.moq,
    estimated_lead_time_days: quote.estimated_lead_time_days,
    included_items_json: quote.included_items_json,
    assumptions_json: quote.assumptions_json,
    quote_notes: quote.quote_notes,
    valid_until: quote.valid_until,
    status: "draft",
    sent_at: null,
    accepted_at: null,
  });

  if (error) {
    console.error("Customer quote revision error:", error);
    redirect(`/app/opportunities/${opportunityId}/quotes/${quoteId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "quote_revision_created",
    activity_text: `Customer quote revision ${nextQuoteNumber} created`,
    metadata_json: { source_quote_id: quoteId, quote_number: nextQuoteNumber },
  });

  redirect(`/app/opportunities/${opportunityId}?tab=quotes&saved=quote_revision`);
}

export async function getEditableQuoteDefaults(opportunityId: string, quoteId: string) {
  const { quote } = await requireCustomerQuote(opportunityId, quoteId);
  return {
    ...quote,
    included_items_text: toLineText(quote.included_items_json),
    assumptions_text: toLineText(quote.assumptions_json),
  };
}

export async function uploadOpportunityFileAction(opportunityId: string, formData: FormData) {
  const { workspace, user, supabase, opportunity } = await requireEditableOpportunity(opportunityId);
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect(`/app/opportunities/${opportunityId}?error=file`);
  }

  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    redirect(`/app/opportunities/${opportunityId}?error=file_size`);
  }

  if (!ALLOWED_FILE_TYPES.has(fileEntry.type)) {
    redirect(`/app/opportunities/${opportunityId}?error=file_type`);
  }

  const normalizedName = normalizeFileName(fileEntry.name);
  const storagePath = `${workspace.id}/${opportunityId}/${Date.now()}-${normalizedName}`;
  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("workspace-files")
    .upload(storagePath, fileBuffer, {
      contentType: fileEntry.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Opportunity file upload error:", uploadError);
    redirect(`/app/opportunities/${opportunityId}?error=save`);
  }

  const { error: fileInsertError } = await supabase.from("files").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    request_id: opportunity.request_id,
    storage_path: storagePath,
    file_name: fileEntry.name,
    mime_type: fileEntry.type,
    file_size: fileEntry.size,
    uploaded_by_user_id: user.id,
  });

  if (fileInsertError) {
    console.error("Opportunity file record insert error:", fileInsertError);
    await supabase.storage.from("workspace-files").remove([storagePath]);
    redirect(`/app/opportunities/${opportunityId}?error=save`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "opportunity_file_uploaded",
    activity_text: `File uploaded: ${fileEntry.name} (${formatFileSize(fileEntry.size)})`,
    metadata_json: { storage_path: storagePath, file_name: fileEntry.name },
  });

  redirect(`/app/opportunities/${opportunityId}?saved=file`);
}

export async function deleteOpportunityFileAction(opportunityId: string, fileId: string) {
  const { workspace, user, supabase } = await requireEditableOpportunity(opportunityId);
  const { data: fileRecord, error } = await supabase
    .from("files")
    .select("id, storage_path, file_name")
    .eq("id", fileId)
    .eq("workspace_id", workspace.id)
    .eq("opportunity_id", opportunityId)
    .single();

  if (error || !fileRecord) {
    redirect(`/app/opportunities/${opportunityId}?error=file_delete`);
  }

  const { error: removeError } = await supabase.storage
    .from("workspace-files")
    .remove([fileRecord.storage_path]);

  if (removeError) {
    console.error("Opportunity file storage delete error:", removeError);
    redirect(`/app/opportunities/${opportunityId}?error=file_delete`);
  }

  const { error: deleteError } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId)
    .eq("workspace_id", workspace.id);

  if (deleteError) {
    console.error("Opportunity file record delete error:", deleteError);
    redirect(`/app/opportunities/${opportunityId}?error=file_delete`);
  }

  await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    opportunity_id: opportunityId,
    user_id: user.id,
    activity_type: "opportunity_file_deleted",
    activity_text: `File deleted: ${fileRecord.file_name}`,
    metadata_json: { file_id: fileId, storage_path: fileRecord.storage_path },
  });

  redirect(`/app/opportunities/${opportunityId}?saved=file_deleted`);
}

