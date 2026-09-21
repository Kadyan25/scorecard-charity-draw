/**
 * Typed access to the settings table. Commercial values live in the database
 * so they can change without a deploy; this module gives them types and safe
 * fallbacks so a missing row can never produce NaN money.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { DEFAULT_TIER_SPLIT, type TierSplitPercent } from "@/services/prize";

export interface PlatformSettings {
  prizePoolPercent: number;
  charityPercentMin: number;
  charityPercentMax: number;
  tierSplit: TierSplitPercent;
  currency: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  prizePoolPercent: 30,
  charityPercentMin: 10,
  charityPercentMax: 50,
  tierSplit: DEFAULT_TIER_SPLIT,
  currency: "GBP",
};

function asInt(value: Json | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function asTierSplit(value: Json | undefined): TierSplitPercent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TIER_SPLIT;
  }
  const split = {
    5: asInt(value["5"], DEFAULT_TIER_SPLIT[5]),
    4: asInt(value["4"], DEFAULT_TIER_SPLIT[4]),
    3: asInt(value["3"], DEFAULT_TIER_SPLIT[3]),
  };
  // A split that does not total 100 would silently create or destroy money.
  return split[5] + split[4] + split[3] === 100 ? split : DEFAULT_TIER_SPLIT;
}

export function parseSettings(rows: readonly { key: string; value: Json }[]): PlatformSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const currency = byKey.get("default_currency");

  return {
    prizePoolPercent: asInt(byKey.get("prize_pool_percent"), DEFAULT_SETTINGS.prizePoolPercent),
    charityPercentMin: asInt(byKey.get("charity_percent_min"), DEFAULT_SETTINGS.charityPercentMin),
    charityPercentMax: asInt(byKey.get("charity_percent_max"), DEFAULT_SETTINGS.charityPercentMax),
    tierSplit: asTierSplit(byKey.get("tier_split")),
    currency: typeof currency === "string" ? currency : DEFAULT_SETTINGS.currency,
  };
}

export async function loadSettings(
  supabase: SupabaseClient<Database>,
): Promise<PlatformSettings> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return parseSettings(data ?? []);
}

/** Enforces PRD section 08.1's minimum and the ceiling added in architecture 2.7. */
export function validateCharityPercent(
  percent: number,
  settings: Pick<PlatformSettings, "charityPercentMin" | "charityPercentMax" | "prizePoolPercent">,
): string | null {
  if (!Number.isInteger(percent)) return "Contribution must be a whole percentage.";
  if (percent < settings.charityPercentMin) {
    return `The minimum charity contribution is ${settings.charityPercentMin}%.`;
  }
  if (percent > settings.charityPercentMax) {
    return `The maximum charity contribution is ${settings.charityPercentMax}%.`;
  }
  if (percent + settings.prizePoolPercent > 100) {
    return "That contribution would leave nothing for the prize pool.";
  }
  return null;
}

export interface SettingsUpdate {
  prizePoolPercent: number;
  charityPercentMin: number;
  charityPercentMax: number;
  tierSplit: TierSplitPercent;
}

/**
 * Checks an admin's proposed settings as a whole. Each rule protects money:
 * a tier split that is not 100% creates or destroys prize money, and a charity
 * ceiling plus prize share above 100% makes invoices impossible to split.
 */
export function validateSettingsUpdate(update: SettingsUpdate): string | null {
  const whole = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100;
  const values = [update.prizePoolPercent, update.charityPercentMin, update.charityPercentMax, update.tierSplit[5], update.tierSplit[4], update.tierSplit[3]];
  if (!values.every(whole)) return "Every percentage must be a whole number from 0 to 100.";
  if (update.charityPercentMin < 10) return "The PRD sets a 10% minimum charity contribution.";
  if (update.charityPercentMin > update.charityPercentMax) return "The charity minimum cannot be above the maximum.";
  if (update.charityPercentMax + update.prizePoolPercent > 100) {
    return "Charity maximum plus prize pool share cannot exceed 100%.";
  }
  if (update.tierSplit[5] + update.tierSplit[4] + update.tierSplit[3] !== 100) {
    return "The three prize tiers must add up to exactly 100%.";
  }
  return null;
}
