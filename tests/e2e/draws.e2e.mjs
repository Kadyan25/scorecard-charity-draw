// End-to-end check of PRD sections 06 and 07 (draw and prize pool).
//
// The draw is random, so this does not assert who wins. It builds its own
// members — eligible, short of scores, and lapsed — runs real simulations and a
// real publish through the admin API, then checks every invariant on the stored
// result. Uses far-future months and removes everything it created.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { client, createChecker, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("draws");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MONTH = "2099-01";
const NEXT_MONTH = "2099-02";
const PASSWORD = randomBytes(12).toString("base64url");
const created = [];

async function makeMember(label, { scores, active }) {
  const email = `e2e-draw-${label}@digitalheroes.test`;
  const existing = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
  if (existing) await service.auth.admin.deleteUser(existing.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  created.push(id);

  const { data: plan } = await service.from("plans").select("id").eq("code", "monthly").single();
  const end = new Date(Date.now() + (active ? 30 : -3) * 86_400_000).toISOString();
  await service.from("subscriptions").insert({ user_id: id, plan_id: plan.id, status: active ? "active" : "canceled", current_period_end: end });
  const rows = scores.map((value, i) => ({ user_id: id, value, played_on: new Date(Date.now() - (i + 1) * 86_400_000).toISOString().slice(0, 10) }));
  if (rows.length) await service.from("scores").insert(rows);
  return { id, email };
}

async function drawsFor(month) {
  const { data } = await service.from("draws").select("*").eq("period_month", `${month}-01`);
  return data ?? [];
}

async function cleanup() {
  for (const month of [MONTH, NEXT_MONTH]) {
    const ids = (await drawsFor(month)).map((draw) => draw.id);
    if (ids.length) {
      await service.from("audit_log").delete().in("entity_id", ids);
      await service.from("draws").delete().in("id", ids);
    }
  }
  for (const id of created) await service.auth.admin.deleteUser(id);
}

try {
  const eligible = [];
  const tickets = [[3, 9, 17, 28, 36], [5, 5, 12, 30, 41], [1, 2, 3, 4, 5], [40, 41, 42, 43, 44], [10, 20, 30, 40, 45], [7, 14, 21, 28, 35]];
  for (const [i, scores] of tickets.entries()) eligible.push(await makeMember(`in-${i}`, { scores, active: true }));
  const short = await makeMember("short", { scores: [1, 2, 3, 4], active: true });
  const lapsed = await makeMember("lapsed", { scores: [1, 2, 3, 4, 5], active: false });

  const admin = client(await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD));
  const member = client(await login(env.SEED_USER_EMAIL, env.SEED_USER_PASSWORD));

  // Access control and validation
  check("non-admin cannot simulate (403)", (await member("POST", "/api/draws/simulate", { month: MONTH, mode: "random" })).status === 403);
  check("signed-out cannot simulate (401)", (await client("")("POST", "/api/draws/simulate", { month: MONTH, mode: "random" })).status === 401);
  check("malformed month refused (400)", (await admin("POST", "/api/draws/simulate", { month: "2099-13", mode: "random" })).status === 400);
  check("unknown mode refused (400)", (await admin("POST", "/api/draws/simulate", { month: MONTH, mode: "psychic" })).status === 400);

  // Simulation
  const first = await admin("POST", "/api/draws/simulate", { month: MONTH, mode: "random" });
  check("simulation created (201)", first.status === 201, JSON.stringify(first.body));
  const second = await admin("POST", "/api/draws/simulate", { month: MONTH, mode: "random" });
  const drafts = await drawsFor(MONTH);
  check("re-simulating replaces the previous simulation", drafts.length === 1 && drafts[0].id === second.body.drawId && drafts[0].status === "simulated");

  const draw = drafts[0];
  const { data: entries } = await service.from("draw_entries").select("*").eq("draw_id", draw.id);
  const byUser = new Map(entries.map((entry) => [entry.user_id, entry]));
  check("five distinct numbers within 1-45", draw.numbers.length === 5 && new Set(draw.numbers).size === 5 && draw.numbers.every((n) => n >= 1 && n <= 45), draw.numbers);
  check("every eligible fixture member entered", eligible.every((m) => byUser.has(m.id)));
  check("member with four scores excluded", !byUser.has(short.id));
  check("lapsed member excluded", !byUser.has(lapsed.id));
  check("entry count recorded on the draw", draw.eligible_entry_count === entries.length);
  check("entries snapshot the member's scores", tickets.every((t, i) => [...byUser.get(eligible[i].id).numbers].sort((a, b) => a - b).join() === [...t].sort((a, b) => a - b).join()));

  const drawn = new Set(draw.numbers);
  const matchesOk = entries.every((e) => e.matched_count === new Set(e.numbers.filter((n) => drawn.has(n))).size);
  check("matched counts use distinct values", matchesOk);
  const tierOk = entries.every((e) => e.tier === (e.matched_count >= 3 ? e.matched_count : null));
  check("tiers follow matches (3, 4, 5 only)", tierOk);
  const pools = { 5: draw.tier5_pool_cents, 4: draw.tier4_pool_cents, 3: draw.tier3_pool_cents };
  const counts = { 5: 0, 4: 0, 3: 0 };
  for (const e of entries) if (e.tier) counts[e.tier] += 1;
  check("prizes split each tier equally", entries.every((e) => e.prize_cents === (e.tier ? Math.floor(pools[e.tier] / counts[e.tier]) : 0)));
  const paid = entries.reduce((sum, e) => sum + e.prize_cents, 0);
  check("pool reconciles: paid + rollover + charity = total", paid + draw.rollover_out_cents + draw.charity_bonus_cents === draw.pool_total_cents, { paid, draw });
  check("tier pools sum to the total", pools[5] + pools[4] + pools[3] === draw.pool_total_cents);

  // Members cannot see an unpublished simulation (RLS, via a real member session)
  const asMember = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await asMember.auth.signInWithPassword({ email: eligible[0].email, password: PASSWORD });
  const hidden = await asMember.from("draw_entries").select("id").eq("draw_id", draw.id);
  check("simulation hidden from members before publish", (hidden.data ?? []).length === 0);
  check("simulation absent from public results", !(await page("/draws")).html.includes("January 2099"));

  // Publish
  check("non-admin cannot publish (403)", (await member("POST", "/api/draws/publish", { drawId: draw.id })).status === 403);
  const published = await admin("POST", "/api/draws/publish", { drawId: draw.id });
  check("publish succeeds", published.status === 200, JSON.stringify(published.body));
  const { data: winners } = await service.from("winners").select("*").eq("draw_id", draw.id);
  check("a winner row for every prize-winning entry", winners.length === entries.filter((e) => e.tier).length);
  check("publishing twice is refused (409)", (await admin("POST", "/api/draws/publish", { drawId: draw.id })).status === 409);
  check("re-drawing a published month is refused (409)", (await admin("POST", "/api/draws/simulate", { month: MONTH, mode: "random" })).status === 409);
  check("drawing an earlier month is refused (409)", (await admin("POST", "/api/draws/simulate", { month: "2098-12", mode: "random" })).status === 409);

  const visible = await asMember.from("draw_entries").select("id").eq("draw_id", draw.id);
  check("member sees their own entry once published", (visible.data ?? []).length === 1);
  check("published draw appears in public results", (await page("/draws")).html.includes("January 2099"));

  // Algorithmic mode and rollover chaining
  const algo = await admin("POST", "/api/draws/simulate", { month: NEXT_MONTH, mode: "algorithmic" });
  const [nextDraw] = await drawsFor(NEXT_MONTH);
  check("algorithmic simulation created", algo.status === 201 && nextDraw?.mode === "algorithmic");
  check("next month rolls in the previous rollover", nextDraw?.rollover_in_cents === draw.rollover_out_cents, { in: nextDraw?.rollover_in_cents, out: draw.rollover_out_cents });
} catch (error) {
  check("suite ran without throwing", false, error?.message ?? error);
} finally {
  await cleanup();
}

process.exitCode = done() === 0 ? 0 : 1;
