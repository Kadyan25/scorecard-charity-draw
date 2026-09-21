import type { Metadata } from "next";
import Link from "next/link";
import { CharityPicker } from "@/components/charity/charity-picker";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireSubscriberContext } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActiveCharities, memberGivingTotals } from "@/services/charity";
import { listActivePlans, monthlyPlan } from "@/services/plans";
import { loadSettings } from "@/services/settings";

export const metadata: Metadata = { title: "My charity" };

export default async function MyCharityPage() {
  const member = await requireSubscriberContext();
  const supabase = await createSupabaseServerClient();
  const [charities, plans, settings, giving] = await Promise.all([
    listActiveCharities(),
    listActivePlans(),
    loadSettings(supabase),
    memberGivingTotals(member.userId),
  ]);
  const current = charities.find((charity) => charity.id === member.profile.charity_id) ?? null;
  const totalGiven = giving.viaSubscriptionCents + giving.viaDonationsCents;

  return (
    <>
      <PageHeader eyebrow="My charity" title="Where your membership goes" description="Change your cause or raise your contribution at any time. Changes apply from your next payment." />
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardEyebrow>Supporting</CardEyebrow>
          <CardTitle>{current ? current.name : "No charity selected"}</CardTitle>
          {current && (
            <Link href={`/charities/${current.slug}`} className="mt-3 inline-block text-sm font-medium text-ember hover:text-ember-strong">
              View charity profile →
            </Link>
          )}
        </Card>
        <Card>
          <CardEyebrow>Contribution</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ember">{member.profile.charity_percent}%</p>
          <p className="mt-1 text-sm text-ink-muted">of every membership payment</p>
        </Card>
        <Card>
          <CardEyebrow>You&apos;ve given</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ink">{formatCents(totalGiven, settings.currency)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatCents(giving.viaSubscriptionCents, settings.currency)} via membership · {formatCents(giving.viaDonationsCents, settings.currency)} in direct gifts
          </p>
        </Card>
      </div>
      <Card className="mt-5">
        <CharityPicker
          options={charities.map(({ id, name, category, tagline }) => ({ id, name, category, tagline }))}
          currentId={member.profile.charity_id}
          currentPercent={member.profile.charity_percent}
          min={settings.charityPercentMin}
          max={settings.charityPercentMax}
          monthlyAmountCents={monthlyPlan(plans)?.amount_cents ?? 0}
          currency={settings.currency}
        />
      </Card>
    </>
  );
}
