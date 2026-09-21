// End-to-end check of PRD section 08 (charity system) against a running app.
// Restores the demo golfer's original charity choice when it finishes.
import { client, createChecker, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("charity");
const ALL = ["Greenfield Youth Trust", "Fairway to Recovery", "The Caddie Fund", "Open Green Spaces", "Second Shot Veterans", "Birdie Books"];
const listed = (html) => ALL.filter((name) => html.includes(`>${name}<`));

// Directory, search and filter (08.2)
let res = await page("/charities");
check("directory lists every active charity", res.status === 200 && listed(res.html).length === 6, listed(res.html));
res = await page("/charities?category=health");
check("category filter (case-insensitive)", listed(res.html).join() === "Fairway to Recovery", listed(res.html));
res = await page("/charities?q=literacy");
check("search matches description text", listed(res.html).join() === "Birdie Books", listed(res.html));
res = await page("/charities?q=zzzz-no-match");
check("empty search shows the empty state", res.html.includes("No charities match that search"));
res = await page(`/charities?q=${encodeURIComponent("x),is_active.eq.false,(name.ilike.*")}`);
check("filter-injection attempt is harmless", res.status === 200 && !res.html.includes("Something went wrong"));
res = await page("/charities?category=Nonsense");
check("unknown category falls back to all", listed(res.html).length === 6);

// Profiles (08.2)
res = await page("/charities/greenfield-youth-trust");
check("profile renders description, mission and events", res.status === 200 && res.html.includes("Upcoming events") && res.html.includes("Spring Charity Golf Day"));
check("visitor sees the join CTA", res.html.includes("/signup?charity=greenfield-youth-trust"));
res = await page("/charities/not-a-real-charity");
check("unknown charity returns 404", res.status === 404);

// Homepage spotlight (08.2)
res = await page("/");
check("homepage spotlights the featured charity", res.html.includes("Charity spotlight") && res.html.includes("Greenfield Youth Trust"));

// Member selection and contribution (08.1)
const cookie = await login(env.SEED_USER_EMAIL, env.SEED_USER_PASSWORD);
const api = client(cookie);
const before = await page("/dashboard/charity", cookie);
const caddie = before.html.match(/value="([0-9a-f-]{36})"[^>]*>(?:(?!<label).)*?The Caddie Fund/s)?.[1];
const greenfield = before.html.match(/value="([0-9a-f-]{36})"[^>]*>(?:(?!<label).)*?Greenfield Youth Trust/s)?.[1];
check("dashboard lists charity options", Boolean(caddie && greenfield), { caddie, greenfield });

const anon = await client("")("PATCH", "/api/charity", { charityId: caddie, charityPercent: 20 });
check("signed-out change refused (401)", anon.status === 401);
const low = await api("PATCH", "/api/charity", { charityId: caddie, charityPercent: 9 });
check("below 10% refused", low.status === 400 && /minimum/.test(low.body?.error), JSON.stringify(low.body));
const high = await api("PATCH", "/api/charity", { charityId: caddie, charityPercent: 51 });
check("above 50% refused", high.status === 400 && /maximum/.test(high.body?.error), JSON.stringify(high.body));
const ghost = await api("PATCH", "/api/charity", { charityId: "00000000-0000-0000-0000-000000000000", charityPercent: 20 });
check("unknown charity refused", ghost.status === 400, JSON.stringify(ghost.body));
const ok = await api("PATCH", "/api/charity", { charityId: caddie, charityPercent: 25 });
check("valid change saved", ok.status === 200, JSON.stringify(ok.body));
const after = await page("/dashboard/charity", cookie);
check("dashboard reflects the new charity and 25%", after.html.includes("The Caddie Fund") && after.html.includes(">25%<"));
const profile = await page("/charities/the-caddie-fund", cookie);
check("profile recognises the member's own charity", profile.html.includes("Your chosen charity"));

await api("PATCH", "/api/charity", { charityId: greenfield, charityPercent: 15 });

// Independent donations (08.1)
const tiny = await client("")("POST", "/api/donations", { charityId: greenfield, amountCents: 50 });
check("donation under £1 refused", tiny.status === 400, JSON.stringify(tiny.body));
const gift = await client("")("POST", "/api/donations", { charityId: greenfield, amountCents: 1000 });
check("visitor donation reaches payment step", gift.status === 503 || (gift.status === 200 && gift.body?.url), JSON.stringify(gift.body));

// With Stripe configured that created a real pending donation; remove it so
// the suite leaves no trace (completion itself is covered by the Stripe suite).
if (gift.status === 200) {
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const sessionId = new URL(gift.body.url).pathname.split("/").pop()?.split("#")[0];
  await service.from("donations").delete().eq("status", "pending").eq("charity_id", greenfield).eq("amount_cents", 1000)
    .or(sessionId ? `stripe_checkout_session_id.eq.${sessionId},stripe_checkout_session_id.is.null` : "stripe_checkout_session_id.is.null");
}

process.exitCode = done() === 0 ? 0 : 1;
