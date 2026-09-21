import type { Metadata } from "next";
import { SubscriptionStatus } from "@/components/dashboard/subscription-status";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { WinningsCard } from "@/components/dashboard/winnings-card";
import { PageHeader } from "@/components/shell/page-header";
import { requireSubscriberContext } from "@/lib/auth";
import { listScores } from "@/services/score";
import { describeTicket } from "@/services/score-rules";
import { listMyWinnings } from "@/services/winner-queries";
import { summariseWinnings } from "@/services/winner-rules";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const subscriber = await requireSubscriberContext();
  const firstName = subscriber.profile.full_name?.split(" ")[0] ?? "there";
  const [scores, winnings] = await Promise.all([
    subscriber.access.hasAccess ? listScores(subscriber.userId) : Promise.resolve(null),
    listMyWinnings(subscriber.userId),
  ]);
  const ticket = scores ? describeTicket(scores) : null;

  return (
    <>
      <PageHeader eyebrow="Overview" title={`Hello, ${firstName}`} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <SubscriptionStatus access={subscriber.access} />
        {ticket && <TicketCard ticket={ticket} />}
        <WinningsCard summary={summariseWinnings(winnings)} />
      </div>
    </>
  );
}
