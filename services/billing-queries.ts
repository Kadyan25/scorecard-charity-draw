import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentRow, PlanRow, SubscriptionRow } from "@/lib/supabase/types";

export interface PaymentWithCharity extends PaymentRow {
  charityName: string | null;
}

export interface BillingOverview {
  subscription: SubscriptionRow | null;
  plan: PlanRow | null;
  payments: PaymentWithCharity[];
  hasBillingAccount: boolean;
}

// Reads run under the member's own session, so RLS scopes every query to them.
export async function loadBillingOverview(userId: string): Promise<BillingOverview> {
  const supabase = await createSupabaseServerClient();
  const [subs, payments, profile] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    supabase.from("payments").select("*").eq("user_id", userId).order("paid_at", { ascending: false }),
    supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single(),
  ]);
  for (const result of [subs, payments, profile]) {
    if (result.error) throw new Error(`Could not load billing: ${result.error.message}`);
  }

  const subscription = subs.data?.[0] ?? null;
  const plan = subscription?.plan_id
    ? (await supabase.from("plans").select("*").eq("id", subscription.plan_id).maybeSingle()).data
    : null;

  const charityIds = [...new Set((payments.data ?? []).map((p) => p.charity_id_snapshot).filter((id): id is string => id !== null))];
  const { data: charities, error } = charityIds.length
    ? await supabase.from("charities").select("id, name").in("id", charityIds)
    : { data: [], error: null };
  if (error) throw new Error(`Could not load charities: ${error.message}`);
  const names = new Map((charities ?? []).map((c) => [c.id, c.name]));

  return {
    subscription,
    plan: plan ?? null,
    payments: (payments.data ?? []).map((p) => ({ ...p, charityName: p.charity_id_snapshot ? names.get(p.charity_id_snapshot) ?? null : null })),
    hasBillingAccount: Boolean(profile.data?.stripe_customer_id),
  };
}
