// Demo data so the deployed site tells its whole story on arrival.
//
//   node --env-file=.env.local scripts/seed-demo.mjs
//
// Creates demo members with subscriptions, scores and payments, two published
// draws (the first with an unclaimed jackpot that rolls into the second), and
// winners covering every verification state. Idempotent: it removes what it
// created before recreating it.
//
// Prize arithmetic mirrors services/prize.ts; the script asserts the split
// reconciles to the penny, so any drift shows up immediately.

import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SEED_USER_EMAIL", "DEMO_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD;
const DRAWN = [7, 12, 23, 31, 44];

const monthStart = (offset) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
};
const LAST_MONTH = monthStart(-1);
const TWO_MONTHS_AGO = monthStart(-2);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const dateAgo = (n) => daysAgo(n).slice(0, 10);

/** name, email suffix, scores, plan, charity %, and how their prize is handled. */
const MEMBERS = [
  { name: "Alice Nkemdirim", key: "alice", scores: [7, 12, 23, 31, 44], plan: "monthly", percent: 25, outcome: "paid" },
  { name: "Ben Okafor", key: "ben", scores: [7, 12, 23, 31, 5], plan: "monthly", percent: 10, outcome: "pending" },
  { name: "Cara Whitfield", key: "cara", scores: [7, 12, 23, 40, 41], plan: "yearly", percent: 15, outcome: "rejected" },
  { name: "Dan Merrill", key: "dan", scores: [7, 12, 23, 38, 39], plan: "monthly", percent: 10, outcome: "approved" },
  { name: "Eve Sandoval", key: "eve", scores: [1, 2, 3, 4, 5], plan: "monthly", percent: 50 },
  { name: "Fay Rutherford", key: "fay", scores: [7, 40, 41, 42, 43], plan: "monthly", percent: 10 },
  { name: "Gus Lindqvist", key: "gus", scores: [12, 23, 44, 2, 3], plan: "yearly", percent: 20, outcome: "unsubmitted" },
];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABGCAYAAABuKq6OAAAAQUlEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvwZ0GAABYtxsjQAAAABJRU5ErkJggg==",
  "base64",
);

const distinctMatches = (numbers) => new Set(numbers.filter((n) => DRAWN.includes(n))).size;
const tierOf = (matches) => (matches >= 3 ? matches : null);
const percentOf = (amount, percent) => Math.round((amount * percent) / 100);

async function reset() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users.users.filter((u) => u.email?.startsWith("demo-"))) {
    await db.auth.admin.deleteUser(user.id);
  }
  const { data: draws } = await db.from("draws").select("id").in("period_month", [LAST_MONTH, TWO_MONTHS_AGO]);
  for (const draw of draws ?? []) {
    await db.from("audit_log").delete().eq("entity_id", draw.id);
    await db.from("draws").delete().eq("id", draw.id);
  }
  await db.from("donations").delete().like("stripe_payment_intent_id", "pi_demo_%");
}

async function createMembers(charities, plans) {
  const created = [];
  for (const [index, member] of MEMBERS.entries()) {
    const email = `demo-${member.key}@digitalheroes.test`;
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: member.name } });
    if (error) throw new Error(`${email}: ${error.message}`);
    const charity = charities[index % charities.length];
    const plan = plans.find((p) => p.code === member.plan);
    await db.from("profiles").update({ charity_id: charity.id, charity_percent: member.percent }).eq("id", data.user.id);
    await db.from("subscriptions").insert({
      user_id: data.user.id,
      plan_id: plan.id,
      status: "active",
      current_period_start: daysAgo(20),
      current_period_end: new Date(Date.now() + (plan.interval === "year" ? 345 : 10) * 86_400_000).toISOString(),
    });
    await db.from("scores").insert(member.scores.map((value, i) => ({ user_id: data.user.id, value, played_on: dateAgo(3 + i * 4) })));
    await db.from("payments").insert({
      user_id: data.user.id,
      amount_cents: plan.amount_cents,
      currency: plan.currency,
      status: "succeeded",
      paid_at: daysAgo(20),
      charity_id_snapshot: charity.id,
      charity_percent_snapshot: member.percent,
      charity_amount_cents: percentOf(plan.amount_cents, member.percent),
      prize_pool_amount_cents: percentOf(plan.amount_cents, 30),
      platform_amount_cents: plan.amount_cents - percentOf(plan.amount_cents, member.percent) - percentOf(plan.amount_cents, 30),
    });
    created.push({ ...member, id: data.user.id, email });
  }
  return created;
}

const DEMO_GOLFER_SCORES = [7, 12, 31, 44, 20];

/**
 * The account evaluators sign in as. It already exists (db:seed-users), so it
 * is given the same footing as the demo members: a plan, five scores and a
 * payment — otherwise its dashboard would be empty on a fresh database.
 */
async function equipDemoGolfer(userId, charity, plans) {
  const plan = plans.find((p) => p.code === "monthly");
  await db.from("subscriptions").delete().eq("user_id", userId);
  await db.from("scores").delete().eq("user_id", userId);
  await db.from("payments").delete().eq("user_id", userId).is("stripe_invoice_id", null);

  await db.from("profiles").update({ charity_id: charity.id, charity_percent: 15 }).eq("id", userId);
  await db.from("subscriptions").insert({
    user_id: userId, plan_id: plan.id, status: "active",
    current_period_start: daysAgo(20), current_period_end: new Date(Date.now() + 10 * 86_400_000).toISOString(),
  });
  await db.from("scores").insert(DEMO_GOLFER_SCORES.map((value, i) => ({ user_id: userId, value, played_on: dateAgo(2 + i * 5) })));
  await db.from("payments").insert({
    user_id: userId, amount_cents: plan.amount_cents, currency: plan.currency, status: "succeeded", paid_at: daysAgo(20),
    charity_id_snapshot: charity.id, charity_percent_snapshot: 15,
    charity_amount_cents: percentOf(plan.amount_cents, 15),
    prize_pool_amount_cents: percentOf(plan.amount_cents, 30),
    platform_amount_cents: plan.amount_cents - percentOf(plan.amount_cents, 15) - percentOf(plan.amount_cents, 30),
  });
}

/** Contribution accrual, matching services/draw-engine.ts (yearly counts as 1/12). */
function accrue(members, plans) {
  const numerator = members.reduce((sum, member) => {
    const plan = plans.find((p) => p.code === member.plan);
    return sum + plan.amount_cents * 30 * (plan.interval === "year" ? 1 : 12);
  }, 0);
  return Math.floor(numerator / 1200);
}

async function publishEmptyDraw(contribution) {
  const tier5 = percentOf(contribution, 40);
  const tier4 = percentOf(contribution, 35);
  const tier3 = contribution - tier5 - tier4;
  // Nobody entered: the jackpot rolls on, the other tiers go to charity.
  const { data, error } = await db.from("draws").insert({
    period_month: TWO_MONTHS_AGO, mode: "random", status: "published", numbers: [3, 18, 26, 33, 41],
    pool_total_cents: contribution, rollover_in_cents: 0, rollover_out_cents: tier5, charity_bonus_cents: tier4 + tier3,
    tier5_pool_cents: tier5, tier4_pool_cents: tier4, tier3_pool_cents: tier3, eligible_entry_count: 0,
    published_at: daysAgo(40),
  }).select("id, rollover_out_cents").single();
  if (error) throw new Error(`first draw: ${error.message}`);
  return data;
}

async function publishMainDraw(members, contribution, rolloverIn, demoUserId) {
  const pool = contribution + rolloverIn;
  const pools = { 5: percentOf(pool, 40), 4: percentOf(pool, 35) };
  pools[3] = pool - pools[5] - pools[4];

  const entrants = [...members, { id: demoUserId, key: "demo", scores: DEMO_GOLFER_SCORES, outcome: "unsubmitted" }];
  const scored = entrants.map((m) => ({ ...m, matches: distinctMatches(m.scores), tier: tierOf(distinctMatches(m.scores)) }));
  const counts = { 5: 0, 4: 0, 3: 0 };
  for (const entry of scored) if (entry.tier) counts[entry.tier] += 1;

  let rolloverOut = 0;
  let charityBonus = 0;
  const share = {};
  for (const tier of [5, 4, 3]) {
    if (counts[tier] === 0) {
      if (tier === 5) rolloverOut += pools[tier];
      else charityBonus += pools[tier];
      share[tier] = 0;
      continue;
    }
    share[tier] = Math.floor(pools[tier] / counts[tier]);
    rolloverOut += pools[tier] - share[tier] * counts[tier];
  }
  const paid = scored.reduce((sum, e) => sum + (e.tier ? share[e.tier] : 0), 0);
  if (paid + rolloverOut + charityBonus !== pool) {
    throw new Error(`Demo draw does not reconcile: ${paid} + ${rolloverOut} + ${charityBonus} != ${pool}`);
  }

  const { data: draw, error } = await db.from("draws").insert({
    period_month: LAST_MONTH, mode: "algorithmic", status: "published", numbers: DRAWN,
    pool_total_cents: pool, rollover_in_cents: rolloverIn, rollover_out_cents: rolloverOut, charity_bonus_cents: charityBonus,
    tier5_pool_cents: pools[5], tier4_pool_cents: pools[4], tier3_pool_cents: pools[3],
    eligible_entry_count: scored.length, published_at: daysAgo(8),
  }).select("id").single();
  if (error) throw new Error(`main draw: ${error.message}`);

  const { data: entries, error: entryError } = await db.from("draw_entries").insert(
    scored.map((e) => ({ draw_id: draw.id, user_id: e.id, numbers: e.scores, matched_count: e.matches, tier: e.tier, prize_cents: e.tier ? share[e.tier] : 0 })),
  ).select("id, user_id, tier, prize_cents");
  if (entryError) throw new Error(`entries: ${entryError.message}`);

  for (const entry of entries.filter((e) => e.tier !== null)) {
    const member = scored.find((m) => m.id === entry.user_id);
    await createWinner(draw.id, entry, member.outcome ?? "unsubmitted");
  }
  return { drawId: draw.id, winners: entries.filter((e) => e.tier).length, counts, share, pool };
}

async function createWinner(drawId, entry, outcome) {
  const base = { draw_id: drawId, draw_entry_id: entry.id, user_id: entry.user_id, tier: entry.tier, prize_cents: entry.prize_cents };
  const states = {
    paid: { verification_status: "approved", payout_status: "paid", reviewed_at: daysAgo(5), paid_at: daysAgo(3), proof: true },
    approved: { verification_status: "approved", payout_status: "pending", reviewed_at: daysAgo(4), proof: true },
    pending: { verification_status: "pending", payout_status: "pending", proof: true },
    rejected: { verification_status: "rejected", payout_status: "pending", reviewed_at: daysAgo(4), review_note: "The screenshot was cut off — please include the date of each round.", proof: true },
    unsubmitted: { verification_status: "not_submitted", payout_status: "pending", proof: false },
  };
  const { proof, ...state } = states[outcome];

  let proofPath = null;
  if (proof) {
    proofPath = `${entry.user_id}/${entry.id}-demo.png`;
    const { error } = await db.storage.from("winner-proof").upload(proofPath, PNG, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`proof upload: ${error.message}`);
  }
  const { error } = await db.from("winners").insert({ ...base, ...state, proof_path: proofPath, proof_submitted_at: proof ? daysAgo(6) : null });
  if (error) throw new Error(`winner: ${error.message}`);
}

async function main() {
  await reset();
  const [{ data: charities }, { data: plans }, { data: demoUser }] = await Promise.all([
    db.from("charities").select("id, name").eq("is_active", true).order("name"),
    db.from("plans").select("*"),
    db.from("profiles").select("id").eq("email", process.env.SEED_USER_EMAIL).single(),
  ]);
  if (!charities?.length || !plans?.length) throw new Error("Run the SQL seed first: charities and plans are missing.");
  if (!demoUser) throw new Error("Run db:seed-users first: the demo member is missing.");

  const members = await createMembers(charities, plans);
  await equipDemoGolfer(demoUser.id, charities[0], plans);
  const contribution = accrue([...MEMBERS, { plan: "monthly" }], plans);
  const first = await publishEmptyDraw(contribution);
  const main = await publishMainDraw(members, contribution, first.rollover_out_cents, demoUser.id);

  for (const [index, amount] of [2500, 1000, 5000].entries()) {
    await db.from("donations").insert({
      charity_id: charities[index % charities.length].id, amount_cents: amount, currency: "GBP",
      status: "succeeded", stripe_payment_intent_id: `pi_demo_${index}`,
    });
  }

  console.info(`Demo data ready:
  ${members.length} demo members + the demo golfer, each with five scores and an active plan
  ${TWO_MONTHS_AGO}: published draw, nobody entered, jackpot rolled over
  ${LAST_MONTH}: published draw ${DRAWN.join(" · ")} — ${main.counts[5]} five-match, ${main.counts[4]} four-match, ${main.counts[3]} three-match
  winners cover paid, approved-awaiting-payment, under review, rejected and proof-needed
  3 one-off donations recorded`);
}

main().catch((error) => {
  console.error("Demo seeding failed:", error.message ?? error);
  process.exit(1);
});
