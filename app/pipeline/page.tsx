import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Prospect } from "@/lib/types";
import PipelineBoard from "@/components/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<Prospect[]>();

  const columns = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    prospects: (prospects || []).filter((p) => p.stage === stage.value),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pipeline</h1>
      <PipelineBoard columns={columns} />
    </div>
  );
}
