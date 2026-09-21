import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import {
  pickGoverningSubscription,
  resolveAccess,
  type Access,
} from "@/services/subscription";

/**
 * Route guards. Every protected page and route handler goes through one of
 * these, and each re-reads state from the database — role and subscription
 * status are never taken from anything the client sent.
 */

export interface Viewer {
  userId: string;
  email: string;
  profile: ProfileRow;
}

export interface Subscriber extends Viewer {
  access: Access;
}

async function loadViewer(): Promise<Viewer | null> {
  const supabase = await createSupabaseServerClient();
  // getUser() revalidates the JWT with Supabase Auth; getSession() would trust
  // the cookie as-is, which is not safe for authorization decisions.
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile missing for authenticated user ${auth.user.id}`);
  }

  return { userId: auth.user.id, email: auth.user.email ?? profile.email, profile };
}

export async function loadAccess(userId: string): Promise<Access> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, created_at")
    .eq("user_id", userId);

  if (error) throw new Error(`Could not load subscription: ${error.message}`);

  const governing = pickGoverningSubscription(
    (data ?? []).map((row) => ({
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at,
    })),
  );
  return resolveAccess(governing);
}

/** Signed-in user, or null. For pages that render differently when signed in. */
export async function getViewer(): Promise<Viewer | null> {
  return loadViewer();
}

export async function requireUser(): Promise<Viewer> {
  const viewer = await loadViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Signed in, with access state attached. Does not redirect non-subscribers. */
export async function requireSubscriberContext(): Promise<Subscriber> {
  const viewer = await requireUser();
  return { ...viewer, access: await loadAccess(viewer.userId) };
}

/** Signed in AND holding a live subscription. */
export async function requireSubscriber(): Promise<Subscriber> {
  const subscriber = await requireSubscriberContext();
  if (!subscriber.access.hasAccess) redirect("/subscribe");
  return subscriber;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireUser();
  if (viewer.profile.role !== "admin") redirect("/dashboard");
  return viewer;
}
