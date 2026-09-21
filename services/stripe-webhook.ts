import "server-only";

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { invoiceSubscriptionId } from "@/services/billing";
import { recordPaidInvoice, syncSubscription, UnknownMemberError } from "@/services/billing-sync";
import { completeDonation } from "@/services/donation";

async function syncById(subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return;
  await syncSubscription(await stripe().subscriptions.retrieve(subscriptionId));
}

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient()
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`Event lookup failed: ${error.message}`);
  return data !== null;
}

async function markProcessed(event: Stripe.Event): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`Could not record event: ${error.message}`);
}

/**
 * Events can arrive in any order — invoice.paid regularly beats
 * customer.subscription.created — so invoice handlers re-read the subscription
 * from Stripe first instead of assuming it has already been stored.
 */
async function apply(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription") {
        await syncById(typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null);
      } else if (session.mode === "payment") {
        await completeDonation(session);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      return;
    case "invoice.paid":
      await syncById(invoiceSubscriptionId(event.data.object));
      await recordPaidInvoice(event.data.object);
      return;
    case "invoice.payment_failed":
      // The subscription moves to past_due; re-reading it is what revokes access.
      await syncById(invoiceSubscriptionId(event.data.object));
      return;
    default:
      return;
  }
}

/**
 * Handlers are idempotent; the event log just avoids redundant Stripe calls.
 * Anything thrown here becomes a 500 and Stripe retries it — right for a
 * database blip, wrong for an event that can never apply, so those are
 * acknowledged and logged instead.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (await alreadyProcessed(event.id)) return;
  try {
    await apply(event);
  } catch (error) {
    if (!(error instanceof UnknownMemberError)) throw error;
    console.warn(`Stripe event ${event.id} (${event.type}) skipped: ${error.message}`);
  }
  await markProcessed(event);
}
