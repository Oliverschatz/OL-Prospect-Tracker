import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Prospect } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Prospect[]>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prospects</h1>
        <Link
          href="/prospects/new"
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors"
        >
          + Add Prospect
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {!prospects || prospects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-2">No prospects yet.</p>
            <Link href="/prospects/new" className="text-brand hover:underline">
              Add your first prospect
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => {
                const stage = PIPELINE_STAGES.find((s) => s.value === p.stage);
                return (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/prospects/${p.id}`}
                        className="text-brand hover:underline font-medium"
                      >
                        {p.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.contact_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.contact_email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: stage?.color }}
                      >
                        {stage?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.source}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
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
