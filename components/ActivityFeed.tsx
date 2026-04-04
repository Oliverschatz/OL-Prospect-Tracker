"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Activity } from "@/lib/types";

const ACTIVITY_TYPES = [
  { value: "call", label: "Call", icon: "📞" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "meeting", label: "Meeting", icon: "🤝" },
  { value: "note", label: "Note", icon: "📝" },
  { value: "task", label: "Task", icon: "✅" },
] as const;

export default function ActivityFeed({
  prospectId,
  activities,
}: {
  prospectId: string;
  activities: Activity[];
}) {
  const router = useRouter();
  const [type, setType] = useState<Activity["type"]>("note");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("activities").insert({
      prospect_id: prospectId,
      type,
      description: description.trim(),
    });

    if (error) {
      alert("Error adding activity: " + error.message);
    } else {
      setDescription("");
    }

    setSaving(false);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4">Activity</h2>

      {/* Add Activity Form */}
      <form onSubmit={handleAdd} className="mb-6 space-y-3">
        <div className="flex gap-2">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === t.value
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a note, log a call, or record an activity..."
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
        <button
          type="submit"
          disabled={saving || !description.trim()}
          className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Activity"}
        </button>
      </form>

      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <p className="text-gray-400 text-sm">No activity recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const actType = ACTIVITY_TYPES.find((t) => t.value === a.type);
            return (
              <div
                key={a.id}
                className="flex gap-3 text-sm border-l-2 border-gray-200 pl-4 py-1"
              >
                <span className="shrink-0">{actType?.icon}</span>
                <div className="flex-1">
                  <p>{a.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
