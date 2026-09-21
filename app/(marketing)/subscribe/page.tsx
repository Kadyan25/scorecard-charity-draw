import type { Metadata } from "next";
import Link from "next/link";
import { StripeRedirectButton } from "@/components/billing/stripe-redirect-button";
import { PlanCard } from "@/components/billing/plan-card";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getViewer, loadAccess } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import type { PlanRow } from "@/lib/supabase/types";
import { listActivePlans } from "@/services/plans";

export const metadata: Metadata = { title: "Choose a plan" };

/** Yearly saving versus twelve monthly payments, shown as a badge. */
function yearlySaving(plans: PlanRow[]): string | undefined {
  const monthly = plans.find((plan) => plan.interval === "month");
  const yearly = plans.find((plan) => plan.interval === "year");
  if (!monthly || !yearly) return undefined;
  const saving = monthly.amount_cents * 12 - yearly.amount_cents;
  return saving > 0 ? `Save ${formatCents(saving, yearly.currency)} a year` : undefined;
}

function PlanAction({ plan, signedIn }: { plan: PlanRow; signedIn: boolean }) {
  const code = plan.code === "yearly" ? "yearly" : "monthly";
  if (!signedIn) {
    return (
      <Link href="/signup" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Join and choose {plan.name.toLowerCase()}
      </Link>
    );
  }
  return (
    <StripeRedirectButton
      endpoint="/api/stripe/checkout"
      body={{ planCode: code }}
      label={`Subscribe ${plan.name.toLowerCase()}`}
      variant={plan.interval === "year" ? "primary" : "ink"}
    />
  );
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [{ cancelled }, plans, viewer] = await Promise.all([searchParams, listActivePlans(), getViewer()]);
  const access = viewer ? await loadAccess(viewer.userId) : null;
  const saving = yearlySaving(plans);

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">Membership</p>
      <h1 className="mt-3 max-w-2xl text-5xl leading-[1.05] text-ink sm:text-6xl">
        One subscription. Every draw. A cause you chose.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-muted">
        Payments are processed by Stripe. Cancel any time from your dashboard — you keep access
        until the end of the period you paid for.
      </p>

      {cancelled && <Alert className="mt-8 max-w-xl">Checkout was cancelled. Nothing was charged.</Alert>}

      {access?.hasAccess ? (
        <Alert tone="success" className="mt-8 max-w-xl">
          You already have an active membership.{" "}
          <Link href="/dashboard" className="font-medium underline">Go to your dashboard</Link>
        </Alert>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} highlight={plan.interval === "year"} savingNote={plan.interval === "year" ? saving : undefined}>
              <PlanAction plan={plan} signedIn={viewer !== null} />
            </PlanCard>
          ))}
        </div>
      )}
    </section>
  );
}
