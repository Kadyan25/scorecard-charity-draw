// End-to-end check of PRD section 09 (winner verification and payouts).
// Builds its own winner, drives the full lifecycle through the real API, and
// removes everything it created.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { BASE, client, createChecker, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("winners");
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = randomBytes(12).toString("base64url");
const users = [];
let drawId = null;
let winnerId = null;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(2)]);

async function makeUser(label) {
  const email = `e2e-win-${label}@digitalheroes.test`;
  const existing = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
  if (existing) await service.auth.admin.deleteUser(existing.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  return { id: data.user.id, email };
}

async function upload(cookie, id, bytes, name, type) {
  const form = new FormData();
  form.set("winnerId", id);
  form.set("proof", new Blob([bytes], { type }), name);
  const res = await fetch(`${BASE}/api/winners/proof`, { method: "POST", body: form, headers: { cookie } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const winnerRow = async () => (await service.from("winners").select("*").eq("id", winnerId).single()).data;

async function cleanup() {
  for (const id of users) {
    const { data } = await service.storage.from("winner-proof").list(id);
    if (data?.length) await service.storage.from("winner-proof").remove(data.map((f) => `${id}/${f.name}`));
  }
  if (winnerId) await service.from("audit_log").delete().eq("entity_id", winnerId);
  if (drawId) await service.from("draws").delete().eq("id", drawId);
  for (const id of users) await service.auth.admin.deleteUser(id);
}

try {
  const winner = await makeUser("winner");
  const intruder = await makeUser("intruder");
  const { data: draw } = await service.from("draws").insert({ period_month: "2097-01-01", status: "published", numbers: [1, 2, 3, 4, 5] }).select("id").single();
  drawId = draw.id;
  const { data: entry } = await service.from("draw_entries").insert({ draw_id: drawId, user_id: winner.id, numbers: [1, 2, 3, 4, 40], matched_count: 4, tier: 4, prize_cents: 12345 }).select("id").single();
  const { data: row } = await service.from("winners").insert({ draw_id: drawId, draw_entry_id: entry.id, user_id: winner.id, tier: 4, prize_cents: 12345 }).select("id").single();
  winnerId = row.id;

  const winnerCookie = await login(winner.email, PASSWORD);
  const intruderCookie = await login(intruder.email, PASSWORD);
  const admin = client(await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD));
  const member = client(winnerCookie);

  // Upload validation and ownership
  check("signed-out upload refused (401)", (await upload("", winnerId, PNG, "a.png", "image/png")).status === 401);
  check("someone else's prize reads as not found (404)", (await upload(intruderCookie, winnerId, PNG, "a.png", "image/png")).status === 404);
  const disguised = await upload(winnerCookie, winnerId, new TextEncoder().encode("<html>not an image</html>"), "fake.png", "image/png");
  check("non-image disguised as PNG refused (400)", disguised.status === 400, JSON.stringify(disguised.body));
  const huge = new Uint8Array(4 * 1024 * 1024 + 1); huge.set(PNG);
  check("file over 4 MB refused (400)", (await upload(winnerCookie, winnerId, huge, "big.png", "image/png")).status === 400);
  check("admin cannot pay before approval (409)", (await admin("POST", "/api/admin/winners/payout", { winnerId })).status === 409);

  const first = await upload(winnerCookie, winnerId, PNG, "proof.png", "image/png");
  check("valid screenshot accepted", first.status === 200, JSON.stringify(first.body));
  let state = await winnerRow();
  check("status moves to pending review", state.verification_status === "pending" && state.proof_submitted_at);
  check("proof stored in the winner's own folder", state.proof_path?.startsWith(`${winner.id}/`), state.proof_path);
  const firstPath = state.proof_path;
  check("second upload while under review refused (409)", (await upload(winnerCookie, winnerId, PNG, "again.png", "image/png")).status === 409);

  // Storage RLS through real member sessions
  const asIntruder = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await asIntruder.auth.signInWithPassword({ email: intruder.email, password: PASSWORD });
  check("another member cannot download the proof", (await asIntruder.storage.from("winner-proof").download(firstPath)).error !== null);
  const asWinner = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await asWinner.auth.signInWithPassword({ email: winner.email, password: PASSWORD });
  check("the winner can read their own proof", (await asWinner.storage.from("winner-proof").download(firstPath)).error === null);
  const tamper = await asWinner.from("winners").update({ prize_cents: 99999999 }).eq("id", winnerId);
  check("winner cannot edit their prize through the database API", tamper.error !== null && (await winnerRow()).prize_cents === 12345);

  // Review: reject, resubmit, approve
  check("non-admin cannot review (403)", (await member("POST", "/api/admin/winners/review", { winnerId, decision: "approved" })).status === 403);
  check("rejecting without a reason refused (400)", (await admin("POST", "/api/admin/winners/review", { winnerId, decision: "rejected" })).status === 400);
  const rejected = await admin("POST", "/api/admin/winners/review", { winnerId, decision: "rejected", note: "Scores are cropped out" });
  state = await winnerRow();
  check("rejection recorded with the reviewer's note", rejected.status === 200 && state.verification_status === "rejected" && state.review_note === "Scores are cropped out");
  check("winner sees the rejection note", (await page("/dashboard/winnings", winnerCookie)).html.includes("Scores are cropped out"));

  const resubmitted = await upload(winnerCookie, winnerId, JPEG, "better.jpg", "image/jpeg");
  state = await winnerRow();
  check("resubmission after rejection accepted", resubmitted.status === 200 && state.verification_status === "pending" && state.proof_path.endsWith(".jpg"));
  check("rejected proof file is cleaned up", (await service.storage.from("winner-proof").download(firstPath)).error !== null);
  check("admin sees a signed proof link", (await page("/admin/winners?view=review", (await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD)))).html.includes("token="));

  check("approval succeeds", (await admin("POST", "/api/admin/winners/review", { winnerId, decision: "approved" })).status === 200);
  check("approving twice refused (409)", (await admin("POST", "/api/admin/winners/review", { winnerId, decision: "approved" })).status === 409);
  check("approved winner cannot upload again (409)", (await upload(winnerCookie, winnerId, PNG, "late.png", "image/png")).status === 409);

  // Payout: pending -> paid
  check("mark as paid succeeds", (await admin("POST", "/api/admin/winners/payout", { winnerId })).status === 200);
  state = await winnerRow();
  check("payout recorded with a date", state.payout_status === "paid" && state.paid_at);
  check("paying twice refused (409)", (await admin("POST", "/api/admin/winners/payout", { winnerId })).status === 409);

  const html = (await page("/dashboard/winnings", winnerCookie)).html;
  check("winner dashboard shows the prize as paid", html.includes("£123.45") && html.includes(">Paid<"));
  const { data: trail } = await service.from("audit_log").select("action").eq("entity_id", winnerId);
  const actions = (trail ?? []).map((t) => t.action).sort().join();
  check("every step is in the audit trail", actions === "winner.approved,winner.paid,winner.proof_submitted,winner.proof_submitted,winner.rejected", actions);
} catch (error) {
  check("suite ran without throwing", false, error?.message ?? error);
} finally {
  await cleanup();
}

process.exitCode = done() === 0 ? 0 : 1;
