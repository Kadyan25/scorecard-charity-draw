// End-to-end check of PRD section 04 against Stripe test mode.
//
// Needs `stripe listen --forward-to <app>/api/stripe/webhook` running. Checkout
// sessions are created through our API exactly as the browser would; the
// subscription itself is then created through Stripe's API with Stripe's own
// test payment tokens (pm_card_visa, pm_card_chargeCustomerFail), so the real
// webhooks flow back through the real endpoint. A test clock drives a genuine
// failed renewal. Everything created — in Stripe and locally — is removed.
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { BASE, client, createChecker, day, env, login, page } from "./helpers.mjs";

const { check, done } = createChecker("stripe");
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = randomBytes(12).toString("base64url");
const users = [];
const customers = [];
const clocks = [];
const donations = [];

async function waitFor(label, probe, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function makeMember(label, charityPercent) {
  const email = `e2e-stripe-${label}@digitalheroes.test`;
  const existing = (await service.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email);
  if (existing) await service.auth.admin.deleteUser(existing.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Stripe ${label}` } });
  if (error) throw error;
  users.push(data.user.id);
  const { data: charity } = await service.from("charities").select("id").eq("slug", "greenfield-youth-trust").single();
  await service.from("profiles").update({ charity_id: charity.id, charity_percent: charityPercent }).eq("id", data.user.id);
  const cookie = await login(email, PASSWORD);
  return { id: data.user.id, email, charityId: charity.id, cookie, api: client(cookie) };
}

const profile = async (id) => (await service.from("profiles").select("*").eq("id", id).single()).data;
const subscriptionRow = async (id) => (await service.from("subscriptions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
const paymentsFor = async (id) => (await service.from("payments").select("*").eq("user_id", id)).data ?? [];
const priceFor = async (code) => (await service.from("plans").select("stripe_price_id").eq("code", code).single()).data.stripe_price_id;

/** What the Checkout page would do once the card is accepted. */
async function subscribe(customerId, priceId, paymentMethod = "pm_card_visa") {
  const pm = await stripe.paymentMethods.attach(paymentMethod, { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }] });
}

async function canEnterScores(api) {
  const res = await api("POST", "/api/scores", { value: 20, playedOn: day(-1) });
  if (res.status === 201) await api("DELETE", `/api/scores/${res.body.score.id}`);
  return res.status;
}

async function postSigned(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
  const res = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
  return res.status;
}

async function cleanup() {
  for (const clock of clocks) await stripe.testHelpers.testClocks.del(clock).catch(() => {});
  for (const customer of customers) await stripe.customers.del(customer).catch(() => {});
  if (donations.length) await service.from("donations").delete().in("id", donations);
  for (const id of users) await service.auth.admin.deleteUser(id);
}

async function monthlyLifecycle() {
  const m = await makeMember("monthly", 20);
  check("non-subscriber has no score access (402)", (await canEnterScores(m.api)) === 402);

  const checkout = await m.api("POST", "/api/stripe/checkout", { planCode: "monthly" });
  check("checkout returns a Stripe-hosted URL", checkout.status === 200 && checkout.body.url.startsWith("https://checkout.stripe.com/"), JSON.stringify(checkout.body));
  const customerId = (await profile(m.id)).stripe_customer_id;
  customers.push(customerId);
  check("Stripe customer created and stored once", customerId?.startsWith("cus_"));
  const again = await m.api("POST", "/api/stripe/checkout", { planCode: "monthly" });
  check("a second checkout reuses the same customer", again.status === 200 && (await profile(m.id)).stripe_customer_id === customerId);
  const priceId = await priceFor("monthly");
  check("monthly price created and linked to the plan", priceId?.startsWith("price_"));

  const sub = await subscribe(customerId, priceId);
  const row = await waitFor("monthly subscription row", async () => { const r = await subscriptionRow(m.id); return r?.status === "active" ? r : null; });
  check("webhook creates an active subscription", row.stripe_subscription_id === sub.id);
  const days = (new Date(row.current_period_end) - Date.now()) / 86_400_000;
  check("renewal date is about a month out", days > 27 && days < 32, days);

  const [payment] = await waitFor("monthly payment", async () => { const p = await paymentsFor(m.id); return p.length ? p : null; });
  check("paid invoice recorded at £9.99", payment.amount_cents === 999 && payment.status === "succeeded");
  check("split: 20% charity, 30% prize pool, rest platform", payment.charity_amount_cents === 200 && payment.prize_pool_amount_cents === 300 && payment.platform_amount_cents === 499, payment);
  check("charity choice snapshotted on the payment", payment.charity_id_snapshot === m.charityId && payment.charity_percent_snapshot === 20);

  check("subscriber can now enter scores", (await canEnterScores(m.api)) === 201);
  check("second checkout refused while active (409)", (await m.api("POST", "/api/stripe/checkout", { planCode: "yearly" })).status === 409);
  const billing = (await page("/dashboard/billing", m.cookie)).html;
  check("billing page shows the plan, status and charity share", billing.includes("Monthly") && billing.includes(">Active<") && billing.includes("£2.00"));
  check("billing portal opens", ((await m.api("POST", "/api/stripe/portal")).body?.url ?? "").startsWith("https://billing.stripe.com/"));

  await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  await waitFor("cancel-at-period-end", async () => (await subscriptionRow(m.id))?.cancel_at_period_end);
  check("scheduled cancellation keeps access until period end", (await canEnterScores(m.api)) === 201);

  await stripe.subscriptions.cancel(sub.id);
  await waitFor("cancelled subscription", async () => (await subscriptionRow(m.id))?.status === "canceled");
  check("immediate cancellation removes access (402)", (await canEnterScores(m.api)) === 402);
  return { payment };
}

async function yearly() {
  const y = await makeMember("yearly", 10);
  const checkout = await y.api("POST", "/api/stripe/checkout", { planCode: "yearly" });
  check("yearly checkout returns a URL", checkout.status === 200);
  const customerId = (await profile(y.id)).stripe_customer_id;
  customers.push(customerId);
  await subscribe(customerId, await priceFor("yearly"));
  const row = await waitFor("yearly subscription", async () => { const r = await subscriptionRow(y.id); return r?.status === "active" ? r : null; });
  const days = (new Date(row.current_period_end) - Date.now()) / 86_400_000;
  check("yearly renewal date is about a year out", days > 360 && days < 370, days);
  const [payment] = await waitFor("yearly payment", async () => { const p = await paymentsFor(y.id); return p.length ? p : null; });
  check("yearly split: £99.90 -> 999 / 2997 / 5994", payment.amount_cents === 9990 && payment.charity_amount_cents === 999 && payment.prize_pool_amount_cents === 2997 && payment.platform_amount_cents === 5994, payment);
}

async function failedRenewal() {
  const f = await makeMember("lapse", 10);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000) });
  clocks.push(clock.id);
  const customer = await stripe.customers.create({ email: f.email, test_clock: clock.id, metadata: { user_id: f.id } });
  await service.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", f.id);

  const sub = await subscribe(customer.id, await priceFor("monthly"));
  await waitFor("clocked subscription active", async () => (await subscriptionRow(f.id))?.status === "active");
  const failing = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: failing.id } });
  await stripe.subscriptions.update(sub.id, { default_payment_method: failing.id });

  await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: clock.frozen_time + 33 * 86_400 });
  await waitFor("test clock advance", async () => (await stripe.testHelpers.testClocks.retrieve(clock.id)).status === "ready", 120_000);
  await waitFor("past_due after failed renewal", async () => (await subscriptionRow(f.id))?.status === "past_due", 120_000);
  check("failed renewal marks the subscription past due", true);
  check("past-due member loses score access (402)", (await canEnterScores(f.api)) === 402);
}

async function webhookSafety(payment) {
  check("unsigned webhook rejected (400)", (await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}" })).status === 400);
  const forged = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=forged" } });
  check("badly signed webhook rejected (400)", forged.status === 400);

  const invoice = await stripe.invoices.retrieve(payment.stripe_invoice_id);
  const event = { id: `evt_e2e_${randomBytes(6).toString("hex")}`, object: "event", type: "invoice.paid", data: { object: invoice } };
  const before = (await paymentsFor(payment.user_id)).length;
  check("replayed invoice.paid accepted", (await postSigned(event)) === 200 && (await postSigned(event)) === 200);
  check("replay does not duplicate the payment", (await paymentsFor(payment.user_id)).length === before);
  await service.from("stripe_events").delete().eq("id", event.id);

  // An event for a customer we no longer know must be acknowledged, not
  // retried by Stripe for days (found when test cleanup deleted customers).
  const orphan = { id: `evt_e2e_${randomBytes(6).toString("hex")}`, object: "event", type: "customer.subscription.deleted",
    data: { object: { id: "sub_e2e_orphan", object: "subscription", status: "canceled", customer: "cus_e2e_unknown", cancel_at_period_end: false, canceled_at: 1, metadata: {}, items: { data: [] } } } };
  check("event for an unknown customer acknowledged (200), not retried", (await postSigned(orphan)) === 200);
  check("no subscription row created for it", !(await service.from("subscriptions").select("id").eq("stripe_subscription_id", "sub_e2e_orphan").maybeSingle()).data);
  await service.from("stripe_events").delete().eq("id", orphan.id);
}

async function donation() {
  const { data: charity } = await service.from("charities").select("id").eq("slug", "birdie-books").single();
  const res = await client("")("POST", "/api/donations", { charityId: charity.id, amountCents: 2500 });
  check("visitor donation opens Stripe Checkout", res.status === 200 && res.body.url.startsWith("https://checkout.stripe.com/"));
  const { data: row } = await service.from("donations").select("*").eq("charity_id", charity.id).order("created_at", { ascending: false }).limit(1).single();
  donations.push(row.id);
  check("donation held as pending until paid", row.status === "pending" && row.stripe_checkout_session_id?.startsWith("cs_test_"));

  const session = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id);
  const completed = { ...session, status: "complete", payment_status: "paid", payment_intent: "pi_e2e_simulated" };
  const event = { id: `evt_e2e_${randomBytes(6).toString("hex")}`, object: "event", type: "checkout.session.completed", data: { object: completed } };
  check("completed donation webhook accepted", (await postSigned(event)) === 200);
  const { data: after } = await service.from("donations").select("status").eq("id", row.id).single();
  check("donation marked succeeded", after.status === "succeeded");
  await service.from("stripe_events").delete().eq("id", event.id);
}

try {
  const { payment } = await monthlyLifecycle();
  await yearly();
  await webhookSafety(payment);
  await donation();
  await failedRenewal();
} catch (error) {
  check("suite ran without throwing", false, error?.message ?? error);
} finally {
  await cleanup();
}

process.exitCode = done() === 0 ? 0 : 1;
