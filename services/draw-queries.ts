import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/supabase/paginate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DrawEntryRow, DrawRow } from "@/lib/supabase/types";
import { TICKET_SIZE } from "@/services/draw";

export interface WinnerCounts { 5: number; 4: number; 3: number }

export interface AdminEntry extends DrawEntryRow {
  memberName: string;
  memberEmail: string;
}

export interface AdminDrawView {
  draw: DrawRow | null;
  entries: AdminEntry[];
  histogram: number[];
  winnerCounts: WinnerCounts;
}

function tally(rows: readonly { tier: number | null }[]): WinnerCounts {
  const counts: WinnerCounts = { 5: 0, 4: 0, 3: 0 };
  for (const row of rows) if (row.tier === 5 || row.tier === 4 || row.tier === 3) counts[row.tier] += 1;
  return counts;
}

/** The draw an admin is working on for a month: the published one if it exists. */
export async function loadAdminDrawView(period: string): Promise<AdminDrawView> {
  const admin = createSupabaseAdminClient();
  const { data: draws, error } = await admin
    .from("draws")
    .select("*")
    .eq("period_month", period)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load draw: ${error.message}`);
  const draw = draws?.find((row) => row.status === "published") ?? draws?.find((row) => row.status === "simulated") ?? null;
  if (!draw) return { draw: null, entries: [], histogram: [], winnerCounts: { 5: 0, 4: 0, 3: 0 } };

  const entries = await selectAll(
    (from, to) => admin.from("draw_entries").select("*").eq("draw_id", draw.id).order("matched_count", { ascending: false }).order("id").range(from, to),
    "draw entries",
  );
  const winnerIds = [...new Set(entries.filter((entry) => entry.tier !== null).map((entry) => entry.user_id))];
  const { data: profiles, error: profileError } = winnerIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", winnerIds)
    : { data: [], error: null };
  if (profileError) throw new Error(`Could not load winners: ${profileError.message}`);
  const people = new Map((profiles ?? []).map((person) => [person.id, person]));

  const histogram = Array.from({ length: TICKET_SIZE + 1 }, () => 0);
  for (const entry of entries) histogram[entry.matched_count] += 1;

  return {
    draw,
    histogram,
    winnerCounts: tally(entries),
    entries: entries.map((entry) => ({
      ...entry,
      memberName: people.get(entry.user_id)?.full_name ?? "Member",
      memberEmail: people.get(entry.user_id)?.email ?? "",
    })),
  };
}

export interface PublishedDrawSummary extends DrawRow {
  winnerCounts: WinnerCounts;
}

/**
 * Published results for the public page. Winner counts are aggregated server
 * side; no member identities leave this function.
 */
export async function listPublishedDraws(limit = 12): Promise<PublishedDrawSummary[]> {
  const admin = createSupabaseAdminClient();
  const { data: draws, error } = await admin
    .from("draws")
    .select("*")
    .eq("status", "published")
    .order("period_month", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load draws: ${error.message}`);
  if (!draws?.length) return [];

  const winners = await selectAll(
    (from, to) => admin.from("winners").select("draw_id, tier").in("draw_id", draws.map((draw) => draw.id)).order("id").range(from, to),
    "winners",
  );
  return draws.map((draw) => ({ ...draw, winnerCounts: tally(winners.filter((winner) => winner.draw_id === draw.id)) }));
}

export interface MemberDrawEntry extends DrawEntryRow {
  draw: Pick<DrawRow, "period_month" | "numbers" | "mode">;
}

/** A member's own entries, visible only once each draw is published (RLS). */
export async function listMemberEntries(userId: string): Promise<MemberDrawEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data: entries, error } = await supabase
    .from("draw_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load your entries: ${error.message}`);
  if (!entries?.length) return [];

  const { data: draws, error: drawError } = await supabase
    .from("draws")
    .select("id, period_month, numbers, mode")
    .in("id", entries.map((entry) => entry.draw_id));
  if (drawError) throw new Error(`Could not load draws: ${drawError.message}`);
  const byId = new Map((draws ?? []).map((draw) => [draw.id, draw]));

  return entries
    .filter((entry) => byId.has(entry.draw_id))
    .map((entry) => ({ ...entry, draw: byId.get(entry.draw_id)! }))
    .sort((a, b) => b.draw.period_month.localeCompare(a.draw.period_month));
}
