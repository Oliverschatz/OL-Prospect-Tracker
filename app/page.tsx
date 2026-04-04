import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Prospect } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .returns<Prospect[]>();

  if (!prospects) return { total: 0, stages: {}, totalValue: 0, recentProspects: [] };

  const stages: Record<string, number> = {};
  let totalValue = 0;

  for (const p of prospects) {
    stages[p.stage] = (stages[p.stage] || 0) + 1;
    if (p.stage !== "closed_lost") {
      totalValue += Number(p.deal_value);
    }
  }

  const recentProspects = [...prospects]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return { total: prospects.length, stages, totalValue, recentProspects };
}

export default async function Dashboard() {
  const { total, stages, totalValue, recentProspects } = await getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Total Prospects</p>
          <p className="text-3xl font-bold mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Pipeline Value</p>
          <p className="text-3xl font-bold mt-1">
            ${totalValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Won Deals</p>
          <p className="text-3xl font-bold mt-1 text-green-600">
            {stages["closed_won"] || 0}
          </p>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Pipeline Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {PIPELINE_STAGES.map((s) => (
            <div key={s.value} className="text-center">
              <div
                className="text-2xl font-bold"
                style={{ color: s.color }}
              >
                {stages[s.value] || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Prospects */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Prospects</h2>
          <Link
            href="/prospects/new"
            className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors"
          >
            + Add Prospect
          </Link>
        </div>
        {recentProspects.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No prospects yet.{" "}
            <Link href="/prospects/new" className="text-brand hover:underline">
              Add your first prospect
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="pb-2 font-medium">Company</th>
                <th className="pb-2 font-medium">Contact</th>
                <th className="pb-2 font-medium">Stage</th>
                <th className="pb-2 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {recentProspects.map((p) => {
                const stage = PIPELINE_STAGES.find((s) => s.value === p.stage);
                return (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2">
                      <Link
                        href={`/prospects/${p.id}`}
                        className="text-brand hover:underline font-medium"
                      >
                        {p.company_name}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-600">{p.contact_name}</td>
                    <td className="py-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: stage?.color }}
                      >
                        {stage?.label}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600">
                      ${Number(p.deal_value).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
