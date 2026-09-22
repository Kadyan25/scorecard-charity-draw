import "server-only";

import { HttpError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PasswordChangeInput, ProfileUpdateInput, SignUpInput } from "@/lib/validation";
import { loadSettings, validateCharityPercent } from "@/services/settings";

async function assertCharityAvailable(charityId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("charities")
    .select("id")
    .eq("id", charityId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Could not verify charity: ${error.message}`);
  if (!data) throw new HttpError(400, "That charity is not currently accepting support.");
}

/**
 * Register a subscriber with their charity choice in one step.
 *
 * The charity is written with the service-role client against the id Supabase
 * Auth just returned — never an id from the request — because when email
 * confirmation is enabled there is no session yet to write under.
 */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }> {
  const supabase = await createSupabaseServerClient();

  const settings = await loadSettings(supabase);
  const percentError = validateCharityPercent(input.charityPercent, settings);
  if (percentError) throw new HttpError(400, percentError);
  await assertCharityAvailable(input.charityId);

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });
  if (error) throw new HttpError(400, error.message);
  if (!data.user) throw new Error("Sign-up returned no user");

  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ charity_id: input.charityId, charity_percent: input.charityPercent })
    .eq("id", data.user.id);
  if (profileError) throw new Error(`Could not save charity choice: ${profileError.message}`);

  return { needsConfirmation: data.session === null };
}

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Deliberately vague: distinguishing "no such user" from "wrong password"
  // would let anyone enumerate registered emails.
  if (error) throw new HttpError(401, "That email and password combination didn't work.");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Sign-out failed: ${error.message}`);
}

/** A member's own display name. Other profile columns are not writable by them. */
export async function updateMyProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName })
    .eq("id", userId);
  if (error) throw new Error(`Could not save your profile: ${error.message}`);
}

/**
 * Change password, re-checking the current one first. Supabase would accept the
 * update on the session alone, which would let anyone who found an unlocked tab
 * lock the owner out of their own account.
 */
export async function changeMyPassword(input: PasswordChangeInput): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) throw new HttpError(401, "Please sign in again.");

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (reauthError) throw new HttpError(400, "That current password didn't match.");

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) throw new HttpError(400, error.message);
}
