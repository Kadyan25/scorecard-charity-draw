import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { loadReport } from "@/services/reports";

export const metadata: Metadata = { title: "Reports · Admin" };

function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <CardEyebrow>{label}</CardEyebrow>
      <p className="tabular font-[family-name:var(--font-display)] text-4xl text-ink">{value}</p>
      {detail && <p className="tabular mt-1.5 text-sm text-ink-muted">{detail}</p>}
    </Card>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const report = await loadReport();
  const { subscriptions: subs, payments, winners, draws } = report;
  const active = subs.monthly + subs.yearly + subs.complimentary;
  const charityTotal = report.charities.reduce((sum, charity) => sum + charity.total, 0);
  const maxCharity = Math.max(1, ...report.charities.map((charity) => charity.total));

  return (
    <>
      <PageHeader eyebrow="Reports & analytics" title="How the platform is doing" description="Every figure is computed from recorded payments, draws and winners — nothing is estimated except the upcoming jackpot." />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total members" value={report.members} detail={`${report.admins} admin ${report.admins === 1 ? "account" : "accounts"} not counted`} />
        <Stat label="Active subscribers" value={active} detail={`${subs.monthly} monthly · ${subs.yearly} yearly · ${subs.complimentary} comp`} />
        <Stat label="Prize pools to date" value={formatCents(draws.pool_total)} detail={`${formatCents(winners.prize_total)} awarded · ${formatCents(winners.paid_total)} paid`} />
        <Stat label="Raised for charity" value={formatCents(charityTotal)} detail={`${formatCents(payments.charity)} memberships · ${formatCents(report.donations.total)} gifts`} />
      </div>

      <Card className="mt-5">
        <CardEyebrow>Where membership money went</CardEyebrow>
        <dl className="tabular mt-2 grid gap-5 sm:grid-cols-4">
          <div><dt className="text-sm text-ink-muted">Collected</dt><dd className="text-2xl text-ink">{formatCents(payments.gross)}</dd><dd className="text-xs text-ink-subtle">{payments.count} payments</dd></div>
          <div><dt className="text-sm text-ink-muted">To charities</dt><dd className="text-2xl text-moss">{formatCents(payments.charity)}</dd></div>
          <div><dt className="text-sm text-ink-muted">To prize pools</dt><dd className="text-2xl text-ember">{formatCents(payments.prize_pool)}</dd></div>
          <div><dt className="text-sm text-ink-muted">Platform</dt><dd className="text-2xl text-ink">{formatCents(payments.platform)}</dd></div>
        </dl>
        {subs.pastDue + subs.lapsed > 0 && (
          <p className="mt-4 text-sm text-ink-muted">{subs.pastDue} past due · {subs.lapsed} lapsed or cancelled</p>
        )}
      </Card>

      <Card className="mt-5">
        <CardTitle>Charity contributions</CardTitle>
        <p className="mt-1 text-sm text-ink-muted">Unclaimed 4- and 3-match prizes are shared between charities in proportion to their supporters.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="tabular w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Money raised per charity</caption>
            <thead className="text-xs uppercase tracking-wider text-ink-subtle">
              <tr>
                <th scope="col" className="pb-2 font-medium">Charity</th>
                <th scope="col" className="pb-2 font-medium">Supporters</th>
                <th scope="col" className="pb-2 font-medium">Memberships</th>
                <th scope="col" className="pb-2 font-medium">Gifts</th>
                <th scope="col" className="pb-2 font-medium">Unclaimed prizes</th>
                <th scope="col" className="w-1/4 pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.charities.map((charity) => (
                <tr key={charity.id}>
                  <th scope="row" className="py-2.5 pr-3 font-normal text-ink">{charity.name}{!charity.isActive && <span className="ml-1.5 text-xs text-ink-subtle">(hidden)</span>}</th>
                  <td className="py-2.5 text-ink">{charity.supporters}</td>
                  <td className="py-2.5 text-ink-muted">{formatCents(charity.fromSubscriptions)}</td>
                  <td className="py-2.5 text-ink-muted">{formatCents(charity.fromDonations)}</td>
                  <td className="py-2.5 text-ink-muted">{formatCents(charity.fromUnclaimedPrizes)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 rounded-r-[4px]" style={{ width: `${Math.max(2, (charity.total / maxCharity) * 70)}%`, background: "var(--color-data-win)", opacity: charity.total ? 1 : 0.3 }} />
                      <span className="whitespace-nowrap text-ink">{formatCents(charity.total)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardTitle>Draw statistics</CardTitle>
          <dl className="tabular mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-ink-muted">Draws published</dt><dd className="text-2xl text-ink">{draws.published}</dd></div>
            <div><dt className="text-ink-muted">Total entries</dt><dd className="text-2xl text-ink">{draws.entries}</dd></div>
            <div><dt className="text-ink-muted">Winners (5 · 4 · 3)</dt><dd className="text-2xl text-ink">{winners.tier5} · {winners.tier4} · {winners.tier3}</dd></div>
            <div><dt className="text-ink-muted">Jackpots rolled over</dt><dd className="text-2xl text-ink">{draws.jackpots_unclaimed}</dd></div>
            <div className="col-span-2 border-t border-line pt-4"><dt className="text-ink-muted">Next draw · {format(parseISO(report.upcoming.period), "MMMM yyyy")}</dt><dd className="text-2xl text-ember">{formatCents(report.upcoming.estimatedJackpotCents)} jackpot</dd></div>
          </dl>
        </Card>
        <Card>
          <CardTitle>Recent draws</CardTitle>
          {report.recent_draws.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No draws published yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="tabular w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-subtle">
                  <tr><th scope="col" className="pb-2 font-medium">Month</th><th scope="col" className="pb-2 font-medium">Entries</th><th scope="col" className="pb-2 font-medium">Pool</th><th scope="col" className="pb-2 font-medium">5 · 4 · 3</th><th scope="col" className="pb-2 font-medium">Rolled on</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.recent_draws.map((draw) => (
                    <tr key={draw.id}>
                      <td className="py-2.5 text-ink">{format(parseISO(draw.period_month), "MMM yyyy")}</td>
                      <td className="py-2.5 text-ink">{draw.entries}</td>
                      <td className="py-2.5 text-ink">{formatCents(draw.pool_total_cents)}</td>
                      <td className="py-2.5 text-ink">{draw.tier5} · {draw.tier4} · {draw.tier3}</td>
                      <td className="py-2.5 text-ink-muted">{formatCents(draw.rollover_out_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
