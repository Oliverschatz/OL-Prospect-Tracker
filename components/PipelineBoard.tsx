"use client";

import Link from "next/link";
import type { Prospect, PipelineStage } from "@/lib/types";

interface PipelineColumn {
  value: PipelineStage;
  label: string;
  color: string;
  prospects: Prospect[];
}

export default function PipelineBoard({
  columns,
}: {
  columns: PipelineColumn[];
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.value}
          className="flex-shrink-0 w-64 bg-gray-100 rounded-lg"
        >
          {/* Column Header */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-semibold">{col.label}</span>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                {col.prospects.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="p-2 space-y-2 min-h-[200px]">
            {col.prospects.map((p) => (
              <Link
                key={p.id}
                href={`/prospects/${p.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {p.company_name}
                </p>
                {p.contact_name && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {p.contact_name}
                  </p>
                )}
                {Number(p.deal_value) > 0 && (
                  <p className="text-xs font-medium text-brand mt-2">
                    ${Number(p.deal_value).toLocaleString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
