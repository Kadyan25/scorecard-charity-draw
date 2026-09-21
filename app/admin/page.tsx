import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { loadReport } from "@/services/reports";

export const metadata: Metadata = { title: "Admin" };

function Tile({ label, value, detail, href }: { label: string; value: string | number; detail?: string; href: string }) {
  return (
    <Link href={href} className="group rounded-[var(--radius-card)] border border-line bg-canvas-raised p-6 shadow-lift transition-all hover:-translate-y-0.5 hover:shadow-raised">
      <CardEyebrow>{label}</CardEyebrow>
      <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ink">{value}</p>
      {detail && <p className="tabular mt-1.5 text-sm text-ink-muted">{detail}</p>}
    </Link>
  );
}

function Task({ count, label, href }: { count: number; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-ember hover:bg-ember-wash">
      <span className="text-ink"><span className="tabular mr-2 font-semibold text-ember">{count}</span>{label}</span>
      <ArrowRight aria-hidden className="h-4 w-4 text-ink-subtle" />
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const report = await loadReport();
  const { subscriptions: subs, winners } = report;
  const active = subs.monthly + subs.yearly + subs.complimentary;
  const charityTotal = report.charities.reduce((sum, charity) => sum + charity.total, 0);
  const tasks = [
    { count: winners.awaiting_review, label: "winner submissions to review", href: "/admin/winners?view=review" },
    { count: winners.awaiting_payout, label: "approved prizes to pay", href: "/admin/winners?view=payout" },
    { count: subs.pastDue, label: "members with a failed payment", href: "/admin/users" },
  ].filter((task) => task.count > 0);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Control room" description={`Next draw: ${format(parseISO(report.upcoming.period), "MMMM yyyy")} · ${formatCents(report.upcoming.estimatedJackpotCents)} jackpot`} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Members" value={report.members} detail={`${active} active subscribers`} href="/admin/users" />
        <Tile label="Current pool" value={formatCents(report.upcoming.estimatedPoolCents)} detail={`${formatCents(report.upcoming.rolloverInCents)} rolled in`} href="/admin/draws" />
        <Tile label="Raised for charity" value={formatCents(charityTotal)} detail={`${report.charities.filter((c) => c.isActive).length} charities listed`} href="/admin/charities" />
        <Tile label="Prizes awarded" value={formatCents(winners.prize_total)} detail={`${formatCents(winners.paid_total)} paid out`} href="/admin/winners?view=all" />
      </div>
      <Card className="mt-5">
        <CardEyebrow>Needs attention</CardEyebrow>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing waiting. Winner reviews, payouts and failed payments will appear here.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">{tasks.map((task) => <Task key={task.label} {...task} />)}</div>
        )}
      </Card>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/draws", label: "Run this month's draw" },
          { href: "/admin/reports", label: "Open full reports" },
          { href: "/admin/settings", label: "Adjust prize and charity rules" },
        ].map((link) => (
          <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-xl border border-line bg-canvas-raised px-5 py-4 text-ink transition-colors hover:border-ink">
            {link.label}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </>
  );
}
