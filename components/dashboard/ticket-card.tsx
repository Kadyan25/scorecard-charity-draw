import Link from "next/link";
import { TicketBalls } from "@/components/scores/ticket-balls";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import type { TicketSummary } from "@/services/score-rules";

export function TicketCard({ ticket }: { ticket: TicketSummary }) {
  return (
    <Card>
      <CardEyebrow>Draw ticket · {ticket.count} of 5</CardEyebrow>
      <CardTitle className="mb-4">{ticket.complete ? "Ready for the draw" : "Ticket incomplete"}</CardTitle>
      <TicketBalls numbers={ticket.numbers} size="sm" />
      <Link href="/dashboard/scores" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-5" })}>
        {ticket.complete ? "Update scores" : "Add scores"}
      </Link>
    </Card>
  );
}
