/**
 * Winner verification rules (PRD section 09): proof upload, admin review,
 * pending -> paid. Pure, so the state machine can be tested exhaustively.
 */

import type { PayoutStatus, VerificationStatus } from "@/lib/supabase/types";

/**
 * Proof uploads pass through a serverless function, and Vercel caps request
 * bodies at 4.5 MB; 4 MB leaves room for the multipart envelope.
 */
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

export type ProofImageType = { ext: "png" | "jpg" | "webp"; contentType: string };

/**
 * Identify an image by its leading bytes. The browser-supplied Content-Type is
 * whatever the client says it is, so it is never trusted on its own.
 */
export function detectImageType(bytes: Uint8Array): ProofImageType | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: "png", contentType: "image/png" };
  if (starts(0xff, 0xd8, 0xff)) return { ext: "jpg", contentType: "image/jpeg" };
  const isRiff = starts(0x52, 0x49, 0x46, 0x46);
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (isRiff && isWebp) return { ext: "webp", contentType: "image/webp" };
  return null;
}

export function validateProof(size: number, bytes: Uint8Array): { ok: true; type: ProofImageType } | { ok: false; error: string } {
  if (size === 0) return { ok: false, error: "That file is empty." };
  if (size > MAX_PROOF_BYTES) return { ok: false, error: "Screenshots must be 4 MB or smaller." };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "Please upload a PNG, JPEG or WebP screenshot." };
  return { ok: true, type };
}

/** A winner may (re)submit until an admin approves them. */
export function canSubmitProof(status: VerificationStatus): boolean {
  return status === "not_submitted" || status === "rejected";
}

export function canReview(status: VerificationStatus): boolean {
  return status === "pending";
}

/** Money only moves for a verified winner, and only once. */
export function canMarkPaid(verification: VerificationStatus, payout: PayoutStatus): boolean {
  return verification === "approved" && payout === "pending";
}

export type WinnerStage = "needs_proof" | "under_review" | "rejected" | "approved_unpaid" | "paid";

export function winnerStage(verification: VerificationStatus, payout: PayoutStatus): WinnerStage {
  if (payout === "paid") return "paid";
  if (verification === "approved") return "approved_unpaid";
  if (verification === "pending") return "under_review";
  if (verification === "rejected") return "rejected";
  return "needs_proof";
}

export interface WinningsSummary {
  totalWonCents: number;
  paidCents: number;
  /** Approved but not yet paid, or still going through verification. */
  outstandingCents: number;
  actionNeeded: number;
}

export function summariseWinnings(
  rows: readonly { prize_cents: number; verification_status: VerificationStatus; payout_status: PayoutStatus }[],
): WinningsSummary {
  const summary: WinningsSummary = { totalWonCents: 0, paidCents: 0, outstandingCents: 0, actionNeeded: 0 };
  for (const row of rows) {
    summary.totalWonCents += row.prize_cents;
    if (row.payout_status === "paid") summary.paidCents += row.prize_cents;
    else summary.outstandingCents += row.prize_cents;
    if (canSubmitProof(row.verification_status)) summary.actionNeeded += 1;
  }
  return summary;
}
