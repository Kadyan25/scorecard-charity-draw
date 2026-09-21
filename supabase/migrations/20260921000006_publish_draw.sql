-- Publishing a draw as a single transaction.
--
-- Publishing flips the draw to published, creates a winners row for every
-- prize-winning entry, discards stale simulations for the month and writes an
-- audit record. Done as separate calls from the app, a failure part-way through
-- could leave a published draw with no winners, so it lives in one function.

create or replace function public.publish_draw(p_draw_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target draws%rowtype;
  winner_count integer;
begin
  -- Row lock: two admins pressing publish at once serialise here.
  select * into target from draws where id = p_draw_id for update;

  if not found then
    raise exception 'Draw % does not exist', p_draw_id using errcode = 'P0002';
  end if;

  if target.status <> 'simulated' then
    raise exception 'Only a simulated draw can be published (this one is %)', target.status
      using errcode = 'P0001';
  end if;

  -- The partial unique index draws_one_published_per_month rejects a second
  -- published draw for the same month with SQLSTATE 23505.
  update draws set status = 'published', published_at = now() where id = p_draw_id;

  insert into winners (draw_id, draw_entry_id, user_id, tier, prize_cents)
  select draw_id, id, user_id, tier, prize_cents
  from draw_entries
  where draw_id = p_draw_id and tier is not null;
  get diagnostics winner_count = row_count;

  delete from draws
  where period_month = target.period_month
    and status <> 'published'
    and id <> p_draw_id;

  insert into audit_log (actor_id, action, entity, entity_id, meta)
  values (
    p_actor, 'draw.published', 'draw', p_draw_id,
    jsonb_build_object(
      'period_month', target.period_month,
      'numbers', target.numbers,
      'winners', winner_count,
      'pool_total_cents', target.pool_total_cents,
      'rollover_out_cents', target.rollover_out_cents
    )
  );
end;
$$;

-- Callable only by the server (service role) after it has verified the caller
-- is an admin; never directly by a browser session.
revoke all on function public.publish_draw(uuid, uuid) from public;
revoke all on function public.publish_draw(uuid, uuid) from anon, authenticated;
grant execute on function public.publish_draw(uuid, uuid) to service_role;
