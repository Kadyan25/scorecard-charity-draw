-- Aggregates for the admin reports (PRD 11: total users, total prize pool,
-- charity contribution totals, draw statistics).
--
-- Computed in the database so the report reads a handful of numbers instead of
-- shipping every payment and winner row to the app server. Callable only by the
-- service role, after the server has verified the caller is an admin.

create or replace function public.admin_report()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'members', (select count(*) from profiles where role = 'user'),
    'admins',  (select count(*) from profiles where role = 'admin'),

    'payments', (
      select jsonb_build_object(
        'count', count(*),
        'gross', coalesce(sum(amount_cents), 0),
        'charity', coalesce(sum(charity_amount_cents), 0),
        'prize_pool', coalesce(sum(prize_pool_amount_cents), 0),
        'platform', coalesce(sum(platform_amount_cents), 0))
      from payments where status = 'succeeded'),

    'donations', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(amount_cents), 0))
      from donations where status = 'succeeded'),

    'draws', (
      select jsonb_build_object(
        'published', count(*),
        'pool_total', coalesce(sum(pool_total_cents), 0),
        'charity_bonus', coalesce(sum(charity_bonus_cents), 0),
        'entries', coalesce(sum(eligible_entry_count), 0),
        'jackpots_unclaimed', count(*) filter (
          where not exists (select 1 from winners w where w.draw_id = d.id and w.tier = 5)))
      from draws d where d.status = 'published'),

    'winners', (
      select jsonb_build_object(
        'count', count(*),
        'prize_total', coalesce(sum(prize_cents), 0),
        'paid_total', coalesce(sum(prize_cents) filter (where payout_status = 'paid'), 0),
        'tier5', count(*) filter (where tier = 5),
        'tier4', count(*) filter (where tier = 4),
        'tier3', count(*) filter (where tier = 3),
        'awaiting_proof', count(*) filter (where verification_status in ('not_submitted', 'rejected')),
        'awaiting_review', count(*) filter (where verification_status = 'pending'),
        'awaiting_payout', count(*) filter (where verification_status = 'approved' and payout_status = 'pending'))
      from winners),

    'charities', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'is_active', c.is_active,
        'supporters', (select count(*) from profiles p where p.charity_id = c.id),
        'from_subscriptions', (select coalesce(sum(pay.charity_amount_cents), 0) from payments pay
                               where pay.charity_id_snapshot = c.id and pay.status = 'succeeded'),
        'from_donations', (select coalesce(sum(dn.amount_cents), 0) from donations dn
                           where dn.charity_id = c.id and dn.status = 'succeeded')
      ) order by c.name), '[]'::jsonb)
      from charities c),

    'recent_draws', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.period_month desc), '[]'::jsonb)
      from (
        select d.id, d.period_month, d.mode, d.eligible_entry_count as entries, d.pool_total_cents,
               d.rollover_out_cents, d.charity_bonus_cents,
               (select count(*) from winners w where w.draw_id = d.id and w.tier = 5) as tier5,
               (select count(*) from winners w where w.draw_id = d.id and w.tier = 4) as tier4,
               (select count(*) from winners w where w.draw_id = d.id and w.tier = 3) as tier3
        from draws d where d.status = 'published'
        order by d.period_month desc limit 12
      ) r)
  );
$$;

revoke all on function public.admin_report() from public;
revoke all on function public.admin_report() from anon, authenticated;
grant execute on function public.admin_report() to service_role;
