import { describe, expect, it } from "vitest";
import {
  coverThemeFor,
  initialsFor,
  normaliseCategory,
  sanitizeSearchTerm,
} from "@/services/charity-rules";

describe("sanitizeSearchTerm", () => {
  it("keeps ordinary words", () => {
    expect(sanitizeSearchTerm("youth trust")).toBe("youth trust");
  });

  it("strips PostgREST filter syntax so a search cannot rewrite the query", () => {
    const hostile = "x),is_active.eq.false,(name.ilike.*";
    const cleaned = sanitizeSearchTerm(hostile);
    expect(cleaned).not.toMatch(/[(),*.]/);
  });

  it("strips LIKE wildcards", () => {
    expect(sanitizeSearchTerm("100%_off")).toBe("100 off");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchTerm("   open    green  ")).toBe("open green");
  });

  it("caps the length", () => {
    expect(sanitizeSearchTerm("a".repeat(500))).toHaveLength(60);
  });

  it("treats missing input as empty", () => {
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm(null)).toBe("");
  });
});

describe("normaliseCategory", () => {
  const known = ["Youth", "Health", "Environment"];

  it("matches case-insensitively and returns the canonical form", () => {
    expect(normaliseCategory("youth", known)).toBe("Youth");
  });

  it("rejects unknown categories rather than passing them to the query", () => {
    expect(normaliseCategory("Sports", known)).toBeNull();
    expect(normaliseCategory("", known)).toBeNull();
  });
});

describe("coverThemeFor", () => {
  it("is stable for a given slug", () => {
    expect(coverThemeFor("greenfield-youth-trust")).toEqual(coverThemeFor("greenfield-youth-trust"));
  });

  it("spreads different charities across the palette", () => {
    const slugs = ["a", "bb", "ccc", "dddd", "eeeee", "ffffff", "ggggggg", "hhhhhhhh"];
    const gradients = new Set(slugs.map((slug) => coverThemeFor(slug).gradient));
    expect(gradients.size).toBeGreaterThan(2);
  });
});

describe("initialsFor", () => {
  it("skips filler words", () => {
    expect(initialsFor("The Caddie Fund")).toBe("CF");
    expect(initialsFor("Fairway to Recovery")).toBe("FR");
  });

  it("uses the first two significant words", () => {
    expect(initialsFor("Greenfield Youth Trust")).toBe("GY");
  });

  it("handles a single word", () => {
    expect(initialsFor("Birdie")).toBe("B");
  });
});
