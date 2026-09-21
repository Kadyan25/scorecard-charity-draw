import "server-only";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/supabase/paginate";
import { upcomingDraw, type UpcomingDraw } from "@/services/draw-inputs";
import { allocateProRata } from "@/services/report-rules";
import { pickGoverningSubscription, resolveAccess } from "@/services/subscription";

/**
 * Admin reporting (PRD 11). Totals come from the admin_report() database
 * function; the JSON it returns is parsed rather than trusted, so a schema
 * change surfaces here as a clear error instead of a NaN on the page.
 */

const count = z.coerce.number().int();
const cents = z.coerce.number().int();

const reportSchema = z.object({
  members: count,
  admins: count,
  payments: z.object({ count, gross: cents, charity: cents, prize_pool: cents, platform: cents }),
  donations: z.object({ count, total: cents }),
  draws: z.object({ published: count, pool_total: cents, charity_bonus: cents, entries: count, jackpots_unclaimed: count }),
  winners: z.object({
    count, prize_total: cents, paid_total: cents, tier5: count, tier4: count, tier3: count,
    awaiting_proof: count, awaiting_review: count, awaiting_payout: count,
  }),
  charities: z.array(z.object({
    id: z.string(), name: z.string(), is_active: z.boolean(), supporters: count,
    from_subscriptions: cents, from_donations: cents,
  })),
  recent_draws: z.array(z.object({
    id: z.string(), period_month: z.string(), mode: z.string(), entries: count, pool_total_cents: cents,
    rollover_out_cents: cents, charity_bonus_cents: cents, tier5: count, tier4: count, tier3: count,
  })),
});

export type RawReport = z.infer<typeof reportSchema>;

export interface CharityReportRow {
  id: string;
  name: string;
  isActive: boolean;
  supporters: number;
  fromSubscriptions: number;
  fromDonations: number;
  /** Share of unclaimed 4- and 3-match money, in proportion to supporters. */
  fromUnclaimedPrizes: number;
  total: number;
}

export interface SubscriptionBreakdown {
  monthly: number;
  yearly: number;
  complimentary: number;
  pastDue: number;
  lapsed: number;
}

export interface Report extends Omit<RawReport, "charities"> {
  charities: CharityReportRow[];
  subscriptions: SubscriptionBreakdown;
  upcoming: UpcomingDraw;
}

async function subscriptionBreakdown(): Promise<SubscriptionBreakdown> {
  const admin = createSupabaseAdminClient();
  const [subscriptions, plans] = await Promise.all([
    selectAll((from, to) => admin.from("subscriptions").select("*").order("id").range(from, to), "subscriptions"),
    selectAll((from, to) => admin.from("plans").select("id, interval").order("id").range(from, to), "plans"),
  ]);
  const interval = new Map(plans.map((plan) => [plan.id, plan.interval]));
  const byUser = new Map<string, typeof subscriptions>();
  for (const row of subscriptions) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);

  const result: SubscriptionBreakdown = { monthly: 0, yearly: 0, complimentary: 0, pastDue: 0, lapsed: 0 };
  for (const rows of byUser.values()) {
    const governing = pickGoverningSubscription(rows.map((row) => ({ ...row, currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: row.cancel_at_period_end, createdAt: row.created_at })));
    const access = resolveAccess(governing);
    if (access.state === "past_due") result.pastDue += 1;
    else if (!access.hasAccess) result.lapsed += 1;
    else if (!governing?.plan_id) result.complimentary += 1;
    else if (interval.get(governing.plan_id) === "year") result.yearly += 1;
    else result.monthly += 1;
  }
  return result;
}

export async function loadReport(): Promise<Report> {
  const [{ data, error }, subscriptions, upcoming] = await Promise.all([
    createSupabaseAdminClient().rpc("admin_report"),
    subscriptionBreakdown(),
    upcomingDraw(),
  ]);
  if (error) throw new Error(`Could not load report: ${error.message}`);
  const raw = reportSchema.parse(data);

  const bonus = allocateProRata(raw.draws.charity_bonus, raw.charities.map((charity) => [charity.id, charity.supporters]));
  const charities = raw.charities.map((charity) => {
    const fromUnclaimedPrizes = bonus.get(charity.id) ?? 0;
    return {
      id: charity.id,
      name: charity.name,
      isActive: charity.is_active,
      supporters: charity.supporters,
      fromSubscriptions: charity.from_subscriptions,
      fromDonations: charity.from_donations,
      fromUnclaimedPrizes,
      total: charity.from_subscriptions + charity.from_donations + fromUnclaimedPrizes,
    };
  });

  return { ...raw, charities: charities.sort((a, b) => b.total - a.total), subscriptions, upcoming };
}
