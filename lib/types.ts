export type PipelineStage =
  | "lead"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "#94A3B8" },
  { value: "contacted", label: "Contacted", color: "#3B82F6" },
  { value: "qualified", label: "Qualified", color: "#8B5CF6" },
  { value: "proposal", label: "Proposal", color: "#F59E0B" },
  { value: "negotiation", label: "Negotiation", color: "#F97316" },
  { value: "closed_won", label: "Closed Won", color: "#22C55E" },
  { value: "closed_lost", label: "Closed Lost", color: "#EF4444" },
];

export interface Prospect {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  stage: PipelineStage;
  deal_value: number;
  notes: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  prospect_id: string;
  type: "call" | "email" | "meeting" | "note" | "task";
  description: string;
  created_at: string;
}
