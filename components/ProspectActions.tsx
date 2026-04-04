"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Prospect, PipelineStage } from "@/lib/types";

export default function ProspectActions({ prospect }: { prospect: Prospect }) {
  const router = useRouter();
  const [stage, setStage] = useState<PipelineStage>(prospect.stage);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleStageChange = async (newStage: PipelineStage) => {
    setUpdating(true);
    setStage(newStage);

    const { error } = await supabase
      .from("prospects")
      .update({ stage: newStage })
      .eq("id", prospect.id);

    if (error) {
      alert("Error updating stage: " + error.message);
      setStage(prospect.stage);
    }

    setUpdating(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this prospect?")) return;

    setDeleting(true);
    const { error } = await supabase
      .from("prospects")
      .delete()
      .eq("id", prospect.id);

    if (error) {
      alert("Error deleting: " + error.message);
      setDeleting(false);
      return;
    }

    router.push("/prospects");
    router.refresh();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="font-semibold text-sm text-gray-700">Actions</h3>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Move to Stage
        </label>
        <select
          value={stage}
          onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
          disabled={updating}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <hr className="border-gray-100" />

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full text-sm text-red-600 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete Prospect"}
      </button>
    </div>
  );
}
