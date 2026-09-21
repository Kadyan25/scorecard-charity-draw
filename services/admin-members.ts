import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentRow, PlanRow, ProfileRow, ScoreRow, SubscriptionRow } from "@/lib/supabase/types";
import { sanitizeSearchTerm } from "@/services/charity-rules";
import {
  adminSubscriptionActions,
  pickGoverningSubscription,
  resolveAccess,
  type Access,
  type AdminSubscriptionAction,
} from "@/services/subscription";

/**
 * Admin reads across members (PRD 11: "View and edit user profiles").
 * Service role, because admins see everyone; callers must have run requireAdmin.
 */

export const PAGE_SIZE = 25;

function governing(rows: SubscriptionRow[]): { row: SubscriptionRow | null; access: Access } {
  const picked = pickGoverningSubscription(
    rows.map((row) => ({ ...row, currentPeriodEnd: row.current_period_end, cancelAtPeriodEnd: row.cancel_at_period_end, createdAt: row.created_at })),
  );
  return { row: picked ?? null, access: resolveAccess(picked ?? null) };
}

export interface MemberListRow {
  profile: ProfileRow;
  access: Access;
  scoreCount: number;
  charityName: string | null;
}

export async function listMembers(query: { q?: string; page?: number }): Promise<{ rows: MemberListRow[]; total: number; page: number }> {
  const admin = createSupabaseAdminClient();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const q = sanitizeSearchTerm(query.q);

  let request = admin.from("profiles").select("*", { count: "exact" });
  if (q) request = request.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: profiles, count, error } = await request
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load members: ${error.message}`);
  const ids = (profiles ?? []).map((profile) => profile.id);
  if (ids.length === 0) return { rows: [], total: count ?? 0, page };

  const [subs, scores, charities] = await Promise.all([
    admin.from("subscriptions").select("*").in("user_id", ids),
    admin.from("scores").select("user_id").in("user_id", ids),
    admin.from("charities").select("id, name"),
  ]);
  for (const result of [subs, scores, charities]) if (result.error) throw new Error(`Could not load members: ${result.error.message}`);
  const names = new Map((charities.data ?? []).map((charity) => [charity.id, charity.name]));

  return {
    page,
    total: count ?? 0,
    rows: (profiles ?? []).map((profile) => ({
      profile,
      access: governing((subs.data ?? []).filter((row) => row.user_id === profile.id)).access,
      scoreCount: (scores.data ?? []).filter((row) => row.user_id === profile.id).length,
      charityName: profile.charity_id ? names.get(profile.charity_id) ?? null : null,
    })),
  };
}

export interface MemberDetail {
  profile: ProfileRow;
  scores: ScoreRow[];
  subscription: SubscriptionRow | null;
  plan: PlanRow | null;
  access: Access;
  actions: AdminSubscriptionAction[];
  payments: PaymentRow[];
}

export async function getMemberDetail(userId: string): Promise<MemberDetail | null> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not load member: ${error.message}`);
  if (!profile) return null;

  const [scores, subs, payments] = await Promise.all([
    admin.from("scores").select("*").eq("user_id", userId).order("played_on", { ascending: false }),
    admin.from("subscriptions").select("*").eq("user_id", userId),
    admin.from("payments").select("*").eq("user_id", userId).order("paid_at", { ascending: false }),
  ]);
  for (const result of [scores, subs, payments]) if (result.error) throw new Error(`Could not load member: ${result.error.message}`);

  const { row, access } = governing(subs.data ?? []);
  const plan = row?.plan_id ? (await admin.from("plans").select("*").eq("id", row.plan_id).maybeSingle()).data : null;
  return {
    profile,
    scores: scores.data ?? [],
    subscription: row,
    plan: plan ?? null,
    access,
    actions: adminSubscriptionActions(row ? { stripeSubscriptionId: row.stripe_subscription_id, cancelAtPeriodEnd: row.cancel_at_period_end } : null, access),
    payments: payments.data ?? [],
  };
}
