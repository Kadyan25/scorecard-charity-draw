import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CharityEventRow, CharityRow } from "@/lib/supabase/types";

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
