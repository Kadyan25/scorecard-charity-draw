import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { WinnerActions } from "@/components/admin/winner-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { StageBadge } from "@/components/winnings/stage-badge";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listWinnersForAdmin } from "@/services/winner-queries";
import type { WinnerStage } from "@/services/winner-rules";

export const metadata: Metadata = { title: "Winners · Admin" };

const FILTERS: { key: string; label: string; stages: WinnerStage[] | null }[] = [
  { key: "review", label: "Needs review", stages: ["under_review"] },
  { key: "payout", label: "Awaiting payout", stages: ["approved_unpaid"] },
  { key: "proof", label: "Awaiting proof", stages: ["needs_proof", "rejected"] },
  { key: "paid", label: "Paid", stages: ["paid"] },
  { key: "all", label: "All", stages: null },
];

export default async function AdminWinnersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const requested = (await searchParams).view;
  const filter = FILTERS.find((option) => option.key === requested) ?? FILTERS[0];
  const all = await listWinnersForAdmin();
  const shown = filter.stages ? all.filter((winner) => filter.stages?.includes(winner.stage)) : all;
  const countFor = (stages: WinnerStage[] | null) => (stages ? all.filter((w) => stages.includes(w.stage)).length : all.length);

  return (
    <>
      <PageHeader eyebrow="Winners" title="Verification & payouts" description="Check each winner's proof, approve or reject it, then record the payout once the money has been sent." />
      <nav aria-label="Filter winners" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.key}
            href={`/admin/winners?view=${option.key}`}
            aria-current={option.key === filter.key ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", option.key === filter.key ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-muted hover:border-ink hover:text-ink")}
          >
            {option.label} <span className="tabular opacity-70">{countFor(option.stages)}</span>
          </Link>
        ))}
      </nav>
      <Card className="overflow-hidden p-0">
        {shown.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Nothing here right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas-sunken text-xs uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Winner</th>
                  <th scope="col" className="px-5 py-3 font-medium">Draw</th>
                  <th scope="col" className="px-5 py-3 font-medium">Prize</th>
                  <th scope="col" className="px-5 py-3 font-medium">Proof</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {shown.map((winner) => (
                  <tr key={winner.id}>
                    <td className="px-5 py-4"><p className="text-ink">{winner.memberName}</p><p className="text-xs text-ink-subtle">{winner.memberEmail}</p></td>
                    <td className="px-5 py-4 text-ink-muted">{winner.periodMonth ? format(parseISO(winner.periodMonth), "MMM yyyy") : "—"}<br /><span className="text-xs">{winner.tier} numbers</span></td>
                    <td className="tabular px-5 py-4 font-medium text-ink">{formatCents(winner.prize_cents)}</td>
                    <td className="px-5 py-4">
                      {winner.proofUrl ? (
                        <a href={winner.proofUrl} target="_blank" rel="noreferrer" className="block w-24">
                          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
                          <img src={winner.proofUrl} alt={`Proof submitted by ${winner.memberName}`} className="h-16 w-24 rounded-md border border-line object-cover" />
                        </a>
                      ) : (
                        <span className="text-ink-subtle">Not submitted</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StageBadge stage={winner.stage} />
                      {winner.review_note && <p className="mt-2 max-w-[14rem] text-xs text-ink-muted">“{winner.review_note}”</p>}
                    </td>
                    <td className="px-5 py-4"><WinnerActions winnerId={winner.id} stage={winner.stage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
