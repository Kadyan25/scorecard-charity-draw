import type { Metadata } from "next";
import Link from "next/link";
import { PaymentHistory } from "@/components/billing/payment-history";
import { StripeRedirectButton } from "@/components/billing/stripe-redirect-button";
import { SubscriptionStatus } from "@/components/dashboard/subscription-status";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { requireSubscriberContext } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { loadBillingOverview } from "@/services/billing-queries";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const subscriber = await requireSubscriberContext();
  const billing = await loadBillingOverview(subscriber.userId);

  return (
    <>
      <PageHeader eyebrow="Billing" title="Your membership" description="Plan, renewal and a record of every payment, including exactly how much reached your charity." />
      <div className="grid gap-5 md:grid-cols-2">
        <SubscriptionStatus access={subscriber.access} />
        <Card>
          <CardEyebrow>Plan</CardEyebrow>
          <CardTitle>{billing.plan ? billing.plan.name : "No plan yet"}</CardTitle>
          {billing.plan && (
            <p className="tabular mt-2 text-sm text-ink-muted">
              {formatCents(billing.plan.amount_cents, billing.plan.currency)} per {billing.plan.interval}
            </p>
          )}
          <div className="mt-5">
            {billing.hasBillingAccount ? (
              <StripeRedirectButton endpoint="/api/stripe/portal" label="Manage payment & cancellation" variant="outline" />
            ) : (
              <Link href="/subscribe" className={buttonVariants({ size: "sm" })}>Choose a plan</Link>
            )}
          </div>
        </Card>
      </div>
      <div className="mt-5">
        <PaymentHistory payments={billing.payments} />
      </div>
    </>
  );
}
