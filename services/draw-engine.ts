/**
 * The monthly draw as one pure computation (PRD sections 06 and 07).
 *
 * Everything that decides who wins what lives here, free of I/O, so the whole
 * outcome can be reproduced from its inputs and tested with a seeded RNG. The
 * server layer only gathers inputs and persists the result.
 */

import {
  cryptoRng,
  drawRandomNumbers,
  drawWeightedNumbers,
  scoreEntries,
  TICKET_SIZE,
  type EligibleTicket,
  type Rng,
  type Tier,
} from "@/services/draw";
import {
  countWinnersByTier,
  DEFAULT_TIER_SPLIT,
  distributePrizes,
  type PrizeDistribution,
  type TierSplitPercent,
} from "@/services/prize";

export type DrawMode = "random" | "algorithmic";

export interface ContributingSubscriber {
  amountCents: number;
  interval: "month" | "year";
}

/**
 * The month's pool, accrued from every active subscriber (PRD 07: "based on
 * active subscriber count"). Yearly members contribute a twelfth of their
 * annual share each month, so a renewal month does not spike the jackpot.
 *
 * Computed over a common denominator and rounded once, so thousands of members
 * cannot accumulate per-member rounding error.
 */
export function accruePoolCents(
  subscribers: readonly ContributingSubscriber[],
  prizePoolPercent: number,
): number {
  let numerator = 0; // in units of 1/1200 of a cent
  for (const subscriber of subscribers) {
    const monthsInPeriod = subscriber.interval === "year" ? 12 : 1;
    numerator += subscriber.amountCents * prizePoolPercent * (12 / monthsInPeriod);
  }
  return Math.floor(numerator / 1200);
}

export interface MemberSnapshot {
  userId: string;
  hasAccess: boolean;
  scores: number[];
}

/** PRD 06 eligibility: a live subscription and a complete five-score ticket. */
export function selectEligibleTickets(members: readonly MemberSnapshot[]): EligibleTicket[] {
  return members
    .filter((member) => member.hasAccess && member.scores.length === TICKET_SIZE)
    .map((member) => ({ userId: member.userId, numbers: [...member.scores] }));
}

/** "2026-09" (a month input's value) to the first-of-month date draws use. */
export function periodFromMonthInput(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Expected a YYYY-MM month, got "${month}"`);
  }
  return `${month}-01`;
}

/**
 * Draws must be published in calendar order: each consumes the rollover of the
 * one before it, so back-filling an earlier month would spend a jackpot twice.
 */
export function periodIsAfterLatestPublished(period: string, latestPublished: string | null): boolean {
  return latestPublished === null || period > latestPublished;
}

export interface DrawInput {
  mode: DrawMode;
  tickets: readonly EligibleTicket[];
  contributionCents: number;
  rolloverInCents: number;
  tierSplit?: TierSplitPercent;
  rng?: Rng;
}

export interface DrawEntryOutcome extends EligibleTicket {
  matchedCount: number;
  tier: Tier | null;
  prizeCents: number;
}

export interface DrawOutcome {
  numbers: number[];
  poolTotalCents: number;
  distribution: PrizeDistribution;
  winnerCounts: Record<Tier, number>;
  entries: DrawEntryOutcome[];
  /** How many entries matched 0, 1, 2 … 5 numbers. */
  matchHistogram: number[];
}

export function computeDraw(input: DrawInput): DrawOutcome {
  const rng = input.rng ?? cryptoRng;
  const numbers =
    input.mode === "algorithmic"
      ? drawWeightedNumbers(input.tickets.map((ticket) => ticket.numbers), rng)
      : drawRandomNumbers(rng);

  const scored = scoreEntries(input.tickets, numbers);
  const winnerCounts = countWinnersByTier(scored);
  const poolTotalCents = input.contributionCents + input.rolloverInCents;
  const distribution = distributePrizes(poolTotalCents, winnerCounts, input.tierSplit ?? DEFAULT_TIER_SPLIT);

  const matchHistogram = Array.from({ length: TICKET_SIZE + 1 }, () => 0);
  for (const entry of scored) matchHistogram[entry.matchedCount] += 1;

  return {
    numbers,
    poolTotalCents,
    distribution,
    winnerCounts,
    matchHistogram,
    entries: scored.map((entry) => ({
      ...entry,
      prizeCents: entry.tier === null ? 0 : distribution.perWinnerCents[entry.tier],
    })),
  };
}

/**
 * The month members are currently playing for: this calendar month, unless its
 * draw is already published, in which case next month.
 */
export function nextDrawPeriod(now: Date, latestPublished: string | null): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const current = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  if (latestPublished === null || latestPublished < current) return current;

  const next = new Date(Date.UTC(year, month + 1, 1));
  const following = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return latestPublished < following ? following : nextDrawPeriod(next, latestPublished);
}

/** Minimum jackpot for the coming draw: carried-over jackpot plus its tier share. */
export function estimateJackpotCents(contributionCents: number, rolloverInCents: number, tierFivePercent: number): number {
  const pool = contributionCents + rolloverInCents;
  return Math.round((pool * tierFivePercent) / 100);
}
