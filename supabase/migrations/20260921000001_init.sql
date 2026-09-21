-- Digital Heroes - initial schema
--
-- Design notes live in architecture.md. Two rules drive most of this file:
--   1. All money is integer minor units. No numeric/float currency columns.
--   2. Draw records are snapshots. Editing a score must never alter a past draw.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('user', 'admin');

create type subscription_status as enum (
  'incomplete', 'active', 'past_due', 'canceled', 'lapsed'
);

create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create type draw_mode as enum ('random', 'algorithmic');

create type draw_status as enum ('draft', 'simulated', 'published');

create type verification_status as enum (
  'not_submitted', 'pending', 'approved', 'rejected'
);

create type payout_status as enum ('pending', 'paid');

-- ---------------------------------------------------------------------------
-- Settings - commercial values that must be tunable without a deploy
-- ---------------------------------------------------------------------------

create table settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into settings (key, value, description) values
  ('prize_pool_percent', '30'::jsonb,
   'Fixed share of every subscription payment that funds the prize pool'),
  ('charity_percent_min', '10'::jsonb,
   'Minimum charity contribution, per PRD section 08.1'),
  ('charity_percent_max', '50'::jsonb,
   'Ceiling added so charity + prize pool can never exceed 100 percent'),
  ('tier_split', '{"5": 40, "4": 35, "3": 25}'::jsonb,
   'Prize pool share per match tier, per PRD section 07'),
  ('default_currency', '"GBP"'::jsonb, 'Display and billing currency');

create or replace function setting_int(p_key text)
returns integer
language sql
stable
as $$
  select (value #>> '{}')::integer from settings where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Charities
-- ---------------------------------------------------------------------------

create table charities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  tagline        text,
  description    text not null default '',
  mission        text,
  category       text not null default 'General',
  logo_url       text,
  hero_image_url text,
  website_url    text,
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index charities_active_idx on charities (is_active, name);
create index charities_featured_idx on charities (is_featured) where is_featured;

create table charity_events (
  id          uuid primary key default gen_random_uuid(),
  charity_id  uuid not null references charities (id) on delete cascade,
  title       text not null,
  description text,
  event_date  date not null,
  location    text,
  image_url   text,
  created_at  timestamptz not null default now()
);

create index charity_events_charity_idx on charity_events (charity_id, event_date);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  full_name        text,
  role             user_role not null default 'user',
  charity_id       uuid references charities (id) on delete set null,
  charity_percent  integer not null default 10,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint charity_percent_range check (charity_percent between 0 and 100)
);

create index profiles_charity_idx on profiles (charity_id);
create index profiles_role_idx on profiles (role) where role = 'admin';

-- Admin checks must not be subject to RLS on profiles, or the policies that
-- call this function would recurse into themselves.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plans, subscriptions, payments
-- ---------------------------------------------------------------------------

create table plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text,
  amount_cents    integer not null check (amount_cents > 0),
  currency        text not null default 'GBP',
  interval        text not null check (interval in ('month', 'year')),
  stripe_price_id text unique,
  is_active       boolean not null default true,
  sort_order      integer not null default 0
);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles (id) on delete cascade,
  plan_id                uuid references plans (id),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 subscription_status not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_user_status_idx on subscriptions (user_id, status);
create index subscriptions_customer_idx on subscriptions (stripe_customer_id);

-- One row per paid invoice. The *_snapshot columns freeze the user's charity
-- choice at payment time so a later change cannot rewrite historic attribution.
create table payments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references profiles (id) on delete cascade,
  subscription_id          uuid references subscriptions (id) on delete set null,
  stripe_invoice_id        text unique,
  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text not null default 'GBP',
  status                   payment_status not null default 'pending',
  paid_at                  timestamptz,
  charity_id_snapshot      uuid references charities (id) on delete set null,
  charity_percent_snapshot integer not null default 0,
  charity_amount_cents     integer not null default 0 check (charity_amount_cents >= 0),
  prize_pool_amount_cents  integer not null default 0 check (prize_pool_amount_cents >= 0),
  platform_amount_cents    integer not null default 0 check (platform_amount_cents >= 0),
  created_at               timestamptz not null default now(),
  -- The three-way split must reconcile exactly against the invoice.
  constraint split_reconciles check (
    charity_amount_cents + prize_pool_amount_cents + platform_amount_cents
      = amount_cents
  )
);

create index payments_user_idx on payments (user_id, paid_at desc);
create index payments_paid_at_idx on payments (paid_at) where status = 'succeeded';

create table donations (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references profiles (id) on delete set null,
  charity_id               uuid not null references charities (id) on delete restrict,
  amount_cents             integer not null check (amount_cents > 0),
  currency                 text not null default 'GBP',
  status                   payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  created_at               timestamptz not null default now()
);

create index donations_charity_idx on donations (charity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Scores - the draw ticket
-- ---------------------------------------------------------------------------

create table scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  value      integer not null check (value between 1 and 45),
  played_on  date not null check (played_on <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- PRD section 05: one entry per date; an existing entry is edited, not duplicated.
  constraint scores_one_per_date unique (user_id, played_on)
);

create index scores_user_recent_idx on scores (user_id, played_on desc);

-- PRD section 05 says a new score replaces the oldest. Taken literally, a
-- backdated score would be inserted then immediately evicted - a silent no-op
-- the user cannot make sense of. Reject it with the cutoff date instead.
create or replace function public.reject_backdated_score()
returns trigger
language plpgsql
as $$
declare
  retained_count integer;
  oldest_kept    date;
begin
  select count(*), min(played_on)
    into retained_count, oldest_kept
  from scores
  where user_id = new.user_id;

  if retained_count >= 5 and new.played_on < oldest_kept then
    raise exception
      'Score date % is older than your five retained scores (oldest kept: %). Edit or delete an existing score instead.',
      new.played_on, oldest_kept
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger scores_reject_backdated
  before insert on scores
  for each row execute function public.reject_backdated_score();

-- Only the latest 5 scores are retained (PRD section 05). Enforced in the
-- database so the rule holds regardless of which client wrote the row.
create or replace function public.enforce_rolling_score_window()
returns trigger
language plpgsql
as $$
begin
  delete from scores
  where user_id = new.user_id
    and id not in (
      select id from scores
      where user_id = new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return null;
end;
$$;

create trigger scores_rolling_window
  after insert on scores
  for each row execute function public.enforce_rolling_score_window();

-- ---------------------------------------------------------------------------
-- Draws
-- ---------------------------------------------------------------------------

create table draws (
  id                   uuid primary key default gen_random_uuid(),
  period_month         date not null,
  mode                 draw_mode not null default 'random',
  status               draw_status not null default 'draft',
  numbers              integer[] not null default '{}',
  pool_total_cents     integer not null default 0 check (pool_total_cents >= 0),
  rollover_in_cents    integer not null default 0 check (rollover_in_cents >= 0),
  rollover_out_cents   integer not null default 0 check (rollover_out_cents >= 0),
  charity_bonus_cents  integer not null default 0 check (charity_bonus_cents >= 0),
  tier5_pool_cents     integer not null default 0,
  tier4_pool_cents     integer not null default 0,
  tier3_pool_cents     integer not null default 0,
  eligible_entry_count integer not null default 0,
  published_at         timestamptz,
  created_by           uuid references profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint numbers_shape check (
    status <> 'published' or array_length(numbers, 1) = 5
  ),
  constraint period_is_month_start check (date_trunc('month', period_month) = period_month)
);

-- At most one published draw per month; drafts and simulations are unrestricted.
create unique index draws_one_published_per_month
  on draws (period_month) where status = 'published';

create index draws_status_idx on draws (status, period_month desc);

create table draw_entries (
  id            uuid primary key default gen_random_uuid(),
  draw_id       uuid not null references draws (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  -- Snapshot of the user's retained scores at lock time.
  numbers       integer[] not null,
  matched_count integer not null default 0 check (matched_count between 0 and 5),
  tier          integer check (tier in (3, 4, 5)),
  prize_cents   integer not null default 0 check (prize_cents >= 0),
  created_at    timestamptz not null default now(),
  constraint draw_entries_one_per_user unique (draw_id, user_id)
);

create index draw_entries_draw_idx on draw_entries (draw_id, matched_count desc);
create index draw_entries_user_idx on draw_entries (user_id, created_at desc);

create table winners (
  id                  uuid primary key default gen_random_uuid(),
  draw_id             uuid not null references draws (id) on delete cascade,
  draw_entry_id       uuid not null references draw_entries (id) on delete cascade,
  user_id             uuid not null references profiles (id) on delete cascade,
  tier                integer not null check (tier in (3, 4, 5)),
  prize_cents         integer not null check (prize_cents >= 0),
  verification_status verification_status not null default 'not_submitted',
  proof_path          text,
  proof_submitted_at  timestamptz,
  reviewed_by         uuid references profiles (id) on delete set null,
  reviewed_at         timestamptz,
  review_note         text,
  payout_status       payout_status not null default 'pending',
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  constraint winners_one_per_entry unique (draw_entry_id)
);

create index winners_user_idx on winners (user_id, created_at desc);
create index winners_review_queue_idx on winners (verification_status, proof_submitted_at);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on subscriptions
  for each row execute function public.touch_updated_at();
create trigger scores_touch before update on scores
  for each row execute function public.touch_updated_at();
create trigger draws_touch before update on draws
  for each row execute function public.touch_updated_at();
