-- Billing support for Stripe.
--
-- The Stripe customer belongs to the person, not to any one subscription: it
-- has to exist before the first checkout and it outlives cancellations.

alter table profiles
  add column stripe_customer_id text unique;

-- Every webhook event we have fully processed. Stripe delivers at least once
-- and retries on any non-2xx, so handlers are idempotent and this table is the
-- record of what has been applied.
create table stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

alter table stripe_events enable row level security;

create policy "admins read stripe events"
  on stripe_events for select using (public.is_admin());

-- A member must never be able to point their profile at someone else's Stripe
-- customer, so the column joins role in the list of fields users cannot edit.
drop policy "users update own profile" on profiles;

create policy "users update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles p where p.id = auth.uid())
    and stripe_customer_id is not distinct from
        (select stripe_customer_id from profiles p where p.id = auth.uid())
  );
