-- Column-level write protection.
--
-- Row level security decides WHICH rows a member may update, not WHICH
-- columns. Because members hold a JWT that works against the database API
-- directly (the anon key is public by design), any column on a row they can
-- update was writable — including their own prize amount and a charity
-- percentage outside the allowed range. This migration closes that.

-- Winners: members never write to this table. Proof submission goes through
-- the server, which checks ownership and state before writing with the
-- service role.
drop policy if exists "winners submit own proof" on winners;
revoke insert, update, delete on winners from authenticated, anon;

-- Profiles: only the fields a member genuinely owns are writable.
revoke update on profiles from authenticated, anon;
grant update (full_name, charity_id, charity_percent) on profiles to authenticated;

-- Scores: members edit the value and date, nothing else.
revoke update on scores from authenticated, anon;
grant update (value, played_on) on scores to authenticated;

-- Charity percentage bounds live in settings (a 10% floor, plus a ceiling that
-- keeps the prize pool fundable). Enforcing them here means no path — API,
-- direct REST call or admin tool — can store a value the invoice split would
-- later reject.
create or replace function public.enforce_charity_percent_bounds()
returns trigger
language plpgsql
as $$
declare
  min_pct  integer := coalesce(public.setting_int('charity_percent_min'), 10);
  max_pct  integer := coalesce(public.setting_int('charity_percent_max'), 50);
  pool_pct integer := coalesce(public.setting_int('prize_pool_percent'), 30);
begin
  if new.charity_percent < min_pct or new.charity_percent > max_pct then
    raise exception 'Charity contribution must be between % and % percent', min_pct, max_pct
      using errcode = 'check_violation';
  end if;
  if new.charity_percent + pool_pct > 100 then
    raise exception 'Charity contribution would leave nothing for the prize pool'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_charity_percent_bounds
  before update of charity_percent on profiles
  for each row
  when (new.charity_percent is distinct from old.charity_percent)
  execute function public.enforce_charity_percent_bounds();
