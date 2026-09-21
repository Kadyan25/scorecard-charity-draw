import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DrawBalls } from "@/components/draws/draw-balls";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActivePlans } from "@/services/plans";
import { loadSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "How it works",
  description: "How your scores become draw numbers, how prizes are shared, and where every penny of your membership goes.",
};

const FAQ = [
  {
    q: "What if I score the same number twice?",
    a: "It counts once. Your ticket is matched on distinct numbers, so two rounds of 30 match a drawn 30 once, not twice.",
  },
  {
    q: "Can I enter an old round?",
    a: "Yes, while you have fewer than five scores. Once your ticket is full, a new round replaces your oldest one — so a round older than all five you keep would be pushed straight back out. Rather than accept it and quietly drop it, we stop you and tell you why.",
  },
  {
    q: "What happens if nobody matches all five?",
    a: "The jackpot rolls into next month's draw and keeps growing until someone hits it.",
  },
  {
    q: "And if nobody matches four, or three?",
    a: "Those prize shares don't roll over. They go to our partner charities instead, split in proportion to how many members support each one.",
  },
  {
    q: "How do I get paid if I win?",
    a: "Upload a screenshot of your scores from your golf app. Once our team verifies it, your prize moves from pending to paid, and you can follow each step in your dashboard.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep your membership, and your place in the draws, until the end of the period you have paid for.",
  },
];

export default async function HowItWorksPage() {
  const supabase = await createSupabaseServerClient();
  const [settings, plans] = await Promise.all([loadSettings(supabase), listActivePlans()]);
  const monthly = plans.find((plan) => plan.interval === "month");
  const yearly = plans.find((plan) => plan.interval === "year");

  return (
    <article>
      <header className="mx-auto max-w-4xl px-4 pb-12 pt-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">How it works</p>
        <h1 className="mt-3 text-5xl leading-[1.05] text-ink sm:text-6xl">Your scores are your numbers.</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-muted">
          Digital Heroes is a monthly membership. You log your golf scores, they become your ticket in a prize draw, and a
          share of every payment goes to a charity you picked. Here is exactly how each part works.
        </p>
      </header>

      <section className="mx-auto grid max-w-4xl gap-16 px-4 sm:px-6">
        <Reveal>
          <h2 className="text-3xl text-ink">1. Your membership</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            {monthly && `${formatCents(monthly.amount_cents, monthly.currency)} a month`}
            {yearly && `, or ${formatCents(yearly.amount_cents, yearly.currency)} a year`}. When you join you choose a charity,
            and at least {settings.charityPercentMin}% of every payment goes to it — you can raise that to {settings.charityPercentMax}%
            whenever you like. {settings.prizePoolPercent}% funds the prize pool, and the rest keeps the platform running.
          </p>
        </Reveal>

        <Reveal>
          <h2 className="text-3xl text-ink">2. Your ticket</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            After each round, log your Stableford score — any whole number from 1 to 45, one per day. We keep your five most
            recent scores. Those five numbers are your ticket for this month&apos;s draw. Play again and your newest score
            replaces your oldest.
          </p>
          <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-canvas-raised p-6">
            <p className="mb-3 text-sm text-ink-muted">Example ticket</p>
            <DrawBalls numbers={[34, 29, 31, 27, 36]} />
          </div>
        </Reveal>

        <Reveal>
          <h2 className="text-3xl text-ink">3. The monthly draw</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Once a month we draw five numbers from 1 to 45. Each draw is either a straightforward random draw or an
            algorithmic one, where numbers members actually scored are a little more likely to come up — every number can
            still be drawn, and the results page shows which kind ran. Each draw is simulated and checked before the
            result is published.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            To be in a draw you need an active membership and a full ticket of five scores on the day it runs.
          </p>
        </Reveal>

        <Reveal>
          <h2 className="text-3xl text-ink">4. Prizes</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { match: 5, share: settings.tierSplit[5], note: "Rolls over if unclaimed" },
              { match: 4, share: settings.tierSplit[4], note: "Split equally" },
              { match: 3, share: settings.tierSplit[3], note: "Split equally" },
            ].map((tier) => (
              <div key={tier.match} className="rounded-[var(--radius-card)] border border-line bg-canvas-raised p-6">
                <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ember">{tier.share}%</p>
                <p className="mt-2 font-medium text-ink">Match {tier.match}</p>
                <p className="text-sm text-ink-muted">{tier.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">
            The pool is built from every active member&apos;s contribution that month, plus any jackpot carried over.
            Winners upload proof of their scores, our team verifies it, and the prize is paid.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-3xl text-ink">Questions people ask</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg text-ink">
                {item.q}
                <span aria-hidden className="text-2xl text-ember transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>Join and choose a cause <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <Link href="/charities" className={buttonVariants({ variant: "outline", size: "lg" })}>Browse charities</Link>
        </div>
      </section>
    </article>
  );
}
