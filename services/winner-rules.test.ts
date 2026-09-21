import { describe, expect, it } from "vitest";
import {
  canMarkPaid,
  canReview,
  canSubmitProof,
  detectImageType,
  MAX_PROOF_BYTES,
  summariseWinnings,
  validateProof,
  winnerStage,
} from "@/services/winner-rules";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0]);
const html = new TextEncoder().encode("<script>alert(1)</script>");

describe("detectImageType", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(detectImageType(png)?.ext).toBe("png");
    expect(detectImageType(jpeg)?.ext).toBe("jpg");
    expect(detectImageType(webp)?.ext).toBe("webp");
  });

  it("rejects other formats whatever they claim to be", () => {
    expect(detectImageType(pdf)).toBeNull();
    expect(detectImageType(html)).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });

  it("does not mistake a non-WebP RIFF file (such as WAV) for an image", () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(detectImageType(wav)).toBeNull();
  });
});

describe("validateProof", () => {
  it("accepts a real image within the limit", () => {
    const result = validateProof(1024, png);
    expect(result.ok && result.type.contentType).toBe("image/png");
  });

  it("rejects empty and oversized files", () => {
    expect(validateProof(0, png)).toEqual({ ok: false, error: "That file is empty." });
    expect(validateProof(MAX_PROOF_BYTES + 1, png).ok).toBe(false);
  });

  it("accepts a file exactly at the limit", () => {
    expect(validateProof(MAX_PROOF_BYTES, png).ok).toBe(true);
  });

  it("rejects a disguised non-image", () => {
    expect(validateProof(1024, html).ok).toBe(false);
  });
});

describe("state machine", () => {
  it("lets a winner submit until approved, including after a rejection", () => {
    expect(canSubmitProof("not_submitted")).toBe(true);
    expect(canSubmitProof("rejected")).toBe(true);
    expect(canSubmitProof("pending")).toBe(false);
    expect(canSubmitProof("approved")).toBe(false);
  });

  it("only reviews pending submissions", () => {
    expect(canReview("pending")).toBe(true);
    expect(canReview("not_submitted")).toBe(false);
    expect(canReview("approved")).toBe(false);
    expect(canReview("rejected")).toBe(false);
  });

  it("only pays approved, unpaid winners", () => {
    expect(canMarkPaid("approved", "pending")).toBe(true);
    expect(canMarkPaid("approved", "paid")).toBe(false);
    expect(canMarkPaid("pending", "pending")).toBe(false);
    expect(canMarkPaid("rejected", "pending")).toBe(false);
    expect(canMarkPaid("not_submitted", "pending")).toBe(false);
  });
});

describe("winnerStage", () => {
  it("maps every combination to one stage", () => {
    expect(winnerStage("not_submitted", "pending")).toBe("needs_proof");
    expect(winnerStage("pending", "pending")).toBe("under_review");
    expect(winnerStage("rejected", "pending")).toBe("rejected");
    expect(winnerStage("approved", "pending")).toBe("approved_unpaid");
    expect(winnerStage("approved", "paid")).toBe("paid");
  });
});

describe("summariseWinnings", () => {
  it("totals won, paid and outstanding, and counts actions needed", () => {
    const summary = summariseWinnings([
      { prize_cents: 1000, verification_status: "approved", payout_status: "paid" },
      { prize_cents: 500, verification_status: "approved", payout_status: "pending" },
      { prize_cents: 300, verification_status: "not_submitted", payout_status: "pending" },
      { prize_cents: 200, verification_status: "rejected", payout_status: "pending" },
      { prize_cents: 100, verification_status: "pending", payout_status: "pending" },
    ]);
    expect(summary).toEqual({ totalWonCents: 2100, paidCents: 1000, outstandingCents: 1100, actionNeeded: 2 });
  });

  it("is all zeros with no winnings", () => {
    expect(summariseWinnings([])).toEqual({ totalWonCents: 0, paidCents: 0, outstandingCents: 0, actionNeeded: 0 });
  });
});
