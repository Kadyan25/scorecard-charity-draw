-- Database rule tests: triggers, constraints and row level security.
--
-- Runs inside one transaction that is always rolled back, so it is safe to run
-- against any local database. Each check raises on failure; reaching the final
-- line means every rule held.
--
--   npm run test:db

begin;

-- Fixtures -----------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local',
   '{"full_name":"Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local',
   '{"full_name":"Bob"}', 'authenticated', 'authenticated');

-- Helper: run a statement and require it to fail with a given SQLSTATE.
create or replace function pg_temp.expect_error(stmt text, expected text, label text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL [%]: statement succeeded but should have failed', label;
exception
  when others then
    if sqlstate <> expected then
      raise exception 'FAIL [%]: expected SQLSTATE %, got % (%)', label, expected, sqlstate, sqlerrm;
    end if;
end;
$$;

create or replace function pg_temp.expect(condition boolean, label text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'FAIL [%]', label;
  end if;
end;
$$;

-- Profiles -------------------------------------------------------------------

select pg_temp.expect(
  (select count(*) = 2 from profiles where email like '%@test.local'),
  'signup trigger creates a profile per auth user');

select pg_temp.expect(
  (select full_name = 'Alice' and role = 'user' and charity_percent = 10
     from profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'profile defaults: name from metadata, user role, 10% charity');

-- Scores: rolling window of five ---------------------------------------------

insert into scores (user_id, value, played_on)
select '00000000-0000-0000-0000-00000000000a', v, current_date - (10 - v)
from generate_series(1, 5) as v;

select pg_temp.expect(
  (select count(*) = 5 from scores where user_id = '00000000-0000-0000-0000-00000000000a'),
  'five scores are retained');

-- A sixth, newer score must evict the oldest (played_on = current_date - 9).
insert into scores (user_id, value, played_on)
values ('00000000-0000-0000-0000-00000000000a', 40, current_date);

select pg_temp.expect(
  (select count(*) = 5 from scores where user_id = '00000000-0000-0000-0000-00000000000a'),
  'sixth score keeps the window at five');

select pg_temp.expect(
  not exists (select 1 from scores
              where user_id = '00000000-0000-0000-0000-00000000000a'
                and played_on = current_date - 9),
  'the oldest score was the one evicted');

select pg_temp.expect(
  exists (select 1 from scores
          where user_id = '00000000-0000-0000-0000-00000000000a' and value = 40),
  'the new score was kept');

-- Scores: constraints ---------------------------------------------------------

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000a', 20, current_date)$$,
  '23505', 'one score per date');

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000a', 20, current_date - 30)$$,
  '23514', 'backdated score older than the retained five is rejected');

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000b', 46, current_date)$$,
  '23514', 'score above 45 is rejected');

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000b', 0, current_date)$$,
  '23514', 'score below 1 is rejected');

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000b', 30, current_date + 2)$$,
  '23514', 'future-dated score is rejected');

-- Editing a score onto a date that already has one hits the same rule as
-- inserting it: the one-per-date constraint applies to updates too.
select pg_temp.expect_error(
  $$update scores set played_on = current_date
    where user_id = '00000000-0000-0000-0000-00000000000a' and played_on = current_date - 8$$,
  '23505', 'a score cannot be edited onto a date that already has one');

-- Tomorrow is allowed: a golfer ahead of UTC is already on tomorrow's date.
insert into scores (user_id, value, played_on)
values ('00000000-0000-0000-0000-00000000000a', 44, current_date + 1);

select pg_temp.expect(
  exists (select 1 from scores
          where user_id = '00000000-0000-0000-0000-00000000000a' and played_on = current_date + 1),
  'one day of timezone slack is permitted');

-- A user with fewer than five scores may backdate freely.
insert into scores (user_id, value, played_on)
values ('00000000-0000-0000-0000-00000000000b', 30, current_date - 400);

select pg_temp.expect(
  (select count(*) = 1 from scores where user_id = '00000000-0000-0000-0000-00000000000b'),
  'backdating is allowed while the window is not full');

-- Money and draws ---------------------------------------------------------------

select pg_temp.expect_error(
  $$insert into payments (user_id, amount_cents, charity_amount_cents,
                          prize_pool_amount_cents, platform_amount_cents)
    values ('00000000-0000-0000-0000-00000000000a', 999, 100, 300, 598)$$,
  '23514', 'payment split must reconcile to the invoice');

insert into payments (user_id, amount_cents, charity_amount_cents,
                      prize_pool_amount_cents, platform_amount_cents)
values ('00000000-0000-0000-0000-00000000000a', 999, 100, 300, 599);

select pg_temp.expect_error(
  $$insert into draws (period_month, status, numbers)
    values (date_trunc('month', current_date)::date, 'published', '{1,2,3,4}')$$,
  '23514', 'a published draw needs exactly five numbers');

select pg_temp.expect_error(
  $$insert into draws (period_month) values ((date_trunc('month', current_date) + interval '3 days')::date)$$,
  '23514', 'draw period must be the first of a month');

insert into draws (period_month, status, numbers)
values ('2020-01-01', 'published', '{1,2,3,4,5}');

select pg_temp.expect_error(
  $$insert into draws (period_month, status, numbers)
    values ('2020-01-01', 'published', '{6,7,8,9,10}')$$,
  '23505', 'only one published draw per month');

insert into draws (period_month, status) values ('2020-01-01', 'simulated');

select pg_temp.expect(
  (select count(*) = 2 from draws where period_month = '2020-01-01'),
  'simulations may coexist with a published draw');

-- Publishing a draw ------------------------------------------------------------

insert into draws (id, period_month, status, numbers, pool_total_cents)
values ('00000000-0000-0000-0000-0000000000d1', '2021-03-01', 'simulated', '{1,2,3,4,5}', 10000),
       ('00000000-0000-0000-0000-0000000000d2', '2021-03-01', 'simulated', '{6,7,8,9,10}', 10000);

insert into draw_entries (draw_id, user_id, numbers, matched_count, tier, prize_cents)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', '{1,2,3,4,5}', 5, 5, 4000),
       ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b', '{1,2,9,10,11}', 2, null, 0);

select public.publish_draw('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b');

select pg_temp.expect(
  (select status = 'published' and published_at is not null from draws
   where id = '00000000-0000-0000-0000-0000000000d1'),
  'publish marks the draw published');

select pg_temp.expect(
  (select count(*) = 1 and bool_and(tier = 5 and prize_cents = 4000) from winners
   where draw_id = '00000000-0000-0000-0000-0000000000d1'),
  'publish creates a winner row only for prize-winning entries');

select pg_temp.expect(
  not exists (select 1 from draws where id = '00000000-0000-0000-0000-0000000000d2'),
  'publish discards stale simulations for the same month');

select pg_temp.expect(
  exists (select 1 from audit_log where action = 'draw.published'
          and entity_id = '00000000-0000-0000-0000-0000000000d1'),
  'publish writes an audit record');

select pg_temp.expect_error(
  $$select public.publish_draw('00000000-0000-0000-0000-0000000000d1', null)$$,
  'P0001', 'publishing twice is refused');

insert into draws (id, period_month, status, numbers)
values ('00000000-0000-0000-0000-0000000000d3', '2021-03-01', 'simulated', '{6,7,8,9,10}');

select pg_temp.expect_error(
  $$select public.publish_draw('00000000-0000-0000-0000-0000000000d3', null)$$,
  '23505', 'a second published draw for the same month is refused');

select pg_temp.expect(
  (select count(*) = 1 from winners where draw_id = '00000000-0000-0000-0000-0000000000d1'),
  'a refused publish leaves existing winners untouched');

select pg_temp.expect_error(
  $$select public.publish_draw('00000000-0000-0000-0000-0000000000ff', null)$$,
  'P0002', 'publishing an unknown draw is refused');

-- A prize for Bob, so the column-privilege checks below have a row he owns.
insert into draws (id, period_month, status, numbers)
values ('00000000-0000-0000-0000-0000000000d4', '2021-04-01', 'published', '{1,2,3,4,5}');
insert into draw_entries (id, draw_id, user_id, numbers, matched_count, tier, prize_cents)
values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d4',
        '00000000-0000-0000-0000-00000000000b', '{1,2,3,40,41}', 3, 3, 500);
insert into winners (draw_id, draw_entry_id, user_id, tier, prize_cents)
values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e3',
        '00000000-0000-0000-0000-00000000000b', 3, 500);

-- Charity bounds apply to every writer, including the service role.
select pg_temp.expect_error(
  $$update profiles set charity_percent = 5 where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', 'charity percentage below the 10% floor is rejected by the database');

select pg_temp.expect_error(
  $$update profiles set charity_percent = 90 where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', 'charity percentage above the ceiling is rejected by the database');

-- Row level security ----------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
-- Older auth.uid() definitions read the single-claim setting instead.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

select pg_temp.expect(
  (select count(*) = 0 from scores where user_id = '00000000-0000-0000-0000-00000000000a'),
  'RLS: a user cannot read another user''s scores');

select pg_temp.expect(
  (select count(*) = 1 from scores),
  'RLS: a user sees only their own scores');

select pg_temp.expect(
  (select count(*) = 0 from payments),
  'RLS: a user cannot read another user''s payments');

select pg_temp.expect(
  (select count(*) = 1 from draws where period_month = '2020-01-01'),
  'RLS: users see published draws but not simulations');

select pg_temp.expect_error(
  $$insert into scores (user_id, value, played_on)
    values ('00000000-0000-0000-0000-00000000000a', 22, current_date - 1)$$,
  '42501', 'RLS: a user cannot write a score onto another account');

-- Self-promotion: the update must be refused by the policy's WITH CHECK.
select pg_temp.expect_error(
  $$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'RLS: a user cannot promote themselves to admin');

select pg_temp.expect_error(
  $$select public.publish_draw('00000000-0000-0000-0000-0000000000d3', null)$$,
  '42501', 'a signed-in user cannot call publish_draw directly');

-- Column privileges: RLS picks rows, grants pick columns (migration 0007).
select pg_temp.expect_error(
  $$update winners set prize_cents = 99999999
    where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'a winner cannot rewrite their own prize');

select pg_temp.expect_error(
  $$update winners set verification_status = 'approved', payout_status = 'paid'
    where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'a winner cannot approve or pay themselves');

select pg_temp.expect_error(
  $$update profiles set email = 'spoof@test.local'
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'a user cannot change the email on their profile row');

select pg_temp.expect_error(
  $$update scores set user_id = '00000000-0000-0000-0000-00000000000a'
    where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'a user cannot move a score to another account');

select pg_temp.expect_error(
  $$update profiles set charity_percent = 0
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '23514', 'a user cannot set their contribution below the floor');

select pg_temp.expect_error(
  $$update profiles set stripe_customer_id = 'cus_someone_else'
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', 'RLS: a user cannot repoint their Stripe customer');

select pg_temp.expect(
  (select count(*) = 0 from stripe_events),
  'RLS: a user cannot read the Stripe event log');

-- A member can edit and delete their own scores.
update scores set value = 31 where user_id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.expect(
  (select value = 31 from scores where user_id = '00000000-0000-0000-0000-00000000000b'),
  'RLS: a user can edit their own score');

-- ...but an edit aimed at another member's score touches nothing.
update scores set value = 1 where user_id = '00000000-0000-0000-0000-00000000000a';

-- Editing a different profile matches no rows rather than erroring.
update profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';

reset role;

select pg_temp.expect(
  (select full_name = 'Alice' from profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'RLS: a user cannot edit another user''s profile');

select pg_temp.expect(
  not exists (select 1 from scores
              where user_id = '00000000-0000-0000-0000-00000000000a' and value = 1),
  'RLS: a user cannot edit another user''s scores');

-- Anonymous visitors ---------------------------------------------------------

-- A real anonymous request carries no subject claim; clear the one left over
-- from the member section above, or auth.uid() would still resolve to Bob.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';

select pg_temp.expect(
  auth.uid() is null,
  'anon requests have no user identity');

select pg_temp.expect(
  (select count(*) > 0 from public.charity_impact()),
  'anon can read aggregate charity impact');

select pg_temp.expect(
  (select count(*) = 0 from profiles),
  'RLS: anon cannot read profiles');

select pg_temp.expect(
  (select count(*) = 0 from payments),
  'RLS: anon cannot read payments');

select pg_temp.expect(
  (select count(*) = 0 from scores),
  'RLS: anon cannot read scores');

reset role;

-- Admin visibility --------------------------------------------------------------

update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
-- Older auth.uid() definitions read the single-claim setting instead.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

select pg_temp.expect(public.is_admin(), 'is_admin() recognises an admin');

select pg_temp.expect(
  (select count(*) = 5 from scores where user_id = '00000000-0000-0000-0000-00000000000a'),
  'RLS: an admin can read every user''s scores');

select pg_temp.expect(
  (select count(*) = 2 from draws where period_month = '2020-01-01'),
  'RLS: an admin sees simulations');

reset role;

select 'ALL DATABASE RULE TESTS PASSED' as result;

rollback;
