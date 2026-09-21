// End-to-end check of PRD section 05 (score management) against a running app.
//
//   npm run test:e2e
//
// Needs the dev server up, `npm run db:seed-users` run, and the demo golfer
// holding an active subscription. Cleans up its own scores, so it is repeatable.
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

function client(cookie) {
  return async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
let failures = 0;
function check(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${condition ? "" : `  -> ${detail}`}`);
  if (!condition) failures += 1;
}

const api = client(await login(env.SEED_USER_EMAIL, env.SEED_USER_PASSWORD));

// Start clean so the run is repeatable.
for (const s of (await api("GET", "/api/scores")).body.scores) await api("DELETE", `/api/scores/${s.id}`);

for (const [value, offset] of [[30, -20], [12, -15], [7, -10], [41, -5], [22, -2]]) {
  const r = await api("POST", "/api/scores", { value, playedOn: day(offset) });
  check(`add ${value} on ${day(offset)}`, r.status === 201, JSON.stringify(r.body));
}

let list = (await api("GET", "/api/scores")).body.scores;
check("five scores retained", list.length === 5, list.length);
check("newest first", list.map((s) => s.played_on).join() === [...list.map((s) => s.played_on)].sort().reverse().join());

const sixth = await api("POST", "/api/scores", { value: 38, playedOn: day(0) });
list = (await api("GET", "/api/scores")).body.scores;
check("sixth score accepted", sixth.status === 201, JSON.stringify(sixth.body));
check("still five after sixth", list.length === 5, list.length);
check("oldest (30 on day -20) evicted", !list.some((s) => s.played_on === day(-20)));
check("new score is first", list[0].value === 38 && list[0].played_on === day(0));

const dup = await api("POST", "/api/scores", { value: 20, playedOn: day(-2) });
check("duplicate date refused (409)", dup.status === 409, JSON.stringify(dup.body));

const back = await api("POST", "/api/scores", { value: 20, playedOn: day(-60) });
check("backdate older than retained refused (422)", back.status === 422 && /older than your five/.test(back.body?.error), JSON.stringify(back.body));

const high = await api("POST", "/api/scores", { value: 46, playedOn: day(-1) });
check("score 46 refused (400)", high.status === 400, JSON.stringify(high.body));
const zero = await api("POST", "/api/scores", { value: 0, playedOn: day(-1) });
check("score 0 refused (400)", zero.status === 400);
const frac = await api("POST", "/api/scores", { value: 20.5, playedOn: day(-1) });
check("fractional score refused (400)", frac.status === 400);
const future = await api("POST", "/api/scores", { value: 20, playedOn: day(3) });
check("future date refused (400)", future.status === 400, JSON.stringify(future.body));

const target = list[1];
const edit = await api("PATCH", `/api/scores/${target.id}`, { value: 44 });
check("edit own score value", edit.status === 200 && edit.body.score.value === 44, JSON.stringify(edit.body));
const clash = await api("PATCH", `/api/scores/${target.id}`, { playedOn: list[0].played_on });
check("edit onto an existing date refused (409)", clash.status === 409, JSON.stringify(clash.body));
const empty = await api("PATCH", `/api/scores/${target.id}`, {});
check("empty edit refused (400)", empty.status === 400);

const del = await api("DELETE", `/api/scores/${target.id}`);
check("delete own score", del.status === 200);
const again = await api("DELETE", `/api/scores/${target.id}`);
check("delete twice -> 404", again.status === 404);
const ghost = await api("PATCH", "/api/scores/00000000-0000-0000-0000-000000000000", { value: 10 });
check("edit unknown id -> 404", ghost.status === 404);
const bad = await api("PATCH", "/api/scores/not-a-uuid", { value: 10 });
check("malformed id -> 400", bad.status === 400);

// A backdated score is allowed again once the window has room.
const refill = await api("POST", "/api/scores", { value: 19, playedOn: day(-60) });
check("backdate allowed when fewer than five", refill.status === 201, JSON.stringify(refill.body));

// Non-subscriber: the seeded admin has no subscription of their own.
const outsider = client(await login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD));
const blocked = await outsider("POST", "/api/scores", { value: 20, playedOn: day(-1) });
check("non-subscriber blocked (402)", blocked.status === 402, JSON.stringify(blocked.body));
const anon = await client("")("POST", "/api/scores", { value: 20, playedOn: day(-1) });
check("signed-out blocked (401)", anon.status === 401);

console.log(failures === 0 ? "\nALL SCORE SCENARIOS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
