import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { WinningsSummary } from "@/services/winner-rules";

/** PRD section 10: total won and current payment status, at a glance. */
export function WinningsCard({ summary }: { summary: WinningsSummary }) {
  return (
    <Card>
      <CardEyebrow>Winnings</CardEyebrow>
      <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ink">{formatCents(summary.totalWonCents)}</p>
      <p className="tabular mt-1 text-sm text-ink-muted">
        {formatCents(summary.paidCents)} paid · {formatCents(summary.outstandingCents)} pending
      </p>
      {summary.actionNeeded > 0 && <p className="mt-2 text-sm font-medium text-ember">Action needed: upload proof</p>}
      <Link href="/dashboard/winnings" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}>
        View prizes
      </Link>
    </Card>
  );
}
