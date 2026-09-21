import "server-only";

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPaymentSplit,
  expandableId,
  fromUnixSeconds,
  invoiceSubscriptionId,
  subscriptionPriceId,
  toSubscriptionRecord,
} from "@/services/billing";
import { loadSettings } from "@/services/settings";

/**
 * Applies Stripe state to our database. Every function here is idempotent:
 * Stripe delivers webhooks at least once, and the checkout success page also
 * syncs directly, so the same object can legitimately arrive more than once.
 *
 * Runs with the service-role client because webhooks carry no user session.
 * Identity comes from Stripe ids we issued, never from anything client-side.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function userIdForCustomer(admin: Admin, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`Customer lookup failed: ${error.message}`);
  return data?.id ?? null;
}

async function planIdForPrice(admin: Admin, priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  const { data, error } = await admin
    .from("plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  if (error) throw new Error(`Plan lookup failed: ${error.message}`);
  return data?.id ?? null;
}

export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const admin = createSupabaseAdminClient();
  const record = toSubscriptionRecord(subscription);
  const userId =
    (await userIdForCustomer(admin, record.stripe_customer_id)) ??
    subscription.metadata.user_id ??
    null;
  if (!userId) {
    throw new Error(`No member found for Stripe subscription ${subscription.id}`);
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      ...record,
      user_id: userId,
      plan_id: await planIdForPrice(admin, subscriptionPriceId(subscription)),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`Could not save subscription: ${error.message}`);
}

async function subscriptionRowId(admin: Admin, stripeSubscriptionId: string | null) {
  if (!stripeSubscriptionId) return null;
  const { data, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(`Subscription lookup failed: ${error.message}`);
  return data?.id ?? null;
}

/**
 * Records a paid invoice with its charity / prize pool / platform split. The
 * member's charity choice is snapshotted now, so changing charity next month
 * never rewrites where this month's money went.
 */
export async function recordPaidInvoice(invoice: Stripe.Invoice): Promise<void> {
  const admin = createSupabaseAdminClient();
  const userId = await userIdForCustomer(admin, expandableId(invoice.customer));
  if (!userId) throw new Error(`No member found for Stripe invoice ${invoice.id}`);

  const { data: profile, error } = await admin
    .from("profiles")
    .select("charity_id, charity_percent")
    .eq("id", userId)
    .single();
  if (error || !profile) throw new Error(`Profile missing for ${userId}`);

  const settings = await loadSettings(admin);
  const split = buildPaymentSplit({
    amountPaidCents: invoice.amount_paid,
    charityId: profile.charity_id,
    charityPercent: profile.charity_percent,
    prizePoolPercent: settings.prizePoolPercent,
  });

  const { error: insertError } = await admin.from("payments").upsert(
    {
      ...split,
      user_id: userId,
      subscription_id: await subscriptionRowId(admin, invoiceSubscriptionId(invoice)),
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      status: "succeeded",
      paid_at: fromUnixSeconds(invoice.status_transitions.paid_at) ?? new Date().toISOString(),
    },
    // A redelivered invoice must not be recorded twice, and must not have its
    // original charity snapshot overwritten either.
    { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
  );
  if (insertError) throw new Error(`Could not record payment: ${insertError.message}`);
}

/**
 * Called from the checkout success page so a member sees their subscription
 * immediately, even before (or without) the webhook arriving. The session must
 * belong to the signed-in member — otherwise a shared success URL could be used
 * to attach someone else's payment.
 */
export async function confirmCheckoutSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "invoice"],
  });
  if (session.client_reference_id !== userId) return false;
  if (session.status !== "complete") return false;

  const subscription = session.subscription;
  if (subscription && typeof subscription !== "string") await syncSubscription(subscription);

  const invoice = session.invoice;
  if (invoice && typeof invoice !== "string" && invoice.status === "paid") {
    await recordPaidInvoice(invoice);
  }
  return true;
}
