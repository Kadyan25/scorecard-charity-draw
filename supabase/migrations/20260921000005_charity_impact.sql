-- Charity impact figures and one-off donations via Stripe Checkout.

-- A donation is created before the donor reaches Stripe; the checkout session
-- id is how the completed payment is matched back to it.
alter table donations
  add column stripe_checkout_session_id text unique;

-- Public impact figures per charity.
--
-- Payments and profiles are private to each member under RLS, so a visitor
-- cannot aggregate them directly. This SECURITY DEFINER function exposes only
-- totals — never who gave or how much any one person gave.
create or replace function public.charity_impact()
returns table (
  charity_id    uuid,
  supporters    integer,
  raised_cents  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    (select count(*)::integer from profiles p where p.charity_id = c.id),
    coalesce((select sum(pay.charity_amount_cents) from payments pay
              where pay.charity_id_snapshot = c.id and pay.status = 'succeeded'), 0)
    + coalesce((select sum(d.amount_cents) from donations d
                where d.charity_id = c.id and d.status = 'succeeded'), 0)
  from charities c
  where c.is_active;
$$;

revoke all on function public.charity_impact() from public;
grant execute on function public.charity_impact() to anon, authenticated;

create index donations_session_idx on donations (stripe_checkout_session_id);
