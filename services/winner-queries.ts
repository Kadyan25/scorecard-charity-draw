import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/supabase/paginate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WinnerRow } from "@/lib/supabase/types";
import { winnerStage, type WinnerStage } from "@/services/winner-rules";

export interface WinningView extends WinnerRow {
  periodMonth: string;
  stage: WinnerStage;
}

/** The member's own prizes. Read under their session, so RLS scopes it. */
export async function listMyWinnings(userId: string): Promise<WinningView[]> {
  const supabase = await createSupabaseServerClient();
  const { data: winners, error } = await supabase
    .from("winners")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load winnings: ${error.message}`);
  if (!winners?.length) return [];

  const { data: draws, error: drawError } = await supabase
    .from("draws")
    .select("id, period_month")
    .in("id", [...new Set(winners.map((winner) => winner.draw_id))]);
  if (drawError) throw new Error(`Could not load draws: ${drawError.message}`);
  const period = new Map((draws ?? []).map((draw) => [draw.id, draw.period_month]));

  return winners.map((winner) => ({
    ...winner,
    periodMonth: period.get(winner.draw_id) ?? "",
    stage: winnerStage(winner.verification_status, winner.payout_status),
  }));
}

export interface AdminWinnerView extends WinningView {
  memberName: string;
  memberEmail: string;
  /** Short-lived link to the private proof image. */
  proofUrl: string | null;
}

const PROOF_LINK_SECONDS = 10 * 60;

export async function listWinnersForAdmin(): Promise<AdminWinnerView[]> {
  const admin = createSupabaseAdminClient();
  const winners = await selectAll(
    (from, to) => admin.from("winners").select("*").order("created_at", { ascending: false }).order("id").range(from, to),
    "winners",
  );
  if (winners.length === 0) return [];

  const userIds = [...new Set(winners.map((winner) => winner.user_id))];
  const drawIds = [...new Set(winners.map((winner) => winner.draw_id))];
  const paths = winners.map((winner) => winner.proof_path).filter((path): path is string => path !== null);

  const [profiles, draws, links] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", userIds),
    admin.from("draws").select("id, period_month").in("id", drawIds),
    paths.length ? admin.storage.from("winner-proof").createSignedUrls(paths, PROOF_LINK_SECONDS) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error) throw new Error(`Could not load members: ${profiles.error.message}`);
  if (draws.error) throw new Error(`Could not load draws: ${draws.error.message}`);
  if (links.error) throw new Error(`Could not sign proof links: ${links.error.message}`);

  const people = new Map((profiles.data ?? []).map((person) => [person.id, person]));
  const periods = new Map((draws.data ?? []).map((draw) => [draw.id, draw.period_month]));
  const urls = new Map((links.data ?? []).map((link) => [link.path, link.signedUrl]));

  return winners.map((winner) => ({
    ...winner,
    periodMonth: periods.get(winner.draw_id) ?? "",
    stage: winnerStage(winner.verification_status, winner.payout_status),
    memberName: people.get(winner.user_id)?.full_name ?? "Member",
    memberEmail: people.get(winner.user_id)?.email ?? "",
    proofUrl: winner.proof_path ? urls.get(winner.proof_path) ?? null : null,
  }));
}
