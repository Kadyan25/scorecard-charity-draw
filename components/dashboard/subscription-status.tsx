import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import type { Access } from "@/services/subscription";

const COPY: Record<Access["state"], { label: string; tone: "positive" | "warning" | "negative" | "neutral" }> = {
  active: { label: "Active", tone: "positive" },
  cancelling: { label: "Cancelling", tone: "warning" },
  past_due: { label: "Payment failed", tone: "negative" },
  lapsed: { label: "Lapsed", tone: "negative" },
  none: { label: "Not subscribed", tone: "neutral" },
};

function periodLine(access: Access): string | null {
  if (!access.periodEnd) return null;
  const date = format(new Date(access.periodEnd), "d MMMM yyyy");
  if (access.state === "active") return `Renews on ${date}`;
  if (access.state === "cancelling") return `Access ends on ${date}`;
  if (access.state === "lapsed") return `Ended on ${date}`;
  return null;
}

export function SubscriptionStatus({ access }: { access: Access }) {
  const copy = COPY[access.state];
  const line = periodLine(access);

  return (
    <Card>
      <CardEyebrow>Subscription</CardEyebrow>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{access.hasAccess ? "You're in the draw" : "Not in the draw"}</CardTitle>
        <Badge tone={copy.tone}>{copy.label}</Badge>
      </div>
      {line && <p className="mt-2 text-sm text-ink-muted">{line}</p>}
      <div className="mt-5">
        {access.hasAccess ? (
          <Link href="/dashboard/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Manage billing
          </Link>
        ) : (
          <Link href="/subscribe" className={buttonVariants({ size: "sm" })}>
            {access.state === "past_due" ? "Fix payment" : "Subscribe"}
          </Link>
        )}
      </div>
    </Card>
  );
}
