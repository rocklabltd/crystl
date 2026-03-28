import Link from "next/link";

import { requireWorkspaceContext } from "@/lib/auth";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

const STAGES = [
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

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ");
}

export default async function DashboardPage() {
  const { workspace } = await requireWorkspaceContext();
  const supabase = await createSupabaseServerComponentClient();

  const [{ data: opportunities }, { data: activities }, { data: requests }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, ref_code, title, stage, priority, updated_at")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("activity_logs")
      .select("id, activity_type, activity_text, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("requests")
      .select("id, submitted_at, status, source")
      .eq("workspace_id", workspace.id)
      .order("submitted_at", { ascending: false })
      .limit(5),
  ]);

  const counts = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<string, number>;

  for (const opportunity of opportunities ?? []) {
    counts[opportunity.stage] = (counts[opportunity.stage] ?? 0) + 1;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-black/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-950">
            {workspace.brand_name || workspace.name}
          </h1>
          <p className="mt-2 text-neutral-600">
            Keep an eye on the request-to-quote pipeline and jump back into active work quickly.
          </p>
        </div>
        <Link
          href="/app/opportunities"
          className="inline-flex rounded-xl bg-neutral-950 px-4 py-3 text-sm font-medium text-white"
        >
          View opportunities
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-2xl border border-black/8 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
              {stageLabel(stage)}
            </p>
            <p className="mt-3 text-3xl font-semibold text-neutral-950">{counts[stage]}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-black/8 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent opportunities</h2>
            <Link href="/app/opportunities" className="text-sm text-neutral-600 underline underline-offset-4">
              Open list
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {(opportunities ?? []).length ? (
              opportunities?.map((opportunity) => (
                <Link key={opportunity.id} href={`/app/opportunities/${opportunity.id}`} className="block rounded-2xl border border-black/6 bg-[#faf7f2] p-4 transition hover:bg-[#f4efe8]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-950">{opportunity.ref_code}</p>
                      <p className="mt-1 text-sm text-neutral-700">{opportunity.title}</p>
                    </div>
                    <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">
                      {stageLabel(opportunity.stage)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Priority: {opportunity.priority}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-neutral-600">No opportunities yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold">Recent activity</h2>
            <div className="mt-5 space-y-4">
              {(activities ?? []).length ? (
                activities?.map((activity) => (
                  <div key={activity.id} className="border-l-2 border-neutral-200 pl-4">
                    <p className="text-sm font-medium text-neutral-900">{activity.activity_text}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">
                      {activity.activity_type.replaceAll("_", " ")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600">Activity will appear here as requests move through the workflow.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-black/8 bg-white p-6">
            <h2 className="text-xl font-semibold">Recent requests</h2>
            <div className="mt-5 space-y-3">
              {(requests ?? []).length ? (
                requests?.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-black/6 p-4">
                    <p className="text-sm font-medium text-neutral-900">{request.source}</p>
                    <p className="mt-1 text-sm text-neutral-600">Status: {request.status}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600">No requests have been submitted yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
