import type { Metadata } from "next";
import { LockedFeature } from "@/components/scores/locked-feature";
import { ScoreEntryForm } from "@/components/scores/score-entry-form";
import { ScoreRow } from "@/components/scores/score-row";
import { TicketBalls } from "@/components/scores/ticket-balls";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireSubscriberContext } from "@/lib/auth";
import { listScores } from "@/services/score";
import { describeTicket, latestAllowedPlayDate } from "@/services/score-rules";

export const metadata: Metadata = { title: "My scores" };

function ticketHeadline(count: number, remaining: number): string {
  if (remaining === 0) return "Your ticket is complete";
  if (count === 0) return "Log your first round";
  return `${remaining} more ${remaining === 1 ? "round" : "rounds"} to complete your ticket`;
}

export default async function ScoresPage() {
  const subscriber = await requireSubscriberContext();
  const header = (
    <PageHeader eyebrow="My scores" title="Your five, your numbers" description="Your five most recent Stableford scores are your numbers in the monthly draw. Log a new round and it replaces your oldest." />
  );

  if (!subscriber.access.hasAccess) {
    return (
      <>
        {header}
        <LockedFeature title="Score entry is for members" body="Subscribe to log rounds and turn your scores into draw numbers." />
      </>
    );
  }

  const scores = await listScores(subscriber.userId);
  const ticket = describeTicket(scores);
  const maxDate = latestAllowedPlayDate();

  return (
    <>
      {header}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardEyebrow>Draw ticket · {ticket.count} of 5</CardEyebrow>
          <CardTitle className="mb-5">{ticketHeadline(ticket.count, ticket.remaining)}</CardTitle>
          <TicketBalls numbers={ticket.numbers} />
          {ticket.hasDuplicates && (
            <p className="mt-4 text-sm text-ink-muted">You have a repeated score — it counts once when matching the draw.</p>
          )}
        </Card>
        <Card>
          <CardEyebrow>New round</CardEyebrow>
          <CardTitle className="mb-5">Add a score</CardTitle>
          <ScoreEntryForm maxDate={maxDate} nextToReplace={ticket.nextToReplace} />
        </Card>
      </div>
      <Card className="mt-5">
        <CardEyebrow>History</CardEyebrow>
        <CardTitle>Retained rounds, newest first</CardTitle>
        {scores.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No rounds yet. Your first score will appear here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {scores.map((score) => (
              <ScoreRow key={`${score.id}-${score.updated_at}`} score={score} maxDate={maxDate} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
