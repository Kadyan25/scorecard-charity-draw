/**
 * Pure translation from Stripe's billing vocabulary into ours.
 *
 * Kept free of the Stripe SDK so the lifecycle mapping and the money split on
 * every paid invoice can be tested exhaustively without network access.
 */

import type { Cents } from "@/lib/money";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { splitContribution } from "@/services/prize";

/** Every status Stripe documents for a subscription object. */
export type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/**
 * PRD section 04 asks for renewal, cancellation and lapsed states. Stripe has
 * more states than that; each collapses onto the one that decides access.
 */
export function mapStripeStatus(status: StripeSubscriptionStatus | string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "paused":
      // Stripe has given up retrying or collection is suspended: the member
      // is no longer paying, which is what "lapsed" means here.
      return "lapsed";
    case "incomplete":
      return "incomplete";
    default:
      // Stripe's status type is open-ended. An unrecognised status must never
      // grant access, but it is not "never subscribed" either.
      return "lapsed";
  }
}

/** Stripe reports times as Unix seconds; the database stores ISO timestamps. */
export function fromUnixSeconds(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  return new Date(seconds * 1000).toISOString();
}

export interface PaymentSplitInput {
  amountPaidCents: Cents;
  charityId: string | null;
  charityPercent: number;
  prizePoolPercent: number;
}

export interface PaymentSplitRecord {
  charity_id_snapshot: string | null;
  charity_percent_snapshot: number;
  charity_amount_cents: Cents;
  prize_pool_amount_cents: Cents;
  platform_amount_cents: Cents;
}

/**
 * The snapshot written alongside every paid invoice.
 *
 * A member with no charity selected contributes nothing to charity — the share
 * is not silently redirected — and the platform absorbs it instead. Signup
 * requires a charity, so this only arises if an admin deletes one.
 */
export function buildPaymentSplit(input: PaymentSplitInput): PaymentSplitRecord {
  const effectivePercent = input.charityId ? input.charityPercent : 0;
  const split = splitContribution(
    input.amountPaidCents,
    effectivePercent,
    input.prizePoolPercent,
  );

  return {
    charity_id_snapshot: input.charityId,
    charity_percent_snapshot: effectivePercent,
    charity_amount_cents: split.charityCents,
    prize_pool_amount_cents: split.prizePoolCents,
    platform_amount_cents: split.platformCents,
  };
}

/*
 * Minimal structural views of Stripe objects. Declared here rather than taken
 * from the SDK so the extraction rules can be unit-tested with plain objects.
 * Shapes follow API version 2026-08-26.dahlia, where billing periods live on
 * subscription items and an invoice reaches its subscription via `parent`.
 */

type Expandable = string | { id: string };

export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: Expandable;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata: Record<string, string>;
  items: {
    data: {
      current_period_start: number;
      current_period_end: number;
      price: { id: string };
    }[];
  };
}

export interface StripeInvoiceLike {
  id?: string;
  amount_paid: number;
  currency: string;
  customer: Expandable | null;
  status_transitions: { paid_at: number | null };
  parent: {
    subscription_details: { subscription: Expandable } | null;
  } | null;
}

export function expandableId(value: Expandable | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** A subscription's billing window, spanning all of its items. */
export function subscriptionPeriod(subscription: StripeSubscriptionLike): {
  start: string | null;
  end: string | null;
} {
  const items = subscription.items.data;
  if (items.length === 0) return { start: null, end: null };

  const start = Math.min(...items.map((item) => item.current_period_start));
  const end = Math.max(...items.map((item) => item.current_period_end));
  return { start: fromUnixSeconds(start), end: fromUnixSeconds(end) };
}

export function subscriptionPriceId(subscription: StripeSubscriptionLike): string | null {
  return subscription.items.data[0]?.price.id ?? null;
}

export function invoiceSubscriptionId(invoice: StripeInvoiceLike): string | null {
  return expandableId(invoice.parent?.subscription_details?.subscription);
}

export interface SubscriptionRecord {
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

/** The columns a Stripe subscription event writes to our subscriptions table. */
export function toSubscriptionRecord(subscription: StripeSubscriptionLike): SubscriptionRecord {
  const period = subscriptionPeriod(subscription);
  return {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: expandableId(subscription.customer),
    status: mapStripeStatus(subscription.status),
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: fromUnixSeconds(subscription.canceled_at),
  };
}
