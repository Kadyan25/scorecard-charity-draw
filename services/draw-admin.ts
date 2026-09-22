import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertInChunks } from "@/lib/supabase/paginate";
import { computeDraw, periodIsAfterLatestPublished, type DrawMode } from "@/services/draw-engine";
import { gatherDrawInputs } from "@/services/draw-inputs";

/**
 * Admin draw operations: simulate before publishing, and admin
 * controls publishing"). Callers must already have verified the admin role;
 * these run with the service role because a draw spans every member.
 */

async function assertPeriodOpen(period: string, latestPublished: string | null): Promise<void> {
  if (!periodIsAfterLatestPublished(period, latestPublished)) {
    throw new HttpError(
      409,
      latestPublished === period
        ? "This month's draw has already been published."
        : `Draws run in order: the latest published draw is ${latestPublished}, so only later months can be drawn.`,
    );
  }
}

async function discardUnpublished(period: string): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("draws")
    .delete()
    .eq("period_month", period)
    .neq("status", "published");
  if (error) throw new Error(`Could not clear old simulations: ${error.message}`);
}

/**
 * Runs the full draw and stores it as a simulation the admin can review.
 * Nothing is visible to members until it is published. Re-running replaces the
 * previous simulation for the month, with fresh numbers.
 *
 * The row is written as `draft` and only promoted to `simulated` once every
 * entry is saved, so a half-written simulation can never be published.
 */
export async function simulateDraw(period: string, mode: DrawMode, actorId: string): Promise<string> {
  const inputs = await gatherDrawInputs(period);
  await assertPeriodOpen(period, inputs.latestPublishedPeriod);
  const outcome = computeDraw({ mode, tickets: inputs.tickets, contributionCents: inputs.contributionCents, rolloverInCents: inputs.rolloverInCents, tierSplit: inputs.tierSplit });

  await discardUnpublished(period);
  const admin = createSupabaseAdminClient();
  const { data: draw, error } = await admin
    .from("draws")
    .insert({
      period_month: period,
      mode,
      status: "draft",
      numbers: outcome.numbers,
      pool_total_cents: outcome.poolTotalCents,
      rollover_in_cents: inputs.rolloverInCents,
      rollover_out_cents: outcome.distribution.rolloverOutCents,
      charity_bonus_cents: outcome.distribution.charityBonusCents,
      tier5_pool_cents: outcome.distribution.tierPools[5],
      tier4_pool_cents: outcome.distribution.tierPools[4],
      tier3_pool_cents: outcome.distribution.tierPools[3],
      eligible_entry_count: outcome.entries.length,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !draw) throw new Error(`Could not save simulation: ${error?.message}`);

  await insertInChunks(
    outcome.entries.map((entry) => ({
      draw_id: draw.id,
      user_id: entry.userId,
      numbers: entry.numbers,
      matched_count: entry.matchedCount,
      tier: entry.tier,
      prize_cents: entry.prizeCents,
    })),
    (chunk) => admin.from("draw_entries").insert(chunk),
    "draw entries",
  );

  const { error: promoteError } = await admin.from("draws").update({ status: "simulated" }).eq("id", draw.id);
  if (promoteError) throw new Error(`Could not finalise simulation: ${promoteError.message}`);
  return draw.id;
}

function mapPublishError(error: PostgrestError): never {
  if (error.code === "P0002") throw new HttpError(404, "That draw no longer exists. Run a new simulation.");
  if (error.code === "P0001") throw new HttpError(409, "Only a simulated draw can be published. It may already be live.");
  if (error.code === "23505") throw new HttpError(409, "This month's draw has already been published.");
  throw new Error(`Publishing failed: ${error.message}`);
}

/** Publishes exactly the simulation the admin reviewed, atomically. */
export async function publishDraw(drawId: string, actorId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("publish_draw", {
    p_draw_id: drawId,
    p_actor: actorId,
  });
  if (error) mapPublishError(error);
}
