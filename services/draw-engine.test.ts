import { describe, expect, it } from "vitest";
import {
  accruePoolCents,
  computeDraw,
  periodFromMonthInput,
  periodIsAfterLatestPublished,
  nextDrawPeriod,
  estimateJackpotCents,
  selectEligibleTickets,
} from "@/services/draw-engine";
import type { Rng } from "@/services/draw";

/** rng() === 0 always picks the lowest remaining candidate: draws [1,2,3,4,5]. */
const lowestFirst: Rng = () => 0;

describe("accruePoolCents", () => {
  it("takes the prize share of each monthly subscriber", () => {
    // 30% of £9.99 is 299.7p per member; three members is 899.1p, floored once.
    const members = Array.from({ length: 3 }, () => ({ amountCents: 999, interval: "month" as const }));
    expect(accruePoolCents(members, 30)).toBe(899);
  });

  it("spreads a yearly subscriber's share across twelve months", () => {
    // 30% of £99.90 is 2997p a year, 249.75p a month.
    expect(accruePoolCents([{ amountCents: 9990, interval: "year" }], 30)).toBe(249);
  });

  it("rounds once over the whole population, not per member", () => {
    const members = Array.from({ length: 1000 }, () => ({ amountCents: 999, interval: "month" as const }));
    // 1000 x 299.7 = 299,700 exactly; per-member flooring would lose 700p.
    expect(accruePoolCents(members, 30)).toBe(299_700);
  });

  it("is zero with no subscribers", () => {
    expect(accruePoolCents([], 30)).toBe(0);
  });
});

describe("selectEligibleTickets", () => {
  it("admits only subscribers holding exactly five scores", () => {
    const tickets = selectEligibleTickets([
      { userId: "full", hasAccess: true, scores: [1, 2, 3, 4, 5] },
      { userId: "short", hasAccess: true, scores: [1, 2, 3, 4] },
      { userId: "lapsed", hasAccess: false, scores: [1, 2, 3, 4, 5] },
      { userId: "empty", hasAccess: true, scores: [] },
    ]);
    expect(tickets.map((ticket) => ticket.userId)).toEqual(["full"]);
  });

  it("snapshots a copy of the numbers", () => {
    const scores = [1, 2, 3, 4, 5];
    const [ticket] = selectEligibleTickets([{ userId: "a", hasAccess: true, scores }]);
    scores[0] = 45;
    expect(ticket.numbers[0]).toBe(1);
  });
});

describe("periodFromMonthInput", () => {
  it("converts a month to its first day", () => {
    expect(periodFromMonthInput("2026-09")).toBe("2026-09-01");
  });

  it("rejects anything that is not a real month", () => {
    expect(() => periodFromMonthInput("2026-13")).toThrow();
    expect(() => periodFromMonthInput("2026-9")).toThrow();
    expect(() => periodFromMonthInput("next month")).toThrow();
  });
});

describe("periodIsAfterLatestPublished", () => {
  it("allows the first ever draw", () => {
    expect(periodIsAfterLatestPublished("2026-09-01", null)).toBe(true);
  });

  it("allows a later month and refuses the same or earlier month", () => {
    expect(periodIsAfterLatestPublished("2026-10-01", "2026-09-01")).toBe(true);
    expect(periodIsAfterLatestPublished("2026-09-01", "2026-09-01")).toBe(false);
    expect(periodIsAfterLatestPublished("2026-08-01", "2026-09-01")).toBe(false);
  });
});

describe("computeDraw", () => {
  const tickets = [
    { userId: "five", numbers: [1, 2, 3, 4, 5] },
    { userId: "four", numbers: [1, 2, 3, 4, 40] },
    { userId: "four-b", numbers: [2, 3, 4, 5, 41] },
    { userId: "three", numbers: [1, 2, 3, 40, 41] },
    { userId: "none", numbers: [40, 41, 42, 43, 44] },
  ];

  it("scores every ticket and pays each tier", () => {
    const outcome = computeDraw({ mode: "random", tickets, contributionCents: 90_000, rolloverInCents: 10_000, rng: lowestFirst });

    expect(outcome.numbers).toEqual([1, 2, 3, 4, 5]);
    expect(outcome.poolTotalCents).toBe(100_000);
    expect(outcome.winnerCounts).toEqual({ 5: 1, 4: 2, 3: 1 });
    const prize = Object.fromEntries(outcome.entries.map((entry) => [entry.userId, entry.prizeCents]));
    expect(prize).toEqual({ five: 40_000, four: 17_500, "four-b": 17_500, three: 25_000, none: 0 });
  });

  it("builds a histogram of matches", () => {
    const outcome = computeDraw({ mode: "random", tickets, contributionCents: 0, rolloverInCents: 0, rng: lowestFirst });
    expect(outcome.matchHistogram).toEqual([1, 0, 0, 1, 2, 1]);
  });

  it("rolls the jackpot forward when nobody matches five", () => {
    const outcome = computeDraw({
      mode: "random",
      tickets: tickets.filter((ticket) => ticket.userId !== "five"),
      contributionCents: 100_000,
      rolloverInCents: 0,
      rng: lowestFirst,
    });
    expect(outcome.distribution.rolloverOutCents).toBe(40_000);
  });

  it("always reconciles paid-out, rollover and charity against the pool", () => {
    for (let run = 0; run < 100; run += 1) {
      const outcome = computeDraw({ mode: run % 2 ? "random" : "algorithmic", tickets, contributionCents: 12_345, rolloverInCents: 678 });
      const paid = outcome.entries.reduce((sum, entry) => sum + entry.prizeCents, 0);
      expect(paid + outcome.distribution.rolloverOutCents + outcome.distribution.charityBonusCents).toBe(outcome.poolTotalCents);
    }
  });

  it("handles a month with no eligible entries", () => {
    const outcome = computeDraw({ mode: "algorithmic", tickets: [], contributionCents: 5_000, rolloverInCents: 0 });
    expect(outcome.entries).toEqual([]);
    expect(outcome.numbers).toHaveLength(5);
    expect(outcome.distribution.rolloverOutCents + outcome.distribution.charityBonusCents).toBe(5_000);
  });
});

describe("nextDrawPeriod", () => {
  const now = new Date("2026-09-21T12:00:00Z");

  it("is this month when nothing has been published", () => {
    expect(nextDrawPeriod(now, null)).toBe("2026-09-01");
  });

  it("is this month while this month's draw is still to come", () => {
    expect(nextDrawPeriod(now, "2026-08-01")).toBe("2026-09-01");
  });

  it("moves to next month once this month is published", () => {
    expect(nextDrawPeriod(now, "2026-09-01")).toBe("2026-10-01");
  });

  it("rolls into the next year", () => {
    expect(nextDrawPeriod(new Date("2026-12-10T00:00:00Z"), "2026-12-01")).toBe("2027-01-01");
  });

  it("skips past any months already published ahead of time", () => {
    expect(nextDrawPeriod(now, "2026-11-01")).toBe("2026-12-01");
  });
});

describe("estimateJackpotCents", () => {
  it("is the jackpot tier's share of contributions plus rollover", () => {
    expect(estimateJackpotCents(90_000, 10_000, 40)).toBe(40_000);
  });
});
