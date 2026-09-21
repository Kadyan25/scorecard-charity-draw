import "server-only";

import { HttpError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadSettings, validateSettingsUpdate, type SettingsUpdate } from "@/services/settings";

/**
 * Commercial settings (prize pool share, charity bounds, tier split). Changes
 * apply to future payments and draws only: published draws and recorded
 * payments keep the values they were created with.
 */
export async function updateSettings(adminId: string, update: SettingsUpdate): Promise<void> {
  const problem = validateSettingsUpdate(update);
  if (problem) throw new HttpError(400, problem);

  const admin = createSupabaseAdminClient();

  // Existing members keep their percentage when bounds change, so a larger
  // prize share must still leave room for the highest one — otherwise their
  // next invoice could not be split and its webhook would fail every retry.
  const { data: highest, error: highestError } = await admin
    .from("profiles")
    .select("charity_percent")
    .order("charity_percent", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (highestError) throw new Error(`Could not check member contributions: ${highestError.message}`);
  if (highest && highest.charity_percent + update.prizePoolPercent > 100) {
    throw new HttpError(
      409,
      `A member currently gives ${highest.charity_percent}% to charity, so the prize pool share can be at most ${100 - highest.charity_percent}%.`,
    );
  }

  const before = await loadSettings(admin);
  const now = new Date().toISOString();
  const { error } = await admin.from("settings").upsert(
    [
      { key: "prize_pool_percent", value: update.prizePoolPercent, updated_at: now },
      { key: "charity_percent_min", value: update.charityPercentMin, updated_at: now },
      { key: "charity_percent_max", value: update.charityPercentMax, updated_at: now },
      { key: "tier_split", value: { "5": update.tierSplit[5], "4": update.tierSplit[4], "3": update.tierSplit[3] }, updated_at: now },
    ],
    { onConflict: "key" },
  );
  if (error) throw new Error(`Could not save settings: ${error.message}`);

  await recordAudit({
    actorId: adminId,
    action: "settings.updated",
    entity: "settings",
    entityId: null,
    meta: {
      before: { prizePoolPercent: before.prizePoolPercent, charityPercentMin: before.charityPercentMin, charityPercentMax: before.charityPercentMax, tierSplit: { ...before.tierSplit } },
      after: { ...update, tierSplit: { ...update.tierSplit } },
    },
  });
}
