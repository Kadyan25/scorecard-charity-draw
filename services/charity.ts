import "server-only";

import { HttpError } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CharityEventRow, CharityRow } from "@/lib/supabase/types";
import type { CharitySelection } from "@/lib/validation";
import { normaliseCategory, sanitizeSearchTerm } from "@/services/charity-rules";
import { loadSettings, validateCharityPercent } from "@/services/settings";

export interface CharityImpact {
  supporters: number;
  raisedCents: number;
}

export async function listActiveCharities(): Promise<CharityRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("charities")
    .select("*")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("name");
  if (error) throw new Error(`Could not load charities: ${error.message}`);
  return data ?? [];
}

export async function listCategories(): Promise<string[]> {
  const charities = await listActiveCharities();
  return [...new Set(charities.map((charity) => charity.category))].sort();
}

/** Directory search (PRD section 08.2). Filtering happens in the database. */
export async function searchCharities(filters: {
  q?: string;
  category?: string;
}): Promise<{ charities: CharityRow[]; categories: string[]; category: string | null; q: string }> {
  const categories = await listCategories();
  const q = sanitizeSearchTerm(filters.q);
  const category = normaliseCategory(filters.category, categories);

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("charities").select("*").eq("is_active", true);
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error } = await query.order("is_featured", { ascending: false }).order("name");
  if (error) throw new Error(`Charity search failed: ${error.message}`);
  return { charities: data ?? [], categories, category, q };
}

export async function getCharityBySlug(slug: string): Promise<CharityRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("charities")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load charity: ${error.message}`);
  return data;
}

export async function getFeaturedCharity(): Promise<CharityRow | null> {
  const charities = await listActiveCharities();
  return charities.find((charity) => charity.is_featured) ?? charities[0] ?? null;
}

export async function listUpcomingEvents(charityId: string): Promise<CharityEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("charity_events")
    .select("*")
    .eq("charity_id", charityId)
    .gte("event_date", today)
    .order("event_date");
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return data ?? [];
}

/** Aggregate totals per charity — safe for anonymous visitors (migration 0005). */
export async function loadImpact(): Promise<Map<string, CharityImpact>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("charity_impact");
  if (error) throw new Error(`Could not load charity impact: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [
      row.charity_id,
      { supporters: row.supporters, raisedCents: Number(row.raised_cents) },
    ]),
  );
}

/**
 * Change the member's charity or contribution. Takes effect from the next
 * payment: past payments keep the charity they were snapshotted with.
 */
export async function updateMyCharity(userId: string, input: CharitySelection): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const settings = await loadSettings(supabase);
  const percentError = validateCharityPercent(input.charityPercent, settings);
  if (percentError) throw new HttpError(400, percentError);

  const { data: charity, error: charityError } = await supabase
    .from("charities")
    .select("id")
    .eq("id", input.charityId)
    .eq("is_active", true)
    .maybeSingle();
  if (charityError) throw new Error(`Could not verify charity: ${charityError.message}`);
  if (!charity) throw new HttpError(400, "That charity is not currently accepting support.");

  const { error } = await supabase
    .from("profiles")
    .update({ charity_id: input.charityId, charity_percent: input.charityPercent })
    .eq("id", userId);
  if (error) throw new Error(`Could not save your charity: ${error.message}`);
}

/** What this member has sent to charity so far, through subscriptions and gifts. */
export async function memberGivingTotals(userId: string): Promise<{ viaSubscriptionCents: number; viaDonationsCents: number }> {
  const supabase = await createSupabaseServerClient();
  const [payments, donations] = await Promise.all([
    supabase.from("payments").select("charity_amount_cents").eq("user_id", userId).eq("status", "succeeded"),
    supabase.from("donations").select("amount_cents").eq("user_id", userId).eq("status", "succeeded"),
  ]);
  if (payments.error) throw new Error(`Could not load payments: ${payments.error.message}`);
  if (donations.error) throw new Error(`Could not load donations: ${donations.error.message}`);

  return {
    viaSubscriptionCents: (payments.data ?? []).reduce((sum, row) => sum + row.charity_amount_cents, 0),
    viaDonationsCents: (donations.data ?? []).reduce((sum, row) => sum + row.amount_cents, 0),
  };
}
