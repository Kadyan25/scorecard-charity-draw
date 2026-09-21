# Digital Heroes

A subscription platform where a golfer's **last five Stableford scores are their numbers**
in a monthly prize draw, and a share of every payment goes to a charity they choose.

Built from the Digital Heroes PRD (Level 1).

- **Live site:** https://digital-heroes-ai-counsellor1.vercel.app
- **Stack:** Next.js 15 (App Router) · TypeScript · Supabase (Postgres, Auth, Storage) · Stripe · Tailwind v4 · Vercel

---

## Test credentials

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@digitalheroes.test` | `dTT9YEIZTMZY` |
| Member | `golfer@digitalheroes.test` | `MfdwERvOrhGJ` |

Payments run in **Stripe test mode** — use card `4242 4242 4242 4242`, any future expiry, any CVC.

The site is seeded with demo data: two published draws (the first with an unclaimed jackpot
that rolls into the second), winners across every verification state, and recorded donations.
The demo member has a prize **waiting for proof**, so the winner flow can be tried end to end.

---

## What it does

**Members**
- Subscribe monthly or yearly, and choose a charity at signup (10%–50% of every payment).
- Log Stableford scores (1–45, one per date). Only the five most recent are kept; a new
  score replaces the oldest.
- Those five numbers are the ticket for the monthly draw. Match 3, 4 or 5 to win a share.
- Upload proof of scores to claim a prize, and track it from pending to paid.
- Give one-off donations, independent of membership.

**Administrators**
- Manage members: profiles, their scores, and their subscriptions (via Stripe, plus
  complimentary access).
- Run draws: choose random or algorithmic, simulate as often as needed, then publish.
- Manage charities: create, edit, hide, feature, cover photos and events.
- Verify winners and record payouts.
- Reports: members, subscriptions, where money went, per-charity totals, draw statistics.
- Settings: prize pool share, charity bounds and tier split, without a deploy.

---

## Design decisions and resolved ambiguities

The PRD says ambiguity is part of the exercise. These are the judgement calls, and why.

**1. Scores are the draw ticket.** The PRD never says where a member's numbers come from.
Scores are bounded 1–45, exactly five are kept, and one draw mode is "weighted by score
frequency" — that is a 5-from-45 lottery whose ticket is the score set. Everything follows
from that reading.

**2. A page is missing from the PRD.** Footers run 02→10 then jump to 12; page 11, listed in
the contents as *§13 Technical Requirements* and *§14 Scalability Considerations*, is absent.
Both were inferred from the rest of the brief (§15 names Supabase and Vercel; §16 grades
scalability as extensibility).

**3. Repeated scores count once.** A golfer can shoot the same score twice, so matching uses
distinct values. `[30, 30, 12, 7, 41]` against a draw of `[30, 12, 7, 41, 5]` matches **4**.

**4. Backdated scores are refused, not silently dropped.** "A new score replaces the oldest"
would mean a round older than all five is inserted and immediately deleted. Instead it is
rejected with the cutoff date.

**5. Unclaimed 4- and 3-match prizes go to charity.** §07 says only the jackpot rolls over but
never says where the others go. They are split between charities in proportion to supporters,
and reported as their own line.

**6. Rounding remainders carry forward.** Tiers divide equally by integer division; leftover
pence roll into next month. Every split is asserted to reconcile exactly.

**7. The pool accrues from active members.** §07 says "based on active subscriber count", so
the pool is built from who is subscribed at draw time — yearly members contributing a twelfth
each month — rather than from cash received, which would spike on renewals.

**8. Draws run in calendar order.** Each draw consumes the previous rollover, so back-filling
an earlier month is refused; it would spend the same jackpot twice.

**9. Charity share is capped at 50%.** §08 sets a 10% minimum and no maximum; unbounded, a
member could leave nothing for the prize pool. Both bounds are admin-configurable.

**10. One day of timezone slack on score dates.** The database runs on UTC, so a golfer in
India logging a round after local midnight would otherwise be told it hasn't happened yet.

---

## Running it locally

```bash
npm install
supabase start                      # local Postgres, Auth and Storage (needs Docker)
cp .env.example .env.local          # fill in from `supabase status`
npm run db:seed-users               # admin + demo member
npm run db:seed-demo                # draws, winners, donations
npm run dev
```

For payments, add a Stripe test secret key to `.env.local` and forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed
```

---

## Tests

```bash
npm test            # 160 unit tests — draw engine, prize maths, money, rules
npm run test:db     # ~70 database checks — triggers, constraints, RLS, privileges
npm run test:e2e    # 7 HTTP suites against a running app, including real Stripe test mode
npm run typecheck
npm run lint
```

The end-to-end suites create their own members, charities, draws and Stripe customers, then
remove them. The Stripe suite drives real subscriptions with Stripe's test payment tokens and
a test clock for a failed renewal, so the webhooks it asserts on are genuine.

---

## How it is put together

```
app/(marketing)   public pages        app/dashboard   member area
app/(auth)        sign in / sign up   app/admin       admin area
app/api           route handlers      services/       business logic, mostly pure
lib/              supabase, stripe, money, validation, auth guards
supabase/         migrations, seed, database tests
tests/e2e/        HTTP end-to-end suites
```

**Data model.** `profiles`, `charities`, `charity_events`, `plans`, `subscriptions`,
`payments`, `donations`, `scores`, `draws`, `draw_entries`, `winners`, `settings`,
`audit_log`, `stripe_events`.

**Principles the code sticks to**
- **Money is integer pence**, and every split asserts it reconciles to its source.
- **Identity comes from the session**, never from a request body.
- **RLS on every table**, plus column-level grants: a member can write their name, charity,
  contribution and scores — not their role, their Stripe customer, or their prize.
- **Draws are snapshots.** Entries store the numbers as they were, so editing a score later
  can never change a published result.
- **Publishing a draw is one transaction**, and is idempotent.
- **Settings are data**, so commercial rules change without a deploy.
- **Reads that need every row are paged**, because PostgREST caps responses at 1,000.
