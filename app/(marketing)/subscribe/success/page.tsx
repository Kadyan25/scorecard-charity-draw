import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { confirmCheckoutSession } from "@/services/billing-sync";

export const metadata: Metadata = { title: "Welcome aboard" };

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const viewer = await requireUser();
  const { session_id: sessionId } = await searchParams;
  const confirmed = sessionId ? await confirmCheckoutSession(sessionId, viewer.userId) : false;

  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">You&apos;re in</p>
      <h1 className="mt-3 text-5xl text-ink">Welcome to Digital Heroes.</h1>
      {confirmed ? (
        <p className="mt-5 text-lg text-ink-muted">
          Your membership is active and your first contribution is already on its way to your
          charity. Log five scores to complete your draw ticket.
        </p>
      ) : (
        <Alert className="mx-auto mt-6 max-w-md text-left">
          We&apos;re still confirming your payment with Stripe. It usually takes a few seconds —
          your dashboard will update automatically.
        </Alert>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard/scores" className={buttonVariants({ size: "lg" })}>Enter your scores</Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>Go to dashboard</Link>
      </div>
    </section>
  );
}
