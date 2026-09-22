import "server-only";

import { HttpError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canMarkPaid, canReview, canSubmitProof, validateProof } from "@/services/winner-rules";

/**
 * Winner verification writes. Members hold no write access to
 * the winners table (migration 0007), so every change goes through here with
 * the service role — after ownership and state are checked explicitly.
 */

const BUCKET = "winner-proof";

async function loadWinner(winnerId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("winners")
    .select("id, user_id, verification_status, payout_status, proof_path, prize_cents")
    .eq("id", winnerId)
    .maybeSingle();
  if (error) throw new Error(`Could not load winner: ${error.message}`);
  return data;
}

export async function submitProof(userId: string, winnerId: string, file: File): Promise<void> {
  const winner = await loadWinner(winnerId);
  // Someone else's winning is reported exactly like a missing one.
  if (!winner || winner.user_id !== userId) throw new HttpError(404, "That prize could not be found.");
  if (!canSubmitProof(winner.verification_status)) {
    throw new HttpError(409, "Your proof has already been submitted and is being reviewed.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateProof(file.size, bytes);
  if (!check.ok) throw new HttpError(400, check.error);

  // The folder is the session user's id, never anything from the request.
  const path = `${userId}/${winnerId}-${Date.now()}.${check.type.ext}`;
  const storage = createSupabaseAdminClient().storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(path, bytes, { contentType: check.type.contentType, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: updated, error } = await createSupabaseAdminClient()
    .from("winners")
    .update({ proof_path: path, proof_submitted_at: new Date().toISOString(), verification_status: "pending", review_note: null })
    .eq("id", winnerId)
    .in("verification_status", ["not_submitted", "rejected"])
    .select("id");

  if (error || !updated?.length) {
    await storage.remove([path]);
    if (error) throw new Error(`Could not record proof: ${error.message}`);
    throw new HttpError(409, "Your proof was submitted from another tab. Refresh to see its status.");
  }
  if (winner.proof_path) await storage.remove([winner.proof_path]);
  await recordAudit({ actorId: userId, action: "winner.proof_submitted", entity: "winner", entityId: winnerId });
}

export async function reviewWinner(
  adminId: string,
  winnerId: string,
  decision: "approved" | "rejected",
  note: string | undefined,
): Promise<void> {
  const winner = await loadWinner(winnerId);
  if (!winner) throw new HttpError(404, "That winner could not be found.");
  if (!canReview(winner.verification_status)) {
    throw new HttpError(409, "Only a submission awaiting review can be approved or rejected.");
  }

  const { data: updated, error } = await createSupabaseAdminClient()
    .from("winners")
    .update({ verification_status: decision, reviewed_by: adminId, reviewed_at: new Date().toISOString(), review_note: note ?? null })
    .eq("id", winnerId)
    .eq("verification_status", "pending")
    .select("id");
  if (error) throw new Error(`Could not save review: ${error.message}`);
  if (!updated?.length) throw new HttpError(409, "Another admin has just reviewed this submission.");
  await recordAudit({ actorId: adminId, action: `winner.${decision}`, entity: "winner", entityId: winnerId, meta: { note: note ?? null } });
}

/** Pending -> paid. Conditional update makes a double click harmless. */
export async function markPaid(adminId: string, winnerId: string): Promise<void> {
  const winner = await loadWinner(winnerId);
  if (!winner) throw new HttpError(404, "That winner could not be found.");
  if (!canMarkPaid(winner.verification_status, winner.payout_status)) {
    throw new HttpError(409, winner.payout_status === "paid" ? "This prize is already marked as paid." : "Only an approved winner can be paid.");
  }

  const { data: updated, error } = await createSupabaseAdminClient()
    .from("winners")
    .update({ payout_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", winnerId)
    .eq("verification_status", "approved")
    .eq("payout_status", "pending")
    .select("id");
  if (error) throw new Error(`Could not mark as paid: ${error.message}`);
  if (!updated?.length) throw new HttpError(409, "This prize is already marked as paid.");
  await recordAudit({ actorId: adminId, action: "winner.paid", entity: "winner", entityId: winnerId, meta: { prize_cents: winner.prize_cents } });
}
