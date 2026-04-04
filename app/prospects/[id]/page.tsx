import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Prospect, Activity } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProspectActions from "@/components/ProspectActions";
import ActivityFeed from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: prospect } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", params.id)
    .single<Prospect>();

  if (!prospect) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("prospect_id", params.id)
    .order("created_at", { ascending: false })
    .returns<Activity[]>();

  const stage = PIPELINE_STAGES.find((s) => s.value === prospect.stage);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/prospects"
          className="text-sm text-gray-500 hover:text-brand"
        >
          &larr; Back to Prospects
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{prospect.company_name}</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Added {new Date(prospect.created_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: stage?.color }}
              >
                {stage?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Contact</p>
                <p className="font-medium">{prospect.contact_name || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{prospect.contact_email || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{prospect.contact_phone || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Source</p>
                <p className="font-medium">{prospect.source || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Deal Value</p>
                <p className="font-medium text-lg">
                  ${Number(prospect.deal_value).toLocaleString()}
                </p>
              </div>
            </div>

            {prospect.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-gray-500 text-sm mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{prospect.notes}</p>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed
            prospectId={prospect.id}
            activities={activities || []}
          />
        </div>

        {/* Sidebar Actions */}
        <div>
          <ProspectActions prospect={prospect} />
        </div>
      </div>
    </div>
  );
}
