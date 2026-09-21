import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, validateCharityPercent, validateSettingsUpdate } from "@/services/settings";

describe("parseSettings", () => {
  it("reads every configured value", () => {
    const settings = parseSettings([
      { key: "prize_pool_percent", value: 25 },
      { key: "charity_percent_min", value: 12 },
      { key: "charity_percent_max", value: 60 },
      { key: "tier_split", value: { "5": 50, "4": 30, "3": 20 } },
      { key: "default_currency", value: "EUR" },
    ]);
    expect(settings).toEqual({
      prizePoolPercent: 25,
      charityPercentMin: 12,
      charityPercentMax: 60,
      tierSplit: { 5: 50, 4: 30, 3: 20 },
      currency: "EUR",
    });
  });

  it("falls back to defaults when rows are missing", () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects non-integer percentages", () => {
    const settings = parseSettings([{ key: "prize_pool_percent", value: "thirty" }]);
    expect(settings.prizePoolPercent).toBe(30);
  });

  it("rejects a tier split that does not total 100", () => {
    // Accepting it would create or destroy prize money on every draw.
    const settings = parseSettings([
      { key: "tier_split", value: { "5": 50, "4": 50, "3": 50 } },
    ]);
    expect(settings.tierSplit).toEqual(DEFAULT_SETTINGS.tierSplit);
  });
});

describe("validateCharityPercent", () => {
  const bounds = { charityPercentMin: 10, charityPercentMax: 50, prizePoolPercent: 30 };

  it("accepts the minimum, the maximum and values between", () => {
    expect(validateCharityPercent(10, bounds)).toBeNull();
    expect(validateCharityPercent(25, bounds)).toBeNull();
    expect(validateCharityPercent(50, bounds)).toBeNull();
  });

  it("rejects values below the 10% floor", () => {
    expect(validateCharityPercent(9, bounds)).toMatch(/minimum/);
    expect(validateCharityPercent(0, bounds)).toMatch(/minimum/);
  });

  it("rejects values above the ceiling", () => {
    expect(validateCharityPercent(51, bounds)).toMatch(/maximum/);
  });

  it("rejects fractional percentages", () => {
    expect(validateCharityPercent(12.5, bounds)).toMatch(/whole/);
  });

  it("rejects a ceiling that would starve the prize pool", () => {
    const loose = { charityPercentMin: 10, charityPercentMax: 90, prizePoolPercent: 30 };
    expect(validateCharityPercent(80, loose)).toMatch(/prize pool/);
  });
});

describe("validateSettingsUpdate", () => {
  const valid = { prizePoolPercent: 30, charityPercentMin: 10, charityPercentMax: 50, tierSplit: { 5: 40, 4: 35, 3: 25 } };

  it("accepts the PRD defaults", () => {
    expect(validateSettingsUpdate(valid)).toBeNull();
  });

  it("refuses a tier split that does not total 100", () => {
    expect(validateSettingsUpdate({ ...valid, tierSplit: { 5: 50, 4: 35, 3: 25 } })).toMatch(/100%/);
  });

  it("refuses a charity minimum below the PRD's 10%", () => {
    expect(validateSettingsUpdate({ ...valid, charityPercentMin: 5 })).toMatch(/10%/);
  });

  it("refuses a minimum above the maximum", () => {
    expect(validateSettingsUpdate({ ...valid, charityPercentMin: 60, charityPercentMax: 50 })).toMatch(/minimum/);
  });

  it("refuses a ceiling that would leave invoices unsplittable", () => {
    expect(validateSettingsUpdate({ ...valid, charityPercentMax: 75 })).toMatch(/exceed 100%/);
  });

  it("refuses fractional or out-of-range values", () => {
    expect(validateSettingsUpdate({ ...valid, prizePoolPercent: 30.5 })).toMatch(/whole number/);
    expect(validateSettingsUpdate({ ...valid, prizePoolPercent: -1 })).toMatch(/whole number/);
  });
});
