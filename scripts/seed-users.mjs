// Creates (or refreshes) the admin and demo subscriber accounts.
//
//   node --env-file=.env.local scripts/seed-users.mjs
//
// Idempotent: safe to run repeatedly. Passwords come from the environment so
// no credential lives in source.

import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD",
  "SEED_USER_EMAIL",
  "SEED_USER_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function findUserByEmail(email) {
  // listUsers is paginated; demo datasets are small enough for one page.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email) ?? null;
}

async function ensureUser({ email, password, fullName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function featuredCharityId() {
  const { data, error } = await supabase
    .from("charities")
    .select("id")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const charityId = await featuredCharityId();

  const adminId = await ensureUser({
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    fullName: "Platform Admin",
  });
  const userId = await ensureUser({
    email: process.env.SEED_USER_EMAIL,
    password: process.env.SEED_USER_PASSWORD,
    fullName: "Demo Golfer",
  });

  const { error: adminError } = await supabase
    .from("profiles")
    .update({ role: "admin", charity_id: charityId, charity_percent: 10 })
    .eq("id", adminId);
  if (adminError) throw adminError;

  const { error: userError } = await supabase
    .from("profiles")
    .update({ charity_id: charityId, charity_percent: 15 })
    .eq("id", userId);
  if (userError) throw userError;

  console.info(`Admin ready: ${process.env.SEED_ADMIN_EMAIL}`);
  console.info(`Subscriber ready: ${process.env.SEED_USER_EMAIL}`);
}

main().catch((error) => {
  console.error("Seeding users failed:", error.message ?? error);
  process.exit(1);
});
