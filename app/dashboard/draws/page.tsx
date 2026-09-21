import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { DrawBalls } from "@/components/draws/draw-balls";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireSubscriberContext } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { upcomingDraw } from "@/services/draw-inputs";
import { listMemberEntries } from "@/services/draw-queries";
import { listScores } from "@/services/score";

export const metadata: Metadata = { title: "My draws" };

function eligibility(hasAccess: boolean, scoreCount: number): { ok: boolean; text: string } {
  if (!hasAccess) return { ok: false, text: "You need an active membership to be entered." };
  const missing = 5 - scoreCount;
  if (missing > 0) return { ok: false, text: `Log ${missing} more ${missing === 1 ? "score" : "scores"} to be entered.` };
  return { ok: true, text: "You are entered with your current five scores." };
}

export default async function MyDrawsPage() {
  const member = await requireSubscriberContext();
  const [entries, next, scores] = await Promise.all([
    listMemberEntries(member.userId),
    upcomingDraw(),
    member.access.hasAccess ? listScores(member.userId) : Promise.resolve([]),
  ]);
  const status = eligibility(member.access.hasAccess, scores.length);
  const won = entries.filter((entry) => entry.tier !== null);

  return (
    <>
      <PageHeader
        eyebrow="Draws"
        title="Your participation"
        description="Every published draw you were part of, and where you stand for the next one."
      />
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardEyebrow>Next draw</CardEyebrow>
          <CardTitle>{format(parseISO(next.period), "MMMM yyyy")}</CardTitle>
          <Badge tone={status.ok ? "positive" : "warning"} className="mt-3">
            {status.ok ? "Entered" : "Not entered yet"}
          </Badge>
          <p className="mt-3 text-sm text-ink-muted">{status.text}</p>
          {!status.ok && (
            <Link
              href={member.access.hasAccess ? "/dashboard/scores" : "/subscribe"}
              className={buttonVariants({ size: "sm", className: "mt-4" })}
            >
              {member.access.hasAccess ? "Add scores" : "See plans"}
            </Link>
          )}
        </Card>
        <Card>
          <CardEyebrow>Draws entered</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-5xl text-ink">{entries.length}</p>
          <p className="mt-2 text-sm text-ink-muted">{won.length} with a prize</p>
        </Card>
        <Card>
          <CardEyebrow>Jackpot this month</CardEyebrow>
          <p className="tabular font-[family-name:var(--font-display)] text-5xl text-ember">
            {formatCents(next.estimatedJackpotCents)}
          </p>
          <p className="mt-2 text-sm text-ink-muted">for matching all five</p>
        </Card>
      </div>
      <Card className="mt-5">
        <CardEyebrow>History</CardEyebrow>
        <CardTitle>Past draws</CardTitle>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            You have not been in a published draw yet. Results appear here as soon as they are announced.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id} className="grid gap-4 py-5 md:grid-cols-[9rem_1fr_auto] md:items-center">
                <p className="text-ink">{format(parseISO(entry.draw.period_month), "MMMM yyyy")}</p>
                <div className="space-y-2">
                  <DrawBalls numbers={entry.draw.numbers} mine={entry.numbers} size="sm" />
                  <p className="tabular text-xs text-ink-subtle">Your numbers: {entry.numbers.join(" · ")}</p>
                </div>
                <div className="md:text-right">
                  <p className="tabular text-ink">{entry.matched_count} matched</p>
                  {entry.tier !== null ? (
                    <Badge tone="ember" className="mt-1">Won {formatCents(entry.prize_cents)}</Badge>
                  ) : (
                    <p className="text-sm text-ink-subtle">No prize</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
