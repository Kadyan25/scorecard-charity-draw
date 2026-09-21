import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/supabase/paginate";
import type { EligibleTicket } from "@/services/draw";
import {
  accruePoolCents,
  estimateJackpotCents,
  nextDrawPeriod,
  selectEligibleTickets,
  type ContributingSubscriber,
  type MemberSnapshot,
} from "@/services/draw-engine";
import type { TierSplitPercent } from "@/services/prize";
import { loadSettings } from "@/services/settings";
import { pickGoverningSubscription, resolveAccess } from "@/services/subscription";

/**
 * Gathers everything the draw needs from the database, as of `now`.
 * Uses the service role: a draw spans every member, which no single member's
 * session could (or should) be allowed to read.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export interface DrawInputs {
  tickets: EligibleTicket[];
  activeSubscriberCount: number;
  contributionCents: number;
  rolloverInCents: number;
  latestPublishedPeriod: string | null;
  tierSplit: TierSplitPercent;
}

async function activeSubscribers(admin: Admin, now: Date) {
  const [subscriptions, plans] = await Promise.all([
    selectAll((from, to) => admin.from("subscriptions").select("user_id, plan_id, status, current_period_end, cancel_at_period_end, created_at").order("id").range(from, to), "subscriptions"),
    selectAll((from, to) => admin.from("plans").select("id, amount_cents, interval").order("id").range(from, to), "plans"),
  ]);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const byUser = new Map<string, typeof subscriptions>();
  for (const row of subscriptions) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);

  const active = new Map<string, ContributingSubscriber>();
  for (const [userId, rows] of byUser) {
    const governing = pickGoverningSubscription(
      rows.map((row) => ({ ...row, currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: row.cancel_at_period_end, createdAt: row.created_at })),
    );
    const plan = governing?.plan_id ? planById.get(governing.plan_id) : undefined;
    if (governing && plan && resolveAccess(governing, now).hasAccess) {
      active.set(userId, { amountCents: plan.amount_cents, interval: plan.interval });
    }
  }
  return active;
}

async function scoresByUser(admin: Admin): Promise<Map<string, number[]>> {
  const scores = await selectAll(
    (from, to) => admin.from("scores").select("user_id, value, played_on").order("user_id").order("played_on", { ascending: false }).range(from, to),
    "scores",
  );
  const byUser = new Map<string, number[]>();
  for (const score of scores) byUser.set(score.user_id, [...(byUser.get(score.user_id) ?? []), score.value]);
  return byUser;
}

async function latestPublishedBefore(admin: Admin, period: string | null) {
  let query = admin.from("draws").select("period_month, rollover_out_cents").eq("status", "published");
  if (period) query = query.lt("period_month", period);
  const { data, error } = await query.order("period_month", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not load previous draw: ${error.message}`);
  return data;
}

export async function gatherDrawInputs(period: string, now: Date = new Date()): Promise<DrawInputs> {
  const admin = createSupabaseAdminClient();
  const [settings, active, scores, previous, latest] = await Promise.all([
    loadSettings(admin),
    activeSubscribers(admin, now),
    scoresByUser(admin),
    latestPublishedBefore(admin, period),
    latestPublishedBefore(admin, null),
  ]);

  const members: MemberSnapshot[] = [...scores.entries()].map(([userId, values]) => ({
    userId,
    hasAccess: active.has(userId),
    scores: values,
  }));

  return {
    tickets: selectEligibleTickets(members),
    activeSubscriberCount: active.size,
    contributionCents: accruePoolCents([...active.values()], settings.prizePoolPercent),
    rolloverInCents: previous?.rollover_out_cents ?? 0,
    latestPublishedPeriod: latest?.period_month ?? null,
    tierSplit: settings.tierSplit,
  };
}

export interface UpcomingDraw {
  period: string;
  activeSubscriberCount: number;
  rolloverInCents: number;
  estimatedPoolCents: number;
  estimatedJackpotCents: number;
}

/**
 * The next draw as members and visitors see it. Deliberately skips the scores
 * scan that a real draw needs: the pool depends only on who is subscribed.
 */
export async function upcomingDraw(now: Date = new Date()): Promise<UpcomingDraw> {
  const admin = createSupabaseAdminClient();
  const [settings, active, latest] = await Promise.all([
    loadSettings(admin),
    activeSubscribers(admin, now),
    latestPublishedBefore(admin, null),
  ]);
  const contribution = accruePoolCents([...active.values()], settings.prizePoolPercent);
  const rolloverInCents = latest?.rollover_out_cents ?? 0;

  return {
    period: nextDrawPeriod(now, latest?.period_month ?? null),
    activeSubscriberCount: active.size,
    rolloverInCents,
    estimatedPoolCents: contribution + rolloverInCents,
    estimatedJackpotCents: estimateJackpotCents(contribution, rolloverInCents, settings.tierSplit[5]),
  };
}
