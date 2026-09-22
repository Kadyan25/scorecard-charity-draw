import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ScoreInput } from "@/lib/validation";
import { getMemberDetail } from "@/services/admin-members";
import { syncSubscription } from "@/services/billing-sync";
import { mapScoreDbError } from "@/services/score-rules";
import { loadSettings, validateCharityPercent } from "@/services/settings";
import type { AdminSubscriptionAction } from "@/services/subscription";

/**
 * Admin writes on a member's behalf: edit profiles, edit golf scores,
 * manage subscriptions). Every change is audited with the acting admin. The
 * same database rules apply as for members: the rolling-five and backdate
 * triggers, one score per date, and charity bounds all still hold.
 */

const COMP_DAYS = 30;

function scoreError(error: PostgrestError): never {
  const mapped = mapScoreDbError(error);
  if (mapped) throw new HttpError(mapped.status, mapped.message);
  throw new Error(`Score change failed: ${error.message}`);
}

export async function updateMemberProfile(
  adminId: string,
  userId: string,
  input: { fullName: string; charityId: string; charityPercent: number },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const percentError = validateCharityPercent(input.charityPercent, await loadSettings(admin));
  if (percentError) throw new HttpError(400, percentError);

  const { data, error } = await admin
    .from("profiles")
    .update({ full_name: input.fullName, charity_id: input.charityId, charity_percent: input.charityPercent })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Could not update member: ${error.message}`);
  if (!data?.length) throw new HttpError(404, "That member could not be found.");
  await recordAudit({ actorId: adminId, action: "member.profile_updated", entity: "profile", entityId: userId, meta: { ...input } });
}

export async function adminAddScore(adminId: string, userId: string, input: ScoreInput): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("scores")
    .insert({ user_id: userId, value: input.value, played_on: input.playedOn });
  if (error) scoreError(error);
  await recordAudit({ actorId: adminId, action: "score.added_by_admin", entity: "profile", entityId: userId, meta: { ...input } });
}

export async function adminUpdateScore(adminId: string, scoreId: string, patch: Partial<ScoreInput>): Promise<void> {
  const { data, error } = await createSupabaseAdminClient()
    .from("scores")
    .update({
      ...(patch.value !== undefined && { value: patch.value }),
      ...(patch.playedOn !== undefined && { played_on: patch.playedOn }),
    })
    .eq("id", scoreId)
    .select("user_id");
  if (error) scoreError(error);
  if (!data?.length) throw new HttpError(404, "That score could not be found.");
  await recordAudit({ actorId: adminId, action: "score.edited_by_admin", entity: "profile", entityId: data[0].user_id, meta: { scoreId, ...patch } });
}

export async function adminDeleteScore(adminId: string, scoreId: string): Promise<void> {
  const { data, error } = await createSupabaseAdminClient().from("scores").delete().eq("id", scoreId).select("user_id, value, played_on");
  if (error) scoreError(error);
  if (!data?.length) throw new HttpError(404, "That score could not be found.");
  await recordAudit({ actorId: adminId, action: "score.deleted_by_admin", entity: "profile", entityId: data[0].user_id, meta: { ...data[0] } });
}

async function applyStripeAction(stripeSubscriptionId: string, action: AdminSubscriptionAction): Promise<void> {
  const updated =
    action === "cancel_now"
      ? await stripe().subscriptions.cancel(stripeSubscriptionId)
      : await stripe().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: action === "cancel_at_period_end" });
  // Sync now so the admin sees the result immediately; the webhook that
  // follows is idempotent and will simply confirm it.
  await syncSubscription(updated);
}

async function applyCompAction(userId: string, subscriptionId: string | null, action: AdminSubscriptionAction): Promise<void> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const { error } =
    action === "grant_comp"
      ? await admin.from("subscriptions").insert({
          user_id: userId,
          plan_id: null,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: new Date(now.getTime() + COMP_DAYS * 86_400_000).toISOString(),
        })
      : await admin
          .from("subscriptions")
          .update({ status: "canceled", current_period_end: now.toISOString(), canceled_at: now.toISOString() })
          .eq("id", subscriptionId ?? "");
  if (error) throw new Error(`Could not update access: ${error.message}`);
}

/** Validates the action against the member's current state before acting. */
export async function manageSubscription(adminId: string, userId: string, action: AdminSubscriptionAction): Promise<void> {
  const member = await getMemberDetail(userId);
  if (!member) throw new HttpError(404, "That member could not be found.");
  if (!member.actions.includes(action)) {
    throw new HttpError(409, "That action does not apply to this member's current subscription.");
  }

  const stripeId = member.subscription?.stripe_subscription_id ?? null;
  if (stripeId && action !== "grant_comp") await applyStripeAction(stripeId, action);
  else await applyCompAction(userId, member.subscription?.id ?? null, action);
  await recordAudit({ actorId: adminId, action: `subscription.${action}`, entity: "profile", entityId: userId });
}
