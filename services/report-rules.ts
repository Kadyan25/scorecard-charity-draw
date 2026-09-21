/**
 * Pure arithmetic behind the admin reports.
 */

/**
 * Split an amount across recipients in proportion to their weights, to the
 * exact cent, using the largest-remainder method: everyone gets the floor of
 * their share, then leftover cents go to the largest fractional remainders.
 *
 * Used to attribute unclaimed 4- and 3-match money (architecture 2.5) to
 * charities in proportion to how many members support each one.
 */
export function allocateProRata(totalCents: number, weights: readonly [string, number][]): Map<string, number> {
  const allocation = new Map<string, number>();
  const positive = weights.filter(([, weight]) => weight > 0);
  const totalWeight = positive.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalCents <= 0 || totalWeight === 0) return allocation;

  const shares = positive.map(([id, weight]) => {
    const exact = (totalCents * weight) / totalWeight;
    return { id, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let leftover = totalCents - shares.reduce((sum, share) => sum + share.floor, 0);

  // Ties broken by id so the same inputs always produce the same allocation.
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (const share of byRemainder) {
    allocation.set(share.id, share.floor + (leftover > 0 ? 1 : 0));
    if (leftover > 0) leftover -= 1;
  }
  return allocation;
}

export function percentage(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
