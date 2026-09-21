import type { Metadata } from "next";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { listActivePlans } from "@/services/plans";

export const metadata: Metadata = { title: "Choose a plan" };

export default async function SubscribePage() {
  const plans = await listActivePlans();

  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <h1 className="text-5xl text-ink">Choose how you play</h1>
      <p className="mt-3 max-w-xl text-ink-muted">
        Every plan enters you into every monthly draw and funds your chosen charity.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardEyebrow>{plan.name}</CardEyebrow>
            <CardTitle className="tabular text-4xl">
              {formatCents(plan.amount_cents, plan.currency)}
              <span className="text-base text-ink-muted"> / {plan.interval}</span>
            </CardTitle>
            <p className="mt-3 text-sm text-ink-muted">{plan.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
