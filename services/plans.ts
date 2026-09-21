import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanRow } from "@/lib/supabase/types";

export async function listActivePlans(): Promise<PlanRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Could not load plans: ${error.message}`);
  return data ?? [];
}

export function monthlyPlan(plans: readonly PlanRow[]): PlanRow | undefined {
  return plans.find((plan) => plan.interval === "month");
}
