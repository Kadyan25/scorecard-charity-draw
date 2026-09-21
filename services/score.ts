import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { HttpError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/supabase/types";
import type { ScoreInput } from "@/lib/validation";
import { mapScoreDbError } from "@/services/score-rules";

/**
 * Score CRUD. Every query runs under the member's session, so RLS pins each
 * row to the caller — user_id is set from the session, never from input — and
 * the rolling-five window is applied by a database trigger on insert.
 */

function rethrow(error: PostgrestError): never {
  const mapped = mapScoreDbError(error);
  if (mapped) throw new HttpError(mapped.status, mapped.message);
  throw new Error(`Score operation failed: ${error.message}`);
}

export async function listScores(userId: string): Promise<ScoreRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("user_id", userId)
    .order("played_on", { ascending: false });
  if (error) rethrow(error);
  return data ?? [];
}

export async function addScore(userId: string, input: ScoreInput): Promise<ScoreRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scores")
    .insert({ user_id: userId, value: input.value, played_on: input.playedOn })
    .select()
    .single();
  if (error) rethrow(error);
  return data;
}

export async function updateScore(
  userId: string,
  scoreId: string,
  patch: Partial<ScoreInput>,
): Promise<ScoreRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scores")
    .update({
      ...(patch.value !== undefined && { value: patch.value }),
      ...(patch.playedOn !== undefined && { played_on: patch.playedOn }),
    })
    .eq("id", scoreId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) rethrow(error);
  // RLS hides other members' rows, so "not yours" and "does not exist" look
  // identical here — deliberately, so ids cannot be probed.
  if (!data) throw new HttpError(404, "That score could not be found.");
  return data;
}

export async function deleteScore(userId: string, scoreId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scores")
    .delete()
    .eq("id", scoreId)
    .eq("user_id", userId)
    .select("id");
  if (error) rethrow(error);
  if (!data || data.length === 0) throw new HttpError(404, "That score could not be found.");
}
