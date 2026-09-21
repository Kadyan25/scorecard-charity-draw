/**
 * Subscription access rules (PRD section 04).
 *
 * Pure so the lifecycle can be tested without Stripe or a database. The
 * route guards call resolveAccess on every authenticated request — the PRD asks
 * for a real-time status check, so nothing here is cached on the client.
 */

import type { SubscriptionStatus } from "@/lib/supabase/types";

export type AccessState =
  | "active" // paid and renewing
  | "cancelling" // cancelled, but paid through the current period
  | "past_due" // renewal payment failed; Stripe is retrying
  | "lapsed" // period ended without renewal
  | "none"; // never subscribed

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Access {
  state: AccessState;
  hasAccess: boolean;
  /** Renewal date when renewing, end-of-access date when cancelling. */
  periodEnd: string | null;
}

function periodStillRunning(periodEnd: string | null, now: Date): boolean {
  // A missing period end on an active row means Stripe has not reported one
  // yet (the webhook fills it in) — treat the subscription as live.
  return periodEnd === null || new Date(periodEnd).getTime() > now.getTime();
}

/**
 * Past-due users lose access: the PRD gives non-subscribers restricted access,
 * and a failed renewal is not a paid subscription. They are shown a prompt to
 * fix payment rather than being treated as brand new.
 */
export function resolveAccess(
  subscription: SubscriptionSnapshot | null,
  now: Date = new Date(),
): Access {
  if (!subscription) {
    return { state: "none", hasAccess: false, periodEnd: null };
  }

  const { status, currentPeriodEnd, cancelAtPeriodEnd } = subscription;
  const running = periodStillRunning(currentPeriodEnd, now);

  if (status === "active" && running) {
    return {
      state: cancelAtPeriodEnd ? "cancelling" : "active",
      hasAccess: true,
      periodEnd: currentPeriodEnd,
    };
  }

  if (status === "past_due") {
    return { state: "past_due", hasAccess: false, periodEnd: currentPeriodEnd };
  }

  if (status === "incomplete" && !currentPeriodEnd) {
    return { state: "none", hasAccess: false, periodEnd: null };
  }

  return { state: "lapsed", hasAccess: false, periodEnd: currentPeriodEnd };
}

/** Pick the row that governs access when a user has several over time. */
export function pickGoverningSubscription<
  T extends SubscriptionSnapshot & { createdAt: string },
>(rows: readonly T[]): T | null {
  if (rows.length === 0) return null;

  const live = rows.filter((row) => row.status === "active");
  const pool = live.length > 0 ? live : rows;

  return [...pool].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}
