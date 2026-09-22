/**
 * Prize pool and contribution arithmetic.
 *
 * Pure functions over integer cents. Every split asserts that it reconciles
 * exactly against its source amount — money is never allowed to evaporate into
 * a rounding gap.
 */

import { assertCents, percentOf, splitEqually, type Cents } from "@/lib/money";
import type { Tier } from "@/services/draw";

export interface ContributionSplit {
  charityCents: Cents;
  prizePoolCents: Cents;
  platformCents: Cents;
}

/**
 * Split a paid subscription invoice three ways.
 *
 * The platform takes the remainder rather than a computed percentage, which
 * guarantees the parts sum to exactly the invoice amount regardless of rounding.
 */
export function splitContribution(
  amountCents: Cents,
  charityPercent: number,
  prizePoolPercent: number,
): ContributionSplit {
  assertCents(amountCents, "invoice amount");

  if (charityPercent + prizePoolPercent > 100) {
    throw new Error(
      `charity (${charityPercent}%) and prize pool (${prizePoolPercent}%) cannot exceed 100%`,
    );
  }

  const charityCents = percentOf(amountCents, charityPercent);
  const prizePoolCents = percentOf(amountCents, prizePoolPercent);
  const platformCents = amountCents - charityCents - prizePoolCents;

  return { charityCents, prizePoolCents, platformCents };
}

export interface TierSplitPercent {
  5: number;
  4: number;
  3: number;
}

export const DEFAULT_TIER_SPLIT: TierSplitPercent = { 5: 40, 4: 35, 3: 25 };

export interface TierPools {
  5: Cents;
  4: Cents;
  3: Cents;
}

/**
 * Carve the month's pool into the three match tiers.
 *
 * Tier 3 takes the rounding remainder so the three pools reconcile exactly
 * against the total.
 */
export function computeTierPools(
  poolTotalCents: Cents,
  split: TierSplitPercent = DEFAULT_TIER_SPLIT,
): TierPools {
  assertCents(poolTotalCents, "prize pool total");

  const tier5 = percentOf(poolTotalCents, split[5]);
  const tier4 = percentOf(poolTotalCents, split[4]);
  const tier3 = poolTotalCents - tier5 - tier4;

  return { 5: tier5, 4: tier4, 3: tier3 };
}

export interface WinnerCounts {
  5: number;
  4: number;
  3: number;
}

export interface PrizeDistribution {
  tierPools: TierPools;
  /** What a single winner in each tier receives. Zero when the tier had none. */
  perWinnerCents: TierPools;
  /** Total actually awarded to winners across all tiers. */
  paidOutCents: Cents;
  /** Unclaimed jackpot plus undividable remainders — carries to next month. */
  rolloverOutCents: Cents;
  /** Unclaimed 4- and 3-match pools, routed to charity rather than rolled over. */
  charityBonusCents: Cents;
}

const TIERS: Tier[] = [5, 4, 3];

/**
 * Distribute a month's pool across its winners.
 *
 * Three rules are specified, plus one the requirements leave open:
 *   - Winners inside a tier split that tier equally (section 07).
 *   - An unclaimed 5-match jackpot rolls forward (section 07).
 *   - 4- and 3-match tiers explicitly do NOT roll over (section 07) — but the
 *     spec never says where unclaimed money goes, so it is routed to the charity
 *     pool, which is the only destination consistent with the product's stated
 *     purpose. Reported separately so the decision stays visible.
 *   - Cents that will not divide evenly carry into next month's pool.
 */
export function distributePrizes(
  poolTotalCents: Cents,
  winnerCounts: WinnerCounts,
  split: TierSplitPercent = DEFAULT_TIER_SPLIT,
): PrizeDistribution {
  const tierPools = computeTierPools(poolTotalCents, split);

  const perWinnerCents: TierPools = { 5: 0, 4: 0, 3: 0 };
  let paidOutCents = 0;
  let rolloverOutCents = 0;
  let charityBonusCents = 0;

  for (const tier of TIERS) {
    const pool = tierPools[tier];
    const count = winnerCounts[tier];

    if (count <= 0) {
      if (tier === 5) {
        rolloverOutCents += pool;
      } else {
        charityBonusCents += pool;
      }
      continue;
    }

    const { share, remainder } = splitEqually(pool, count);
    perWinnerCents[tier] = share;
    paidOutCents += share * count;
    rolloverOutCents += remainder;
  }

  const reconciled = paidOutCents + rolloverOutCents + charityBonusCents;
  if (reconciled !== poolTotalCents) {
    throw new Error(
      `Prize distribution does not reconcile: ${reconciled} != ${poolTotalCents}`,
    );
  }

  return {
    tierPools,
    perWinnerCents,
    paidOutCents,
    rolloverOutCents,
    charityBonusCents,
  };
}

/** Tally winners per tier from scored entries. */
export function countWinnersByTier(
  entries: readonly { tier: Tier | null }[],
): WinnerCounts {
  const counts: WinnerCounts = { 5: 0, 4: 0, 3: 0 };
  for (const entry of entries) {
    if (entry.tier !== null) counts[entry.tier] += 1;
  }
  return counts;
}
