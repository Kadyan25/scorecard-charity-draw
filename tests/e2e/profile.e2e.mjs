// End-to-end check of a member managing their own profile and password.
//
//   npm run test:e2e
//
// Builds its own throwaway member so a password change can be exercised for
// real without touching the seeded demo account, then deletes it.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { client, createChecker, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("profile");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EMAIL = "e2e-profile@digitalheroes.test";
const PASSWORD = randomBytes(12).toString("base64url");
const NEXT_PASSWORD = randomBytes(12).toString("base64url");

const existing = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === EMAIL);
if (existing) await service.auth.admin.deleteUser(existing.id);
const { data: created, error: createError } = await service.auth.admin.createUser({
  email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Profile Fixture" },
});
if (createError) throw createError;
const userId = created.user.id;
const profileOf = async () => (await service.from("profiles").select("*").eq("id", userId).single()).data;

try {
  const cookie = await login(EMAIL, PASSWORD);
  const api = client(cookie);
  const visitor = client("");

  check("signed-out rename refused (401)", (await visitor("PATCH", "/api/profile", { fullName: "Anybody" })).status === 401);
  check("signed-out password change refused (401)", (await visitor("POST", "/api/profile/password", { currentPassword: PASSWORD, newPassword: NEXT_PASSWORD })).status === 401);

  check("one-character name refused (400)", (await api("PATCH", "/api/profile", { fullName: "A" })).status === 400);
  check("blank name refused (400)", (await api("PATCH", "/api/profile", { fullName: "   " })).status === 400);
  check("missing name refused (400)", (await api("PATCH", "/api/profile", {})).status === 400);

  const renamed = await api("PATCH", "/api/profile", { fullName: "  Renamed Member  " });
  check("rename accepted", renamed.status === 200, JSON.stringify(renamed.body));
  check("name persisted and trimmed", (await profileOf()).full_name === "Renamed Member");

  // The schema strips unknown keys and the column grant blocks the write even
  // if it did not, so neither role nor contribution can ride along on a rename.
  await api("PATCH", "/api/profile", { fullName: "Still A Member", role: "admin", charity_percent: 90 });
  const after = await profileOf();
  check("role cannot be escalated through the profile route", after.role === "user", after.role);
  check("contribution cannot be rewritten through it either", after.charity_percent !== 90, after.charity_percent);

  const rendered = await page("/dashboard/profile", cookie);
  check("profile page renders", rendered.status === 200);
  check("it shows the current name and email", rendered.html.includes("Still A Member") && rendered.html.includes(EMAIL));

  check("wrong current password refused (400)",
    (await api("POST", "/api/profile/password", { currentPassword: "not-the-password", newPassword: NEXT_PASSWORD })).status === 400);
  check("short new password refused (400)",
    (await api("POST", "/api/profile/password", { currentPassword: PASSWORD, newPassword: "short" })).status === 400);

  const changed = await api("POST", "/api/profile/password", { currentPassword: PASSWORD, newPassword: NEXT_PASSWORD });
  check("password change accepted", changed.status === 200, JSON.stringify(changed.body));

  let newWorks = true;
  try { await login(EMAIL, NEXT_PASSWORD); } catch { newWorks = false; }
  check("the new password signs in", newWorks);

  let oldWorks = true;
  try { await login(EMAIL, PASSWORD); } catch { oldWorks = false; }
  check("the old password no longer signs in", !oldWorks);
} finally {
  await service.auth.admin.deleteUser(userId);
}

check("suite ran without throwing", true);
process.exit(done());
