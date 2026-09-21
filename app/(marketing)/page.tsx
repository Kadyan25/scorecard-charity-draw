import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CharityCard } from "@/components/charity/charity-card";
import { CharitySpotlight } from "@/components/marketing/charity-spotlight";
import { CountUp } from "@/components/marketing/count-up";
import { HeroTicket } from "@/components/marketing/hero-ticket";
import { MoneySplit } from "@/components/marketing/money-split";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { formatCents, percentOf } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActiveCharities, loadImpact } from "@/services/charity";
import { upcomingDraw } from "@/services/draw-inputs";
import { listActivePlans, monthlyPlan } from "@/services/plans";
import { loadSettings } from "@/services/settings";

const STEPS = [
  { title: "Join and choose a cause", body: "Pick one of our partner charities when you sign up. At least 10% of every payment goes to them — raise it whenever you like." },
  { title: "Log your last five rounds", body: "Enter your Stableford scores after you play. Your five most recent scores are your numbers for the month's draw." },
  { title: "Watch the monthly draw", body: "Five numbers are drawn each month. Match three, four or all five of your scores and you win a share of the prize pool." },
];

const TIERS = [
  { match: 5, share: 40, note: "The jackpot. If nobody matches five, it rolls into next month." },
  { match: 4, share: 35, note: "Shared equally between everyone who matches four." },
  { match: 3, share: 25, note: "Shared equally between everyone who matches three." },
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const [charities, impact, next, plans, settings] = await Promise.all([
    listActiveCharities(),
    loadImpact(),
    upcomingDraw(),
    listActivePlans(),
    loadSettings(supabase),
  ]);
  const featured = charities.find((charity) => charity.is_featured) ?? charities[0];
  const others = charities.filter((charity) => charity.id !== featured?.id).slice(0, 3);
  const raised = [...impact.values()].reduce((sum, row) => sum + row.raisedCents, 0);
  const monthly = monthlyPlan(plans);
  const price = monthly?.amount_cents ?? 999;
  const month = format(parseISO(next.period), "MMMM");

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.15fr_1fr]">
          <Reveal>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-ember">A membership with a conscience</p>
            <h1 className="text-5xl leading-[1.02] text-ink sm:text-7xl">
              Play your best golf for someone <em className="text-ember not-italic">who needs it.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted">
              Your last five scores become your numbers in a monthly prize draw — and at least 10% of every
              membership goes straight to a charity you choose.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>Join and choose your cause <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href="/how-it-works" className={buttonVariants({ variant: "outline", size: "lg" })}>How it works</Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-ink-subtle">
              <ShieldCheck className="h-4 w-4" aria-hidden /> {formatCents(price, settings.currency)} a month · cancel any time · payments by Stripe
            </p>
          </Reveal>
          <HeroTicket charityName={featured?.name ?? "your charity"} charityShare={formatCents(percentOf(price, settings.charityPercentMin), settings.currency)} />
        </div>
      </section>

      <section aria-label="Impact so far" className="border-y border-line bg-canvas-raised">
        <dl className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            { label: "Raised for charity so far", value: <CountUp value={raised} format="cents" />, tone: "text-moss" },
            { label: "Members in this month's draw", value: <CountUp value={next.activeSubscriberCount} />, tone: "text-ink" },
            { label: `${month} jackpot for five matches`, value: <CountUp value={next.estimatedJackpotCents} format="cents" />, tone: "text-ember" },
          ].map((stat, index) => (
            // Label first in the markup for screen readers; shown beneath the figure.
            <Reveal key={stat.label} delay={index * 0.1} className="flex flex-col-reverse">
              <dt className="mt-2 text-ink-muted">{stat.label}</dt>
              <dd className={`font-[family-name:var(--font-display)] text-5xl sm:text-6xl ${stat.tone}`}>{stat.value}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="steps-heading">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">What you do</p>
          <h2 id="steps-heading" className="mt-3 max-w-2xl text-4xl text-ink sm:text-5xl">Three things. None of them take long.</h2>
        </Reveal>
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Reveal delay={index * 0.12} className="border-t border-ink pt-6">
                <span aria-hidden className="tabular font-[family-name:var(--font-display)] text-6xl text-ember-soft">0{index + 1}</span>
                <h3 className="mt-3 text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-muted">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-ink text-canvas" aria-labelledby="win-heading">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember-soft">How you win</p>
            <h2 id="win-heading" className="mt-3 text-4xl text-canvas sm:text-5xl">Every round you play reshuffles your numbers.</h2>
            <p className="mt-6 text-lg leading-relaxed text-canvas/70">
              Scores run from 1 to 45, and so do the draw numbers. Each month we draw five. Every number on your ticket
              that comes up is a match — and three or more wins you a share of the pool.
            </p>
            <Link href="/draws" className="mt-8 inline-flex items-center gap-2 font-medium text-ember-soft hover:text-canvas">
              See past results <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
          <div className="space-y-4">
            {TIERS.map((tier, index) => (
              <Reveal key={tier.match} delay={index * 0.1}>
                <div className="flex items-center gap-6 rounded-[var(--radius-card)] border border-canvas/10 bg-canvas/5 p-6 transition-colors hover:bg-canvas/10">
                  <span className="tabular w-24 shrink-0 font-[family-name:var(--font-display)] text-5xl text-ember-soft">{tier.share}%</span>
                  <span>
                    <span className="block text-lg text-canvas">Match {tier.match} numbers</span>
                    <span className="block text-sm text-canvas/60">{tier.note}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="money-heading">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">Nothing hidden</p>
          <h2 id="money-heading" className="mt-3 max-w-2xl text-4xl text-ink sm:text-5xl">Where your {formatCents(price, settings.currency)} goes.</h2>
          <p className="mt-4 max-w-2xl text-ink-muted">
            Every payment is split the moment it clears, and you can see your own split, line by line, in your dashboard.
            Choose to give more and the charity share grows — up to {settings.charityPercentMax}%.
          </p>
        </Reveal>
        <Reveal delay={0.15} className="mt-10">
          <MoneySplit amountCents={price} charityPercent={settings.charityPercentMin} poolPercent={settings.prizePoolPercent} currency={settings.currency} />
        </Reveal>
      </section>

      {featured && (
        <Reveal>
          <CharitySpotlight charity={featured} impact={impact.get(featured.id)} />
        </Reveal>
      )}

      {others.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="causes-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="causes-heading" className="text-3xl text-ink">More causes you can back</h2>
            <Link href="/charities" className="font-medium text-ember hover:text-ember-strong">All {charities.length} charities →</Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((charity, index) => (
              <Reveal key={charity.id} delay={index * 0.08}><CharityCard charity={charity} impact={impact.get(charity.id)} /></Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.75rem] bg-ember px-8 py-16 text-center text-white sm:px-16">
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <h2 className="relative mx-auto max-w-2xl text-4xl text-white sm:text-5xl">The {month} draw is open. Your cause is waiting.</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/95">Join in two minutes. Log five scores and you are in.</p>
            <Link href="/signup" className={buttonVariants({ variant: "ink", size: "lg", className: "relative mt-8" })}>
              Join Digital Heroes <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
