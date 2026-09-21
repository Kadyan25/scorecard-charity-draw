import { Badge } from "@/components/ui/badge";
import type { WinnerStage } from "@/services/winner-rules";

const STAGES: Record<WinnerStage, { label: string; tone: "neutral" | "ember" | "positive" | "warning" | "negative" }> = {
  needs_proof: { label: "Proof needed", tone: "ember" },
  under_review: { label: "Under review", tone: "warning" },
  rejected: { label: "Proof rejected", tone: "negative" },
  approved_unpaid: { label: "Approved · payment pending", tone: "warning" },
  paid: { label: "Paid", tone: "positive" },
};

export function StageBadge({ stage }: { stage: WinnerStage }) {
  const { label, tone } = STAGES[stage];
  return <Badge tone={tone}>{label}</Badge>;
}
