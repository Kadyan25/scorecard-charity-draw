import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { MemberProfileForm } from "@/components/admin/member-profile-form";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import { SubscriptionStatus } from "@/components/dashboard/subscription-status";
import { ScoreEntryForm } from "@/components/scores/score-entry-form";
import { ScoreRow } from "@/components/scores/score-row";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMemberDetail } from "@/services/admin-members";
import { listActiveCharities } from "@/services/charity";
import { describeTicket, latestAllowedPlayDate } from "@/services/score-rules";
import { loadSettings } from "@/services/settings";
import { userIdSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Member · Admin" };

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsed = userIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const [member, charities, settings] = await Promise.all([
    getMemberDetail(parsed.data),
    listActiveCharities(),
    loadSettings(createSupabaseAdminClient()),
  ]);
  if (!member) notFound();

  const { profile, subscription } = member;
  const ticket = describeTicket(member.scores);
  const maxDate = latestAllowedPlayDate();

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">← All members</Link>
      <PageHeader eyebrow={profile.role === "admin" ? "Administrator" : "Member"} title={profile.full_name ?? "Unnamed member"} description={`${profile.email} · joined ${format(parseISO(profile.created_at), "d MMMM yyyy")}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardEyebrow>Profile</CardEyebrow>
          <MemberProfileForm
            userId={profile.id}
            fullName={profile.full_name ?? ""}
            charityId={profile.charity_id}
            charityPercent={profile.charity_percent}
            charities={charities.map(({ id, name }) => ({ id, name }))}
            percentMin={settings.charityPercentMin}
            percentMax={settings.charityPercentMax}
          />
        </Card>
        <div className="space-y-5">
          <SubscriptionStatus access={member.access} />
          <Card>
            <CardEyebrow>Manage subscription</CardEyebrow>
            <p className="mb-4 text-sm text-ink-muted">
              {subscription?.stripe_subscription_id
                ? `${member.plan?.name ?? "Stripe"} plan · billed through Stripe (${subscription.stripe_subscription_id})`
                : subscription?.status === "active"
                  ? "Complimentary access — no payment, not counted towards the prize pool."
                  : "No active subscription."}
            </p>
            <SubscriptionActions userId={profile.id} actions={member.actions} />
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardEyebrow>Scores · {ticket.count} of 5</CardEyebrow>
          <CardTitle className="mb-4">Add a score for this member</CardTitle>
          <ScoreEntryForm maxDate={maxDate} nextToReplace={ticket.nextToReplace} createUrl={`/api/admin/users/${profile.id}/scores`} />
        </Card>
        <Card>
          <CardTitle>Retained scores</CardTitle>
          {member.scores.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No scores logged.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {member.scores.map((score) => (
                <ScoreRow key={`${score.id}-${score.updated_at}`} score={score} maxDate={maxDate} itemBaseUrl="/api/admin/scores" />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardTitle>Payments</CardTitle>
        {member.payments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No payments recorded.</p>
        ) : (
          <ul className="tabular mt-3 divide-y divide-line text-sm">
            {member.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-2.5">
                <span className="text-ink-muted">{payment.paid_at ? format(parseISO(payment.paid_at), "d MMM yyyy") : "—"}</span>
                <span className="text-ink">{formatCents(payment.amount_cents, payment.currency)}</span>
                <span className="text-ink-muted">charity {formatCents(payment.charity_amount_cents, payment.currency)} · pool {formatCents(payment.prize_pool_amount_cents, payment.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
