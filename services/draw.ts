/**
 * Draw number generation and matching.
 *
 * The central interpretation this platform is built on: a subscriber's
 * five retained Stableford scores ARE their draw ticket. Scores are bounded
 * 1-45 and exactly five are retained, which is precisely a 5-from-45 lottery.
 *
 * Everything here is pure and RNG-injectable so the engine can be tested
 * deterministically.
 */

export const NUMBER_MIN = 1;
export const NUMBER_MAX = 45;
export const TICKET_SIZE = 5;

/** Uniform random source in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

export const ALL_NUMBERS: readonly number[] = Array.from(
  { length: NUMBER_MAX - NUMBER_MIN + 1 },
  (_, index) => NUMBER_MIN + index,
);

/**
 * Weighted sample without replacement. Shared by both draw modes — random mode
 * is simply the uniform case where every weight is equal.
 */
function sampleWithoutReplacement(
  weights: Map<number, number>,
  count: number,
  rng: Rng,
): number[] {
  const pool = new Map(weights);
  const picked: number[] = [];

  for (let i = 0; i < count; i += 1) {
    let total = 0;
    for (const weight of pool.values()) total += weight;
    if (total <= 0) {
      throw new Error("Cannot draw: no candidate numbers with positive weight");
    }

    let threshold = rng() * total;
    let chosen: number | null = null;
    for (const [value, weight] of pool) {
      threshold -= weight;
      if (threshold < 0) {
        chosen = value;
        break;
      }
    }
    // Floating point can leave threshold marginally above zero on the last
    // candidate; fall back to it rather than failing the draw.
    chosen ??= [...pool.keys()][pool.size - 1];

    picked.push(chosen);
    pool.delete(chosen);
  }

  return picked.sort((a, b) => a - b);
}

/** Random mode — uniform, five distinct numbers from 1-45. */
export function drawRandomNumbers(rng: Rng = cryptoRng): number[] {
  const weights = new Map(ALL_NUMBERS.map((value) => [value, 1]));
  return sampleWithoutReplacement(weights, TICKET_SIZE, rng);
}

/**
 * How often each number 1-45 appears across all eligible tickets.
 *
 * Laplace smoothing (+1) is applied so a number nobody has scored still has a
 * chance of being drawn. Without it the draw would be capped at whatever the
 * player base has already shot, and a sparse first month would collapse to a
 * handful of possible numbers.
 */
export function buildFrequencyWeights(tickets: readonly number[][]): Map<number, number> {
  const weights = new Map(ALL_NUMBERS.map((value) => [value, 1]));

  for (const ticket of tickets) {
    for (const value of ticket) {
      const current = weights.get(value);
      if (current === undefined) continue; // ignore out-of-range data defensively
      weights.set(value, current + 1);
    }
  }

  return weights;
}

/** Algorithmic mode — weighted by score frequency across eligible tickets. */
export function drawWeightedNumbers(
  tickets: readonly number[][],
  rng: Rng = cryptoRng,
): number[] {
  return sampleWithoutReplacement(buildFrequencyWeights(tickets), TICKET_SIZE, rng);
}

/**
 * Matches between a ticket and the drawn set, counted over DISTINCT values.
 *
 * A golfer can legitimately shoot the same Stableford score on two dates, so a
 * ticket is not guaranteed to hold five distinct numbers. Counting duplicates
 * would let [30, 30, 30, 30, 30] claim five matches against a single drawn 30.
 */
export function countMatches(ticket: readonly number[], drawn: readonly number[]): number {
  const drawnSet = new Set(drawn);
  const seen = new Set<number>();

  for (const value of ticket) {
    if (drawnSet.has(value)) seen.add(value);
  }

  return seen.size;
}

export type Tier = 3 | 4 | 5;

/** Only 3, 4 and 5 matches win anything. */
export function tierForMatches(matches: number): Tier | null {
  if (matches === 5) return 5;
  if (matches === 4) return 4;
  if (matches === 3) return 3;
  return null;
}

export interface EligibleTicket {
  userId: string;
  numbers: number[];
}

export interface ScoredEntry extends EligibleTicket {
  matchedCount: number;
  tier: Tier | null;
}

/** Score every eligible ticket against the drawn numbers. */
export function scoreEntries(
  tickets: readonly EligibleTicket[],
  drawn: readonly number[],
): ScoredEntry[] {
  return tickets.map((ticket) => {
    const matchedCount = countMatches(ticket.numbers, drawn);
    return { ...ticket, matchedCount, tier: tierForMatches(matchedCount) };
  });
}
