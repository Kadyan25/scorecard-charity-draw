import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { DrawBalls } from "@/components/draws/draw-balls";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { upcomingDraw } from "@/services/draw-inputs";
import { listPublishedDraws } from "@/services/draw-queries";

export const metadata: Metadata = {
  title: "Draw results",
  description: "Monthly draw results. Your five latest scores are your numbers — match three or more to win.",
};

const TIERS = [
  { match: "5", share: "40%", note: "Jackpot — rolls over if nobody hits it" },
  { match: "4", share: "35%", note: "Split equally between winners" },
  { match: "3", share: "25%", note: "Split equally between winners" },
];

export default async function DrawsPage() {
  const [next, draws] = await Promise.all([upcomingDraw(), listPublishedDraws(12)]);

  return (
    <>
      <section className="bg-ink text-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember-soft">
              Next draw · {format(parseISO(next.period), "MMMM yyyy")}
            </p>
            <h1 className="mt-4 text-5xl leading-[1.05] text-canvas sm:text-6xl">Your scores are your numbers.</h1>
            <p className="mt-5 max-w-lg text-lg text-canvas/70">
              Every month we draw five numbers from 1 to 45. Match three, four or all five of your latest
              Stableford scores to win a share of the pool.
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-canvas/15 bg-canvas/5 p-7">
            <p className="text-sm text-canvas/70">Jackpot for 5 matches, at least</p>
            <p className="tabular mt-2 font-[family-name:var(--font-display)] text-6xl text-ember-soft">
              {formatCents(next.estimatedJackpotCents)}
            </p>
            <p className="tabular mt-3 text-sm text-canvas/60">
              {next.activeSubscriberCount} active {next.activeSubscriberCount === 1 ? "member" : "members"}
              {next.rolloverInCents > 0 && ` · includes ${formatCents(next.rolloverInCents)} rolled over`}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl text-ink">How the pool is shared</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div key={tier.match} className="rounded-[var(--radius-card)] border border-line bg-canvas-raised p-6">
              <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ember">{tier.share}</p>
              <p className="mt-2 font-medium text-ink">{tier.match} matching numbers</p>
              <p className="mt-1 text-sm text-ink-muted">{tier.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-3xl text-ink">Past results</h2>
        {draws.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-line-strong p-10 text-center">
            <p className="text-ink-muted">The first draw hasn&apos;t happened yet. Join now and your scores will be in it.</p>
            <Link href="/signup" className={buttonVariants({ className: "mt-6" })}>Join the first draw</Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {draws.map((draw) => (
              <li
                key={draw.id}
                className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-canvas-raised p-6 md:grid-cols-[10rem_1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-lg text-ink">{format(parseISO(draw.period_month), "MMMM yyyy")}</p>
                  <p className="text-xs uppercase tracking-wider text-ink-subtle">
                    {draw.mode === "algorithmic" ? "Algorithmic" : "Random"} draw
                  </p>
                </div>
                <DrawBalls numbers={draw.numbers} size="sm" />
                <dl className="tabular grid grid-cols-4 gap-4 text-sm md:text-right">
                  <div><dt className="text-ink-subtle">Pool</dt><dd className="text-ink">{formatCents(draw.pool_total_cents)}</dd></div>
                  <div><dt className="text-ink-subtle">5s</dt><dd className="text-ink">{draw.winnerCounts[5] || (draw.rollover_out_cents > 0 ? "Rolled" : "0")}</dd></div>
                  <div><dt className="text-ink-subtle">4s</dt><dd className="text-ink">{draw.winnerCounts[4]}</dd></div>
                  <div><dt className="text-ink-subtle">3s</dt><dd className="text-ink">{draw.winnerCounts[3]}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
