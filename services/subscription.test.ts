import { describe, expect, it } from "vitest";
import { pickGoverningSubscription, resolveAccess } from "@/services/subscription";

const NOW = new Date("2026-09-21T12:00:00Z");
const FUTURE = "2026-10-21T12:00:00Z";
const PAST = "2026-08-21T12:00:00Z";

describe("resolveAccess", () => {
  it("grants access to an active, renewing subscription", () => {
    const access = resolveAccess(
      { status: "active", currentPeriodEnd: FUTURE, cancelAtPeriodEnd: false },
      NOW,
    );
    expect(access).toEqual({ state: "active", hasAccess: true, periodEnd: FUTURE });
  });

  it("keeps access through the paid period after cancelling", () => {
    const access = resolveAccess(
      { status: "active", currentPeriodEnd: FUTURE, cancelAtPeriodEnd: true },
      NOW,
    );
    expect(access.state).toBe("cancelling");
    expect(access.hasAccess).toBe(true);
  });

  it("lapses an active row whose period has already ended", () => {
    // Guards against a missed webhook leaving a stale 'active' status.
    const access = resolveAccess(
      { status: "active", currentPeriodEnd: PAST, cancelAtPeriodEnd: false },
      NOW,
    );
    expect(access.state).toBe("lapsed");
    expect(access.hasAccess).toBe(false);
  });

  it("treats an active row without a period end as live", () => {
    const access = resolveAccess(
      { status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false },
      NOW,
    );
    expect(access.hasAccess).toBe(true);
  });

  it("restricts a past-due subscription", () => {
    const access = resolveAccess(
      { status: "past_due", currentPeriodEnd: FUTURE, cancelAtPeriodEnd: false },
      NOW,
    );
    expect(access.state).toBe("past_due");
    expect(access.hasAccess).toBe(false);
  });

  it("restricts cancelled and lapsed subscriptions", () => {
    for (const status of ["canceled", "lapsed"] as const) {
      const access = resolveAccess(
        { status, currentPeriodEnd: PAST, cancelAtPeriodEnd: false },
        NOW,
      );
      expect(access.state).toBe("lapsed");
      expect(access.hasAccess).toBe(false);
    }
  });

  it("treats an abandoned checkout as never subscribed", () => {
    const access = resolveAccess(
      { status: "incomplete", currentPeriodEnd: null, cancelAtPeriodEnd: false },
      NOW,
    );
    expect(access.state).toBe("none");
  });

  it("returns none when there is no subscription", () => {
    expect(resolveAccess(null, NOW)).toEqual({
      state: "none",
      hasAccess: false,
      periodEnd: null,
    });
  });
});

describe("pickGoverningSubscription", () => {
  const row = (status: "active" | "canceled", createdAt: string) => ({
    status,
    createdAt,
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
  });

  it("prefers an active row over a newer cancelled one", () => {
    const picked = pickGoverningSubscription([
      row("active", "2026-01-01T00:00:00Z"),
      row("canceled", "2026-06-01T00:00:00Z"),
    ]);
    expect(picked?.status).toBe("active");
  });

  it("falls back to the most recent row when none are active", () => {
    const picked = pickGoverningSubscription([
      row("canceled", "2026-01-01T00:00:00Z"),
      row("canceled", "2026-06-01T00:00:00Z"),
    ]);
    expect(picked?.createdAt).toBe("2026-06-01T00:00:00Z");
  });

  it("returns null for no rows", () => {
    expect(pickGoverningSubscription([])).toBeNull();
  });
});
