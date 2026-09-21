import { describe, expect, it } from "vitest";
import { allocateProRata, percentage } from "@/services/report-rules";

const sum = (map: Map<string, number>) => [...map.values()].reduce((a, b) => a + b, 0);

describe("allocateProRata", () => {
  it("splits in proportion to weight", () => {
    const result = allocateProRata(1000, [["a", 3], ["b", 1]]);
    expect(result.get("a")).toBe(750);
    expect(result.get("b")).toBe(250);
  });

  it("always allocates exactly the total, even when it will not divide", () => {
    for (let total = 1; total <= 500; total += 7) {
      const result = allocateProRata(total, [["a", 1], ["b", 1], ["c", 1]]);
      expect(sum(result)).toBe(total);
    }
  });

  it("gives leftover cents to the largest remainders", () => {
    // 100 across 1:1:1 is 33.33 each; one cent is left over.
    const result = allocateProRata(100, [["a", 1], ["b", 1], ["c", 1]]);
    expect([...result.values()].sort()).toEqual([33, 33, 34]);
  });

  it("is deterministic for ties", () => {
    const first = allocateProRata(100, [["b", 1], ["a", 1], ["c", 1]]);
    const second = allocateProRata(100, [["c", 1], ["a", 1], ["b", 1]]);
    expect([...first.entries()].sort()).toEqual([...second.entries()].sort());
  });

  it("ignores zero-weight recipients", () => {
    const result = allocateProRata(100, [["a", 2], ["b", 0]]);
    expect(result.has("b")).toBe(false);
    expect(result.get("a")).toBe(100);
  });

  it("allocates nothing when there is nothing to split or nobody to split it to", () => {
    expect(allocateProRata(0, [["a", 1]]).size).toBe(0);
    expect(allocateProRata(100, []).size).toBe(0);
    expect(allocateProRata(100, [["a", 0]]).size).toBe(0);
  });
});

describe("percentage", () => {
  it("rounds to a whole percentage and handles zero", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
    expect(percentage(5, 0)).toBe(0);
  });
});
