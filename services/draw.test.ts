import { describe, expect, it } from "vitest";
import {
  ALL_NUMBERS,
  buildFrequencyWeights,
  countMatches,
  drawRandomNumbers,
  drawWeightedNumbers,
  scoreEntries,
  tierForMatches,
  type Rng,
} from "@/services/draw";

/** Deterministic RNG cycling a fixed sequence, so draws are reproducible. */
function seededRng(sequence: number[]): Rng {
  let index = 0;
  return () => sequence[index++ % sequence.length];
}

describe("drawRandomNumbers", () => {
  it("returns five distinct numbers inside 1-45", () => {
    for (let run = 0; run < 200; run += 1) {
      const numbers = drawRandomNumbers();
      expect(numbers).toHaveLength(5);
      expect(new Set(numbers).size).toBe(5);
      for (const value of numbers) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(45);
      }
    }
  });

  it("returns numbers in ascending order", () => {
    const numbers = drawRandomNumbers();
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });

  it("is reproducible for a given RNG sequence", () => {
    const sequence = [0.1, 0.42, 0.77, 0.03, 0.91];
    expect(drawRandomNumbers(seededRng(sequence))).toEqual(
      drawRandomNumbers(seededRng(sequence)),
    );
  });

  it("can reach both ends of the range", () => {
    // rng() === 0 always selects the first remaining candidate.
    expect(drawRandomNumbers(seededRng([0]))).toEqual([1, 2, 3, 4, 5]);
    // Just under 1 always selects the last remaining candidate.
    expect(drawRandomNumbers(seededRng([0.999999]))).toEqual([41, 42, 43, 44, 45]);
  });
});

describe("buildFrequencyWeights", () => {
  it("applies +1 smoothing so unscored numbers stay reachable", () => {
    const weights = buildFrequencyWeights([[1, 2, 3, 4, 5]]);
    expect(weights.size).toBe(ALL_NUMBERS.length);
    expect(weights.get(1)).toBe(2); // 1 smoothing + 1 occurrence
    expect(weights.get(45)).toBe(1); // never scored, still possible
  });

  it("accumulates repeated values across tickets", () => {
    const weights = buildFrequencyWeights([
      [30, 30, 12, 7, 41],
      [30, 5, 5, 9, 11],
    ]);
    expect(weights.get(30)).toBe(4); // 1 + three occurrences
    expect(weights.get(5)).toBe(3); // 1 + two occurrences
  });

  it("ignores out-of-range values rather than throwing", () => {
    const weights = buildFrequencyWeights([[0, 46, 99, 20, 20]]);
    expect(weights.get(20)).toBe(3);
    expect(weights.size).toBe(ALL_NUMBERS.length);
  });
});

describe("drawWeightedNumbers", () => {
  it("never returns duplicates", () => {
    const tickets = [
      [30, 30, 12, 7, 41],
      [30, 12, 8, 8, 2],
    ];
    for (let run = 0; run < 200; run += 1) {
      const numbers = drawWeightedNumbers(tickets);
      expect(new Set(numbers).size).toBe(5);
    }
  });

  it("favours frequently scored numbers", () => {
    // 10 and 11 appear heavily; over many draws they should surface more often
    // than an arbitrary unscored number.
    const tickets = Array.from({ length: 50 }, () => [10, 11, 10, 11, 10]);
    let hot = 0;
    let cold = 0;
    for (let run = 0; run < 500; run += 1) {
      const numbers = drawWeightedNumbers(tickets);
      if (numbers.includes(10)) hot += 1;
      if (numbers.includes(38)) cold += 1;
    }
    expect(hot).toBeGreaterThan(cold);
  });

  it("still works with no eligible tickets", () => {
    const numbers = drawWeightedNumbers([]);
    expect(new Set(numbers).size).toBe(5);
  });
});

describe("countMatches", () => {
  it("counts distinct values only", () => {
    // The duplicate-score case: five 30s must not claim five matches.
    expect(countMatches([30, 30, 30, 30, 30], [30, 12, 7, 41, 5])).toBe(1);
  });

  it("treats a ticket with a repeated value as its distinct set", () => {
    expect(countMatches([30, 30, 12, 7, 41], [30, 12, 7, 41, 5])).toBe(4);
  });

  it("counts a perfect match as five", () => {
    expect(countMatches([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBe(5);
  });

  it("counts no overlap as zero", () => {
    expect(countMatches([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])).toBe(0);
  });
});

describe("tierForMatches", () => {
  it("awards tiers for three, four and five matches only", () => {
    expect(tierForMatches(5)).toBe(5);
    expect(tierForMatches(4)).toBe(4);
    expect(tierForMatches(3)).toBe(3);
    expect(tierForMatches(2)).toBeNull();
    expect(tierForMatches(0)).toBeNull();
  });
});

describe("scoreEntries", () => {
  it("scores every ticket against the drawn set", () => {
    const drawn = [1, 2, 3, 4, 5];
    const scored = scoreEntries(
      [
        { userId: "a", numbers: [1, 2, 3, 4, 5] },
        { userId: "b", numbers: [1, 2, 3, 40, 41] },
        { userId: "c", numbers: [40, 41, 42, 43, 44] },
      ],
      drawn,
    );

    expect(scored.map((entry) => entry.matchedCount)).toEqual([5, 3, 0]);
    expect(scored.map((entry) => entry.tier)).toEqual([5, 3, null]);
  });
});
