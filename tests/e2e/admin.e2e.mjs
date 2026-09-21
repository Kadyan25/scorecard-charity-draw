// End-to-end check of PRD section 11 (admin dashboard): user management,
// charity management with media and events, settings, reports and access
// control. Builds its own fixtures and restores everything it touches.
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { BASE, client, createChecker, day, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("admin");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const PASSWORD = randomBytes(12).toString("base64url");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(7)]);
const state = { users: [], charityId: null, customer: null, settings: null };

async function makeMember(label) {
  const email = `e2e-admin-${label}@digitalheroes.test`;
  const existing = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
  if (existing) await service.auth.admin.deleteUser(existing.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Admin Fixture ${label}` } });
  if (error) throw error;
  state.users.push(data.user.id);
  const cookie = await login(email, PASSWORD);
  return { id: data.user.id, email, cookie, api: client(cookie) };
}

const waitFor = async (probe, ms = 45_000) => {
  for (const start = Date.now(); Date.now() - start < ms; await new Promise((r) => setTimeout(r, 1000))) {
    const value = await probe();
    if (value) return value;
  }
  throw new Error("timed out");
};
const scoresOf = async (id) => (await service.from("scores").select("*").eq("user_id", id).order("played_on", { ascending: false })).data ?? [];
const latestSub = async (id) => (await service.from("subscriptions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
const canScore = async (api) => {
  const res = await api("POST", "/api/scores", { value: 11, playedOn: day(-40) });
  if (res.status === 201) await api("DELETE", `/api/scores/${res.body.score.id}`);
  return res.status;
};

async function accessControl(member, admin) {
  const probes = [
    ["PATCH", `/api/admin/users/${member.id}`, { fullName: "X", charityId: member.id, charityPercent: 20 }],
    ["POST", `/api/admin/users/${member.id}/scores`, { value: 20, playedOn: day(-1) }],
    ["POST", `/api/admin/users/${member.id}/subscription`, { action: "grant_comp" }],
    ["POST", "/api/admin/charities", { name: "Nope", category: "General" }],
    ["PATCH", "/api/admin/settings", { prizePoolPercent: 30, charityPercentMin: 10, charityPercentMax: 50, tierSplit: { 5: 40, 4: 35, 3: 25 } }],
  ];
  for (const [method, path, body] of probes) {
    check(`member refused on ${method} ${path.replace(member.id, ":id")}`, (await member.api(method, path, body)).status === 403);
  }
  for (const path of ["/admin", "/admin/users", `/admin/users/${member.id}`, "/admin/charities", "/admin/charities/new", "/admin/reports", "/admin/settings"]) {
    const res = await page(path, admin.cookie);
    check(`admin page ${path.replace(member.id, ":id")} renders`, res.status === 200 && !res.html.includes("Something went wrong"), res.status);
  }
  check("member sent away from admin pages", (await page("/admin/users", member.cookie)).status === 307);
  const rpc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await rpc.auth.signInWithPassword({ email: member.email, password: PASSWORD });
  check("members cannot call admin_report directly", (await rpc.rpc("admin_report")).error !== null);
}

async function userManagement(member, admin, greenfield) {
  check("member found by search", (await page("/admin/users?q=e2e-admin-member", admin.cookie)).html.includes(member.email));
  check("profile edit below 10% refused", (await admin.api("PATCH", `/api/admin/users/${member.id}`, { fullName: "Renamed Member", charityId: greenfield, charityPercent: 5 })).status === 400);
  check("profile edit saved", (await admin.api("PATCH", `/api/admin/users/${member.id}`, { fullName: "Renamed Member", charityId: greenfield, charityPercent: 25 })).status === 200);
  const { data: profile } = await service.from("profiles").select("*").eq("id", member.id).single();
  check("profile change persisted", profile.full_name === "Renamed Member" && profile.charity_percent === 25);

  for (const [value, offset] of [[10, -20], [11, -16], [12, -12], [13, -8], [14, -4]]) {
    await admin.api("POST", `/api/admin/users/${member.id}/scores`, { value, playedOn: day(offset) });
  }
  check("admin adds five scores", (await scoresOf(member.id)).length === 5);
  check("admin's sixth score evicts the oldest", (await admin.api("POST", `/api/admin/users/${member.id}/scores`, { value: 15, playedOn: day(-1) })).status === 201 && !(await scoresOf(member.id)).some((s) => s.value === 10));
  check("admin duplicate date refused (409)", (await admin.api("POST", `/api/admin/users/${member.id}/scores`, { value: 16, playedOn: day(-1) })).status === 409);
  const [newest] = await scoresOf(member.id);
  check("admin edits a member's score", (await admin.api("PATCH", `/api/admin/scores/${newest.id}`, { value: 44 })).status === 200 && (await scoresOf(member.id))[0].value === 44);
  check("admin deletes a member's score", (await admin.api("DELETE", `/api/admin/scores/${newest.id}`)).status === 200 && (await scoresOf(member.id)).length === 4);
  const { data: audit } = await service.from("audit_log").select("action").eq("entity_id", member.id);
  check("admin edits are audited", ["member.profile_updated", "score.added_by_admin", "score.edited_by_admin", "score.deleted_by_admin"].every((a) => audit.some((row) => row.action === a)));
}

async function subscriptionManagement(member, admin) {
  check("member without a plan cannot score (402)", (await canScore(member.api)) === 402);
  check("ending comp access before it exists refused (409)", (await admin.api("POST", `/api/admin/users/${member.id}/subscription`, { action: "end_comp" })).status === 409);
  check("admin grants complimentary access", (await admin.api("POST", `/api/admin/users/${member.id}/subscription`, { action: "grant_comp" })).status === 200);
  check("complimentary member can score", (await canScore(member.api)) === 201);
  check("Stripe-only action refused for comp access (409)", (await admin.api("POST", `/api/admin/users/${member.id}/subscription`, { action: "cancel_now" })).status === 409);
  check("admin ends complimentary access", (await admin.api("POST", `/api/admin/users/${member.id}/subscription`, { action: "end_comp" })).status === 200);
  check("access removed after ending comp (402)", (await canScore(member.api)) === 402);

  if (!stripe) return check("Stripe configured for subscription actions", false);
  const customer = await stripe.customers.create({ email: member.email, metadata: { user_id: member.id } });
  state.customer = customer.id;
  await service.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", member.id);
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  const { data: plan } = await service.from("plans").select("stripe_price_id").eq("code", "monthly").single();
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: plan.stripe_price_id }] });
  await waitFor(async () => (await latestSub(member.id))?.stripe_subscription_id === sub.id && (await latestSub(member.id)).status === "active");

  const act = (action) => admin.api("POST", `/api/admin/users/${member.id}/subscription`, { action });
  check("admin schedules a Stripe cancellation", (await act("cancel_at_period_end")).status === 200 && (await latestSub(member.id)).cancel_at_period_end === true);
  check("Stripe agrees it will cancel", (await stripe.subscriptions.retrieve(sub.id)).cancel_at_period_end === true);
  check("admin resumes renewal", (await act("resume")).status === 200 && (await latestSub(member.id)).cancel_at_period_end === false);
  check("admin cancels immediately", (await act("cancel_now")).status === 200 && (await latestSub(member.id)).status === "canceled");
  check("cancelled member loses access (402)", (await canScore(member.api)) === 402);
}

async function charityManagement(admin, member) {
  const created = await admin.api("POST", "/api/admin/charities", { name: "E2E Test Charity", category: "Testing", tagline: "Made by the admin suite", description: "Temporary.", isActive: true, isFeatured: false });
  state.charityId = created.body?.id;
  const { data: row } = await service.from("charities").select("*").eq("id", state.charityId).single();
  check("charity created with an automatic slug", created.status === 201 && row.slug === "e2e-test-charity");
  check("duplicate slug refused (409)", (await admin.api("POST", "/api/admin/charities", { name: "E2E Test Charity", category: "Testing" })).status === 409);
  check("invalid website refused (400)", (await admin.api("PATCH", `/api/admin/charities/${state.charityId}`, { name: "E2E Test Charity", category: "Testing", websiteUrl: "not a url" })).status === 400);
  check("new charity listed publicly", (await page("/charities", "")).html.includes(">E2E Test Charity<"));

  const form = new FormData();
  form.set("image", new Blob([PNG], { type: "image/png" }), "cover.png");
  const upload = await fetch(`${BASE}/api/admin/charities/${state.charityId}/image`, { method: "POST", body: form, headers: { cookie: admin.cookie } });
  const { url } = await upload.json();
  check("cover photo uploaded", upload.status === 200 && url?.includes("/charity-media/"));
  check("cover photo publicly served", (await fetch(url)).headers.get("content-type")?.startsWith("image/png"));
  const bad = new FormData();
  bad.set("image", new Blob([new TextEncoder().encode("<svg onload=alert(1)>")], { type: "image/png" }), "x.png");
  check("non-image cover refused (400)", (await fetch(`${BASE}/api/admin/charities/${state.charityId}/image`, { method: "POST", body: bad, headers: { cookie: admin.cookie } })).status === 400);

  check("event with a bad date refused (400)", (await admin.api("POST", `/api/admin/charities/${state.charityId}/events`, { title: "Golf Day", eventDate: "soon" })).status === 400);
  check("event added", (await admin.api("POST", `/api/admin/charities/${state.charityId}/events`, { title: "E2E Golf Day", eventDate: day(30), location: "Test Links" })).status === 201);
  check("event shown on the public profile", (await page("/charities/e2e-test-charity")).html.includes("E2E Golf Day"));
  const { data: event } = await service.from("charity_events").select("id").eq("charity_id", state.charityId).single();
  check("event deleted", (await admin.api("DELETE", `/api/admin/charity-events/${event.id}`)).status === 200);

  await service.from("profiles").update({ charity_id: state.charityId }).eq("id", member.id);
  check("charity with supporters cannot be deleted (409)", (await admin.api("DELETE", `/api/admin/charities/${state.charityId}`)).status === 409);
  check("hiding a charity removes it from the directory", (await admin.api("PATCH", `/api/admin/charities/${state.charityId}`, { name: "E2E Test Charity", category: "Testing", isActive: false })).status === 200 && !(await page("/charities")).html.includes(">E2E Test Charity<"));
  check("report lists every charity", (await page("/admin/reports", admin.cookie)).html.includes("E2E Test Charity"));
  const { data: greenfield } = await service.from("charities").select("id").eq("slug", "greenfield-youth-trust").single();
  await service.from("profiles").update({ charity_id: greenfield.id }).eq("id", member.id);
  const deletedId = state.charityId;
  check("unsupported charity deleted", (await admin.api("DELETE", `/api/admin/charities/${deletedId}`)).status === 200);
  check("deleting a charity removes its photos", ((await service.storage.from("charity-media").list(deletedId)).data ?? []).length === 0);
  check("deleted charity's page is gone (404)", (await page("/charities/e2e-test-charity")).status === 404);
  state.charityId = null;
}

async function settings(admin, member) {
  const { data } = await service.from("settings").select("key, value");
  state.settings = data;
  const valid = { prizePoolPercent: 30, charityPercentMin: 10, charityPercentMax: 50, tierSplit: { 5: 40, 4: 35, 3: 25 } };
  check("tier split must total 100 (400)", (await admin.api("PATCH", "/api/admin/settings", { ...valid, tierSplit: { 5: 50, 4: 35, 3: 25 } })).status === 400);
  check("charity minimum below 10% refused (400)", (await admin.api("PATCH", "/api/admin/settings", { ...valid, charityPercentMin: 5 })).status === 400);
  await service.from("profiles").update({ charity_percent: 50 }).eq("id", member.id);
  const squeeze = await admin.api("PATCH", "/api/admin/settings", { ...valid, prizePoolPercent: 55, charityPercentMax: 45 });
  check("pool share that would break a member's split refused (409)", squeeze.status === 409, JSON.stringify(squeeze.body));
  await service.from("profiles").update({ charity_percent: 20 }).eq("id", member.id);
  check("valid settings saved", (await admin.api("PATCH", "/api/admin/settings", { ...valid, tierSplit: { 5: 45, 4: 35, 3: 20 } })).status === 200);
  const { data: split } = await service.from("settings").select("value").eq("key", "tier_split").single();
  check("new tier split stored", split.value["5"] === 45 && split.value["3"] === 20);
}

async function cleanup() {
  if (state.settings) for (const row of state.settings) await service.from("settings").update({ value: row.value }).eq("key", row.key);
  if (state.customer && stripe) await stripe.customers.del(state.customer).catch(() => {});
  if (state.charityId) {
    const { data } = await service.storage.from("charity-media").list(state.charityId);
    if (data?.length) await service.storage.from("charity-media").remove(data.map((f) => `${state.charityId}/${f.name}`));
    await service.from("charities").delete().eq("id", state.charityId);
  }
  const { data: leftovers } = await service.from("charities").select("id").eq("slug", "e2e-test-charity");
  for (const { id } of leftovers ?? []) {
    const { data } = await service.storage.from("charity-media").list(id);
    if (data?.length) await service.storage.from("charity-media").remove(data.map((f) => `${id}/${f.name}`));
  }
  await service.from("audit_log").delete().in("entity_id", state.users);
  for (const id of state.users) await service.auth.admin.deleteUser(id);
}

try {
  const member = await makeMember("member");
  const adminCookie = await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
  const admin = { cookie: adminCookie, api: client(adminCookie) };
  const { data: greenfield } = await service.from("charities").select("id").eq("slug", "greenfield-youth-trust").single();
  await service.from("profiles").update({ charity_id: greenfield.id }).eq("id", member.id);

  await accessControl(member, admin);
  await userManagement(member, admin, greenfield.id);
  await subscriptionManagement(member, admin);
  await charityManagement(admin, member);
  await settings(admin, member);
} catch (error) {
  check("suite ran without throwing", false, error?.message ?? error);
} finally {
  await cleanup();
}

process.exitCode = done() === 0 ? 0 : 1;
