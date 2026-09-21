import "server-only";

import { clientEnv } from "@/lib/env";
import { HttpError } from "@/lib/api";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanRow } from "@/lib/supabase/types";
import { loadAccess } from "@/lib/auth";

const PRODUCT_NAME = "Digital Heroes Membership";

/** The Stripe customer is created once per person and reused for every checkout. */
async function ensureCustomer(userId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("email, full_name, stripe_customer_id")
    .eq("id", userId)
    .single();
  if (error || !profile) throw new Error(`Profile not found for ${userId}`);
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe().customers.create({
    email: profile.email,
    name: profile.full_name ?? undefined,
    metadata: { user_id: userId },
  });
  const { error: saveError } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);
  if (saveError) throw new Error(`Could not save Stripe customer: ${saveError.message}`);
  return customer.id;
}

/**
 * Plans in our database are the source of truth for price. The matching Stripe
 * price is found (or created) by a lookup key that encodes the amount, so
 * changing a plan's price in the database yields a new Stripe price rather than
 * silently charging the old one.
 */
async function ensurePrice(plan: PlanRow): Promise<string> {
  if (plan.stripe_price_id) return plan.stripe_price_id;

  const lookupKey = `dh_${plan.code}_${plan.amount_cents}_${plan.currency.toLowerCase()}`;
  const existing = await stripe().prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price =
    existing.data[0] ??
    (await stripe().prices.create({
      lookup_key: lookupKey,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.amount_cents,
      recurring: { interval: plan.interval },
      product_data: { name: `${PRODUCT_NAME} (${plan.name})` },
    }));

  const { error } = await createSupabaseAdminClient()
    .from("plans")
    .update({ stripe_price_id: price.id })
    .eq("id", plan.id);
  if (error) throw new Error(`Could not save Stripe price: ${error.message}`);
  return price.id;
}

async function loadPlan(planCode: string): Promise<PlanRow> {
  const { data, error } = await createSupabaseAdminClient()
    .from("plans")
    .select("*")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load plan: ${error.message}`);
  if (!data) throw new HttpError(404, "That plan is not available.");
  return data;
}

export async function createCheckoutSession(userId: string, planCode: string): Promise<string> {
  const access = await loadAccess(userId);
  if (access.hasAccess) {
    throw new HttpError(409, "You already have an active subscription.");
  }

  const plan = await loadPlan(planCode);
  const [customer, price] = await Promise.all([ensureCustomer(userId), ensurePrice(plan)]);
  const site = clientEnv.NEXT_PUBLIC_SITE_URL;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: userId, plan_code: plan.code } },
    success_url: `${site}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/subscribe?cancelled=1`,
  });
  if (!session.url) throw new Error("Stripe returned a checkout session without a URL");
  return session.url;
}

const PORTAL_TAG = "digital-heroes";

/**
 * The Billing Portal needs a saved configuration, and a brand-new Stripe
 * account has none — so "Manage billing" would fail on first deploy. Reuse the
 * account default if there is one, otherwise find or create ours (tagged so
 * repeated calls do not pile up duplicates).
 */
async function portalConfigurationId(): Promise<string | undefined> {
  const configs = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const ours = configs.data.find((config) => config.metadata?.app === PORTAL_TAG);
  if (ours) return ours.id;
  if (configs.data.some((config) => config.is_default)) return undefined;

  const created = await stripe().billingPortal.configurations.create({
    metadata: { app: PORTAL_TAG },
    business_profile: { headline: "Manage your Digital Heroes membership" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "name"] },
      // Cancelling keeps access until the paid period ends (PRD 04 lifecycle).
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  });
  return created.id;
}

export async function createPortalSession(userId: string): Promise<string> {
  const { data, error } = await createSupabaseAdminClient()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  if (!data?.stripe_customer_id) {
    throw new HttpError(404, "There is no billing account to manage yet.");
  }

  const portal = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    configuration: await portalConfigurationId(),
    return_url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
  });
  return portal.url;
}
