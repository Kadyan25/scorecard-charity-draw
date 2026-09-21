import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";
import { CharityCover } from "@/components/charity/charity-cover";
import { DonateForm } from "@/components/charity/donate-form";
import { SupportButton } from "@/components/charity/support-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { getViewer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getCharityBySlug, listUpcomingEvents, loadImpact } from "@/services/charity";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ donated?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const charity = await getCharityBySlug((await params).slug);
  return charity ? { title: charity.name, description: charity.tagline ?? undefined } : { title: "Charity not found" };
}

function SupportPanel({ charityId, slug, viewer }: { charityId: string; slug: string; viewer: Awaited<ReturnType<typeof getViewer>> }) {
  if (!viewer) {
    return (
      <Link href={`/signup?charity=${slug}`} className={buttonVariants({ size: "lg" })}>
        Join and support this charity
      </Link>
    );
  }
  if (viewer.profile.charity_id === charityId) {
    return <Badge tone="positive" className="px-4 py-2 text-sm">Your chosen charity · {viewer.profile.charity_percent}% of your membership</Badge>;
  }
  return <SupportButton charityId={charityId} currentPercent={viewer.profile.charity_percent} />;
}

export default async function CharityProfilePage({ params, searchParams }: Props) {
  const [{ slug }, { donated }] = await Promise.all([params, searchParams]);
  const charity = await getCharityBySlug(slug);
  if (!charity) notFound();

  const [events, impact, viewer] = await Promise.all([listUpcomingEvents(charity.id), loadImpact(), getViewer()]);
  const stats = impact.get(charity.id) ?? { supporters: 0, raisedCents: 0 };

  return (
    <article>
      <div className="h-64 sm:h-80">
        <CharityCover charity={charity} size="lg" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Badge>{charity.category}</Badge>
          <h1 className="mt-4 text-5xl leading-tight text-ink">{charity.name}</h1>
          {charity.tagline && <p className="mt-3 text-xl text-ink-muted">{charity.tagline}</p>}
          {donated && <Alert tone="success" className="mt-6">Thank you — your gift is on its way to {charity.name}.</Alert>}
          <div className="mt-8"><SupportPanel charityId={charity.id} slug={charity.slug} viewer={viewer} /></div>
          <div className="mt-10 space-y-5 text-lg leading-relaxed text-ink">
            <p>{charity.description}</p>
            {charity.mission && (
              <blockquote className="border-l-4 border-ember pl-5 font-[family-name:var(--font-display)] text-2xl text-ink">
                {charity.mission}
              </blockquote>
            )}
          </div>
          <section className="mt-12" aria-labelledby="events-heading">
            <h2 id="events-heading" className="text-3xl text-ink">Upcoming events</h2>
            {events.length === 0 ? (
              <p className="mt-4 text-ink-muted">No events announced yet.</p>
            ) : (
              <ul className="mt-5 space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="rounded-xl border border-line bg-canvas-raised p-5">
                    <p className="font-medium text-ink">{event.title}</p>
                    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden className="h-4 w-4" />{format(parseISO(event.event_date), "EEEE d MMMM yyyy")}</span>
                      {event.location && <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="h-4 w-4" />{event.location}</span>}
                    </p>
                    {event.description && <p className="mt-3 text-sm text-ink-muted">{event.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardEyebrow>Impact through Digital Heroes</CardEyebrow>
            <dl className="tabular mt-3 grid grid-cols-2 gap-4">
              <div><dt className="text-sm text-ink-muted">Raised</dt><dd className="font-[family-name:var(--font-display)] text-3xl text-ember">{formatCents(stats.raisedCents)}</dd></div>
              <div><dt className="text-sm text-ink-muted">Supporters</dt><dd className="font-[family-name:var(--font-display)] text-3xl text-ink">{stats.supporters}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardEyebrow>Give directly</CardEyebrow>
            <DonateForm charityId={charity.id} charityName={charity.name} />
          </Card>
        </aside>
      </div>
    </article>
  );
}
