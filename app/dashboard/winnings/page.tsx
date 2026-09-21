import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { ProofUpload } from "@/components/winnings/proof-upload";
import { StageBadge } from "@/components/winnings/stage-badge";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { listMyWinnings } from "@/services/winner-queries";
import { summariseWinnings } from "@/services/winner-rules";

export const metadata: Metadata = { title: "Winnings" };

const STAGE_HELP = {
  needs_proof: "Upload a screenshot of your scores from your golf platform to claim this prize.",
  under_review: "Thanks — our team is checking your screenshot.",
  rejected: "Your screenshot could not be verified. Please upload a clearer one.",
  approved_unpaid: "Verified. Your payment is being processed.",
  paid: "Paid.",
} as const;

export default async function WinningsPage() {
  const viewer = await requireUser();
  const winnings = await listMyWinnings(viewer.userId);
  const summary = summariseWinnings(winnings);

  return (
    <>
      <PageHeader eyebrow="Winnings" title="Your prizes" description="Every prize is verified before it is paid. Upload proof of your scores and track each payment here." />
      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardEyebrow>Total won</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-5xl text-ember">{formatCents(summary.totalWonCents)}</p>
        </Card>
        <Card>
          <CardEyebrow>Paid out</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-5xl text-ink">{formatCents(summary.paidCents)}</p>
        </Card>
        <Card>
          <CardEyebrow>Pending</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-5xl text-ink">{formatCents(summary.outstandingCents)}</p>
          {summary.actionNeeded > 0 && (
            <p className="mt-2 text-sm font-medium text-ember">{summary.actionNeeded} {summary.actionNeeded === 1 ? "prize needs" : "prizes need"} your proof</p>
          )}
        </Card>
      </div>
      <Card className="mt-5">
        <CardTitle>Prize history</CardTitle>
        {winnings.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No prizes yet. Match three or more numbers in a monthly draw to win.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {winnings.map((winning) => (
              <li key={winning.id} className="grid gap-4 py-5 md:grid-cols-[1fr_1.4fr]">
                <div>
                  <p className="text-ink">{winning.periodMonth ? format(parseISO(winning.periodMonth), "MMMM yyyy") : "Draw"} · {winning.tier} numbers</p>
                  <p className="tabular font-[family-name:var(--font-display)] text-3xl text-ink">{formatCents(winning.prize_cents)}</p>
                  <div className="mt-2"><StageBadge stage={winning.stage} /></div>
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-ink-muted">{STAGE_HELP[winning.stage]}</p>
                  {winning.stage === "rejected" && winning.review_note && (
                    <p className="rounded-lg bg-rose-soft px-3 py-2 text-rose">Reviewer note: {winning.review_note}</p>
                  )}
                  {winning.paid_at && <p className="text-ink-muted">Paid on {format(parseISO(winning.paid_at), "d MMMM yyyy")}</p>}
                  {(winning.stage === "needs_proof" || winning.stage === "rejected") && <ProofUpload winnerId={winning.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
