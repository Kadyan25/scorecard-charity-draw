import { describe, expect, it } from "vitest";
import {
  computeTierPools,
  countWinnersByTier,
  distributePrizes,
  splitContribution,
} from "@/services/prize";

describe("splitContribution", () => {
  it("splits an invoice three ways summing to exactly the invoice", () => {
    const split = splitContribution(999, 10, 30);
    expect(split.charityCents).toBe(100); // 10% of 999 rounded
    expect(split.prizePoolCents).toBe(300); // 30% of 999 rounded
    expect(
      split.charityCents + split.prizePoolCents + split.platformCents,
    ).toBe(999);
  });

  it("reconciles exactly across many awkward amounts", () => {
    for (let amount = 1; amount <= 2000; amount += 1) {
      for (const charityPercent of [10, 17, 33, 50]) {
        const split = splitContribution(amount, charityPercent, 30);
        expect(
          split.charityCents + split.prizePoolCents + split.platformCents,
        ).toBe(amount);
        expect(split.platformCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("honours a raised charity percentage", () => {
    const base = splitContribution(10_000, 10, 30);
    const raised = splitContribution(10_000, 50, 30);
    expect(base.charityCents).toBe(1_000);
    expect(raised.charityCents).toBe(5_000);
    // Prize pool is fixed, so the platform share absorbs the increase.
    expect(raised.prizePoolCents).toBe(base.prizePoolCents);
    expect(raised.platformCents).toBe(2_000);
  });

  it("rejects a split that would exceed the invoice", () => {
    expect(() => splitContribution(10_000, 80, 30)).toThrow(/cannot exceed 100/);
  });

  it("rejects non-integer amounts", () => {
    expect(() => splitContribution(10.5, 10, 30)).toThrow(/integer number of cents/);
  });
});

describe("computeTierPools", () => {
  it("carves the pool 40/35/25", () => {
    const pools = computeTierPools(100_000);
    expect(pools[5]).toBe(40_000);
    expect(pools[4]).toBe(35_000);
    expect(pools[3]).toBe(25_000);
  });

  it("reconciles exactly when percentages do not divide cleanly", () => {
    for (let total = 0; total <= 1000; total += 1) {
      const pools = computeTierPools(total);
      expect(pools[5] + pools[4] + pools[3]).toBe(total);
    }
  });
});

describe("distributePrizes", () => {
  it("splits each tier equally among its winners", () => {
    const result = distributePrizes(100_000, { 5: 1, 4: 2, 3: 5 });
    expect(result.perWinnerCents[5]).toBe(40_000);
    expect(result.perWinnerCents[4]).toBe(17_500);
    expect(result.perWinnerCents[3]).toBe(5_000);
    expect(result.paidOutCents).toBe(100_000);
    expect(result.rolloverOutCents).toBe(0);
    expect(result.charityBonusCents).toBe(0);
  });

  it("rolls the jackpot forward when nobody matches five", () => {
    const result = distributePrizes(100_000, { 5: 0, 4: 1, 3: 1 });
    expect(result.perWinnerCents[5]).toBe(0);
    expect(result.rolloverOutCents).toBe(40_000);
    expect(result.paidOutCents).toBe(60_000);
    expect(result.charityBonusCents).toBe(0);
  });

  it("routes unclaimed 4- and 3-match pools to charity", () => {
    const result = distributePrizes(100_000, { 5: 1, 4: 0, 3: 0 });
    expect(result.paidOutCents).toBe(40_000);
    expect(result.charityBonusCents).toBe(60_000);
    expect(result.rolloverOutCents).toBe(0);
  });

  it("carries an undividable remainder into the rollover", () => {
    // 40% of 1000 is 400, split three ways is 133 each with 1 cent left over.
    const result = distributePrizes(1_000, { 5: 3, 4: 0, 3: 0 });
    expect(result.perWinnerCents[5]).toBe(133);
    expect(result.paidOutCents).toBe(399);
    expect(result.rolloverOutCents).toBe(1);
    expect(result.charityBonusCents).toBe(600);
  });

  it("sends the whole pool onward when there are no winners at all", () => {
    const result = distributePrizes(100_000, { 5: 0, 4: 0, 3: 0 });
    expect(result.paidOutCents).toBe(0);
    expect(result.rolloverOutCents).toBe(40_000);
    expect(result.charityBonusCents).toBe(60_000);
  });

  it("handles an empty pool", () => {
    const result = distributePrizes(0, { 5: 0, 4: 0, 3: 0 });
    expect(result.paidOutCents).toBe(0);
    expect(result.rolloverOutCents).toBe(0);
    expect(result.charityBonusCents).toBe(0);
  });

  it("always reconciles against the pool total", () => {
    const counts = [0, 1, 2, 3, 7];
    for (let total = 0; total <= 3000; total += 7) {
      for (const five of counts) {
        for (const four of counts) {
          for (const three of counts) {
            const result = distributePrizes(total, { 5: five, 4: four, 3: three });
            expect(
              result.paidOutCents +
                result.rolloverOutCents +
                result.charityBonusCents,
            ).toBe(total);
          }
        }
      }
    }
  });
});

describe("countWinnersByTier", () => {
  it("tallies scored entries by tier and ignores non-winners", () => {
    const counts = countWinnersByTier([
      { tier: 5 },
      { tier: 4 },
      { tier: 4 },
      { tier: 3 },
      { tier: null },
      { tier: null },
    ]);
    expect(counts).toEqual({ 5: 1, 4: 2, 3: 1 });
  });
});
