import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { DrawControls } from "@/components/admin/draw-controls";
import { DrawWinnersTable } from "@/components/admin/draw-winners-table";
import { PublishDrawButton } from "@/components/admin/publish-draw-button";
import { DrawBalls } from "@/components/draws/draw-balls";
import { MatchHistogram } from "@/components/draws/match-histogram";
import { PrizeBreakdown } from "@/components/draws/prize-breakdown";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { gatherDrawInputs, upcomingDraw } from "@/services/draw-inputs";
import { listPublishedDraws, loadAdminDrawView } from "@/services/draw-queries";

export const metadata: Metadata = { title: "Draws · Admin" };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="tabular mt-1 font-[family-name:var(--font-display)] text-3xl text-ink">{value}</dd>
    </div>
  );
}

export default async function AdminDrawsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const requested = (await searchParams).month;
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : (await upcomingDraw()).period.slice(0, 7);
  const period = `${month}-01`;
  const [inputs, view, history] = await Promise.all([gatherDrawInputs(period), loadAdminDrawView(period), listPublishedDraws(6)]);
  const { draw } = view;
  const published = draw?.status === "published";
  const winnerCount = view.winnerCounts[5] + view.winnerCounts[4] + view.winnerCounts[3];

  return (
    <>
      <PageHeader eyebrow="Draw management" title={format(parseISO(period), "MMMM yyyy")} description="Choose the logic, simulate as many times as you like, then publish. Members only see results after publishing." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card><DrawControls month={month} locked={published} /></Card>
        <Card>
          <CardEyebrow>If you drew right now</CardEyebrow>
          <dl className="mt-3 grid grid-cols-2 gap-5">
            <Stat label="Active subscribers" value={inputs.activeSubscriberCount} />
            <Stat label="Eligible entries" value={inputs.tickets.length} />
            <Stat label="Member contributions" value={formatCents(inputs.contributionCents)} />
            <Stat label="Jackpot rolled in" value={formatCents(inputs.rolloverInCents)} />
          </dl>
          <p className="mt-4 text-xs text-ink-subtle">Eligible means an active subscription and exactly five retained scores.</p>
        </Card>
      </div>

      {draw ? (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>{published ? "Published result" : "Simulation"}</CardTitle>
              <Badge tone={published ? "positive" : "warning"}>{published ? "Live" : "Not published"}</Badge>
              <Badge>{draw.mode === "algorithmic" ? "Algorithmic" : "Random"}</Badge>
            </div>
            {!published && <PublishDrawButton drawId={draw.id} winnerCount={winnerCount} />}
          </div>
          <div className="mt-6"><DrawBalls numbers={draw.numbers} size="lg" /></div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <PrizeBreakdown draw={draw} winners={view.winnerCounts} />
            <MatchHistogram histogram={view.histogram} />
          </div>
          <div className="mt-8">
            <h3 className="mb-3 text-xl text-ink">Winners</h3>
            <DrawWinnersTable entries={view.entries} />
          </div>
        </Card>
      ) : (
        <Card className="mt-5 text-center text-ink-muted">No simulation for this month yet. Run one to preview the result.</Card>
      )}

      <Card className="mt-5">
        <CardEyebrow>History</CardEyebrow>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">No draws published yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((past) => (
              <li key={past.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-ink">{format(parseISO(past.period_month), "MMMM yyyy")}</span>
                <span className="tabular text-sm text-ink-muted">{past.numbers.join(" · ")}</span>
                <span className="tabular text-sm text-ink">{formatCents(past.pool_total_cents)} pool · {past.winnerCounts[5] + past.winnerCounts[4] + past.winnerCounts[3]} winners</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
