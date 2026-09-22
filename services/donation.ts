import "server-only";

import type Stripe from "stripe";
import { HttpError } from "@/lib/api";
import { clientEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * One-off donations, independent of any subscription.
 *
 * The donation row is written as `pending` before the donor leaves for Stripe
 * and only marked `succeeded` by the webhook, so an abandoned checkout never
 * inflates a charity's totals.
 */
export async function createDonationCheckout(
  userId: string | null,
  charityId: string,
  amountCents: number,
): Promise<string> {
  // Resolve Stripe first: if payments are unavailable, fail before writing a
  // pending donation that could never complete.
  const payments = stripe();
  const admin = createSupabaseAdminClient();
  const { data: charity, error } = await admin
    .from("charities")
    .select("id, name, slug")
    .eq("id", charityId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load charity: ${error.message}`);
  if (!charity) throw new HttpError(400, "That charity is not currently accepting donations.");

  const { data: donation, error: insertError } = await admin
    .from("donations")
    .insert({ user_id: userId, charity_id: charity.id, amount_cents: amountCents, currency: "GBP" })
    .select("id")
    .single();
  if (insertError || !donation) throw new Error(`Could not start donation: ${insertError?.message}`);

  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const session = await payments.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amountCents,
          product_data: { name: `Donation to ${charity.name}` },
        },
      },
    ],
    metadata: { donation_id: donation.id },
    success_url: `${site}/charities/${charity.slug}?donated=1`,
    cancel_url: `${site}/charities/${charity.slug}`,
  });

  const { error: linkError } = await admin
    .from("donations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", donation.id);
  // Without the link the webhook can still complete it via metadata, but a
  // failure here means the database is unhealthy — better to stop now.
  if (linkError) throw new Error(`Could not link donation to checkout: ${linkError.message}`);
  if (!session.url) throw new Error("Stripe returned a checkout session without a URL");
  return session.url;
}

/** Called from the webhook when a payment-mode checkout completes. */
export async function completeDonation(session: Stripe.Checkout.Session): Promise<void> {
  const donationId = session.metadata?.donation_id;
  if (!donationId) return;

  const paid = session.payment_status === "paid";
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  const { error } = await createSupabaseAdminClient()
    .from("donations")
    .update({ status: paid ? "succeeded" : "failed", stripe_payment_intent_id: paymentIntent })
    .eq("id", donationId)
    .eq("status", "pending");
  if (error) throw new Error(`Could not complete donation: ${error.message}`);
}
