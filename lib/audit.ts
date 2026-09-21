import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/**
 * Append to the audit trail. Failures throw: an action that must be auditable
 * but was not recorded should surface, not pass silently.
 */
export async function recordAudit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta?: { [key: string]: Json };
}): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    meta: entry.meta ?? {},
  });
  if (error) throw new Error(`Could not write audit record: ${error.message}`);
}
