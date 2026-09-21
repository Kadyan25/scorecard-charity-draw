import { describe, expect, it } from "vitest";
import {
  describeTicket,
  latestAllowedPlayDate,
  mapScoreDbError,
  sortNewestFirst,
} from "@/services/score-rules";

describe("latestAllowedPlayDate", () => {
  it("allows one day beyond the UTC date", () => {
    expect(latestAllowedPlayDate(new Date("2026-09-21T12:00:00Z"))).toBe("2026-09-22");
  });

  it("covers a golfer in India just after local midnight", () => {
    // 00:30 IST on the 22nd is still 19:00 UTC on the 21st.
    const now = new Date("2026-09-21T19:00:00Z");
    expect("2026-09-22" <= latestAllowedPlayDate(now)).toBe(true);
  });

  it("rolls over month and year boundaries", () => {
    expect(latestAllowedPlayDate(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });
});

describe("sortNewestFirst", () => {
  it("orders by play date, most recent first", () => {
    const sorted = sortNewestFirst([
      { value: 1, played_on: "2026-09-01" },
      { value: 2, played_on: "2026-09-15" },
      { value: 3, played_on: "2026-08-30" },
    ]);
    expect(sorted.map((score) => score.value)).toEqual([2, 1, 3]);
  });

  it("does not mutate its input", () => {
    const input = [
      { value: 1, played_on: "2026-09-01" },
      { value: 2, played_on: "2026-09-15" },
    ];
    sortNewestFirst(input);
    expect(input[0].value).toBe(1);
  });
});

describe("describeTicket", () => {
  const five = [
    { value: 30, played_on: "2026-09-20" },
    { value: 12, played_on: "2026-09-18" },
    { value: 7, played_on: "2026-09-10" },
    { value: 41, played_on: "2026-09-05" },
    { value: 22, played_on: "2026-09-01" },
  ];

  it("reports an empty ticket", () => {
    expect(describeTicket([])).toEqual({
      numbers: [],
      count: 0,
      remaining: 5,
      complete: false,
      hasDuplicates: false,
      nextToReplace: null,
    });
  });

  it("reports progress towards a full ticket", () => {
    const summary = describeTicket(five.slice(0, 3));
    expect(summary.count).toBe(3);
    expect(summary.remaining).toBe(2);
    expect(summary.complete).toBe(false);
    expect(summary.nextToReplace).toBeNull();
  });

  it("identifies the oldest round as the next to be replaced", () => {
    const summary = describeTicket(five);
    expect(summary.complete).toBe(true);
    expect(summary.remaining).toBe(0);
    expect(summary.nextToReplace).toEqual({ value: 22, played_on: "2026-09-01" });
  });

  it("lists numbers newest first regardless of input order", () => {
    expect(describeTicket([...five].reverse()).numbers).toEqual([30, 12, 7, 41, 22]);
  });

  it("flags repeated values, which count once in the draw", () => {
    const summary = describeTicket([
      { value: 30, played_on: "2026-09-20" },
      { value: 30, played_on: "2026-09-18" },
    ]);
    expect(summary.hasDuplicates).toBe(true);
  });
});

describe("mapScoreDbError", () => {
  it("explains a duplicate date", () => {
    expect(mapScoreDbError({ code: "23505", message: "duplicate key" })?.status).toBe(409);
  });

  it("passes the backdate trigger's own message through", () => {
    const message =
      "Score date 2026-01-01 is older than your five retained scores (oldest kept: 2026-09-01). Edit or delete an existing score instead.";
    expect(mapScoreDbError({ code: "23514", message })).toEqual({ status: 422, message });
  });

  it("explains other check failures without leaking constraint names", () => {
    const result = mapScoreDbError({
      code: "23514",
      message: 'new row violates check constraint "scores_value_check"',
    });
    expect(result?.status).toBe(400);
    expect(result?.message).not.toContain("scores_value_check");
  });

  it("maps a row-level-security refusal to forbidden", () => {
    expect(mapScoreDbError({ code: "42501", message: "rls" })?.status).toBe(403);
  });

  it("returns null for anything unexpected", () => {
    expect(mapScoreDbError({ code: "08006", message: "connection failure" })).toBeNull();
    expect(mapScoreDbError({ message: "no code" })).toBeNull();
  });
});
