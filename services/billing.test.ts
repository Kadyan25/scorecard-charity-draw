import { describe, expect, it } from "vitest";
import {
  buildPaymentSplit,
  expandableId,
  fromUnixSeconds,
  invoiceSubscriptionId,
  mapStripeStatus,
  subscriptionPeriod,
  subscriptionPriceId,
  toSubscriptionRecord,
  type StripeInvoiceLike,
  type StripeSubscriptionLike,
  type StripeSubscriptionStatus,
} from "@/services/billing";

describe("mapStripeStatus", () => {
  const cases: [StripeSubscriptionStatus, string][] = [
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["canceled", "canceled"],
    ["incomplete_expired", "canceled"],
    ["unpaid", "lapsed"],
    ["paused", "lapsed"],
    ["incomplete", "incomplete"],
  ];

  it.each(cases)("maps Stripe %s to %s", (stripe, ours) => {
    expect(mapStripeStatus(stripe)).toBe(ours);
  });

  it("never grants access for a status Stripe adds in future", () => {
    expect(mapStripeStatus("some_new_status")).toBe("lapsed");
  });
});

describe("fromUnixSeconds", () => {
  it("converts Unix seconds to an ISO timestamp", () => {
    expect(fromUnixSeconds(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(fromUnixSeconds(86_400)).toBe("1970-01-02T00:00:00.000Z");
  });

  it("passes missing values through as null", () => {
    expect(fromUnixSeconds(null)).toBeNull();
    expect(fromUnixSeconds(undefined)).toBeNull();
  });
});

describe("buildPaymentSplit", () => {
  it("snapshots the member's charity choice with a reconciling split", () => {
    const record = buildPaymentSplit({
      amountPaidCents: 999,
      charityId: "charity-1",
      charityPercent: 15,
      prizePoolPercent: 30,
    });
    expect(record).toEqual({
      charity_id_snapshot: "charity-1",
      charity_percent_snapshot: 15,
      charity_amount_cents: 150,
      prize_pool_amount_cents: 300,
      platform_amount_cents: 549,
    });
  });

  it("handles the yearly plan amount", () => {
    const record = buildPaymentSplit({
      amountPaidCents: 9_990,
      charityId: "charity-1",
      charityPercent: 10,
      prizePoolPercent: 30,
    });
    expect(record.charity_amount_cents).toBe(999);
    expect(record.prize_pool_amount_cents).toBe(2_997);
    expect(
      record.charity_amount_cents +
        record.prize_pool_amount_cents +
        record.platform_amount_cents,
    ).toBe(9_990);
  });

  it("gives nothing to charity when no charity is selected", () => {
    const record = buildPaymentSplit({
      amountPaidCents: 999,
      charityId: null,
      charityPercent: 25,
      prizePoolPercent: 30,
    });
    expect(record.charity_amount_cents).toBe(0);
    expect(record.charity_percent_snapshot).toBe(0);
    expect(record.platform_amount_cents).toBe(699);
  });

  it("handles a zero-value invoice such as a full discount", () => {
    const record = buildPaymentSplit({
      amountPaidCents: 0,
      charityId: "charity-1",
      charityPercent: 10,
      prizePoolPercent: 30,
    });
    expect(record.charity_amount_cents).toBe(0);
    expect(record.prize_pool_amount_cents).toBe(0);
    expect(record.platform_amount_cents).toBe(0);
  });
});

function subscription(overrides: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: {},
    items: {
      data: [{ current_period_start: 0, current_period_end: 86_400, price: { id: "price_m" } }],
    },
    ...overrides,
  };
}

function invoice(overrides: Partial<StripeInvoiceLike> = {}): StripeInvoiceLike {
  return {
    id: "in_1",
    amount_paid: 999,
    currency: "gbp",
    customer: "cus_1",
    status_transitions: { paid_at: 86_400 },
    parent: { subscription_details: { subscription: "sub_1" } },
    ...overrides,
  };
}

describe("expandableId", () => {
  it("reads ids from both string and expanded forms", () => {
    expect(expandableId("cus_1")).toBe("cus_1");
    expect(expandableId({ id: "cus_2" })).toBe("cus_2");
    expect(expandableId(null)).toBeNull();
  });
});

describe("subscriptionPeriod", () => {
  it("reads the period from the subscription item", () => {
    expect(subscriptionPeriod(subscription())).toEqual({
      start: "1970-01-01T00:00:00.000Z",
      end: "1970-01-02T00:00:00.000Z",
    });
  });

  it("spans every item when there are several", () => {
    const period = subscriptionPeriod(
      subscription({
        items: {
          data: [
            { current_period_start: 86_400, current_period_end: 172_800, price: { id: "a" } },
            { current_period_start: 0, current_period_end: 259_200, price: { id: "b" } },
          ],
        },
      }),
    );
    expect(period.start).toBe("1970-01-01T00:00:00.000Z");
    expect(period.end).toBe("1970-01-04T00:00:00.000Z");
  });

  it("returns nulls for a subscription with no items", () => {
    expect(subscriptionPeriod(subscription({ items: { data: [] } }))).toEqual({
      start: null,
      end: null,
    });
  });
});

describe("subscriptionPriceId", () => {
  it("returns the first item's price", () => {
    expect(subscriptionPriceId(subscription())).toBe("price_m");
  });

  it("returns null when there are no items", () => {
    expect(subscriptionPriceId(subscription({ items: { data: [] } }))).toBeNull();
  });
});

describe("invoiceSubscriptionId", () => {
  it("finds the subscription through the invoice parent", () => {
    expect(invoiceSubscriptionId(invoice())).toBe("sub_1");
  });

  it("handles an expanded subscription object", () => {
    expect(
      invoiceSubscriptionId(invoice({ parent: { subscription_details: { subscription: { id: "sub_9" } } } })),
    ).toBe("sub_9");
  });

  it("returns null for a one-off invoice with no subscription", () => {
    expect(invoiceSubscriptionId(invoice({ parent: null }))).toBeNull();
    expect(invoiceSubscriptionId(invoice({ parent: { subscription_details: null } }))).toBeNull();
  });
});

describe("toSubscriptionRecord", () => {
  it("maps a live subscription onto our columns", () => {
    expect(toSubscriptionRecord(subscription())).toEqual({
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      status: "active",
      current_period_start: "1970-01-01T00:00:00.000Z",
      current_period_end: "1970-01-02T00:00:00.000Z",
      cancel_at_period_end: false,
      canceled_at: null,
    });
  });

  it("records a scheduled cancellation without revoking access", () => {
    const record = toSubscriptionRecord(subscription({ cancel_at_period_end: true }));
    expect(record.status).toBe("active");
    expect(record.cancel_at_period_end).toBe(true);
  });

  it("records a completed cancellation", () => {
    const record = toSubscriptionRecord(subscription({ status: "canceled", canceled_at: 86_400 }));
    expect(record.status).toBe("canceled");
    expect(record.canceled_at).toBe("1970-01-02T00:00:00.000Z");
  });
});
