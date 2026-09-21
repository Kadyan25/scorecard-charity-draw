-- Row level security.
--
-- Every table is locked by default. Subscribers touch only their own rows;
-- admins go through public.is_admin(), which is SECURITY DEFINER so it does not
-- recurse back through the policies that call it.
--
-- Note: the service-role key bypasses RLS entirely. Server code that must write
-- on a user's behalf (Stripe webhooks, draw publishing) uses it deliberately and
-- is never reachable from a browser.

alter table settings       enable row level security;
alter table charities      enable row level security;
alter table charity_events enable row level security;
alter table profiles       enable row level security;
alter table plans          enable row level security;
alter table subscriptions  enable row level security;
alter table payments       enable row level security;
alter table donations      enable row level security;
alter table scores         enable row level security;
alter table draws          enable row level security;
alter table draw_entries   enable row level security;
alter table winners        enable row level security;
alter table audit_log      enable row level security;

-- --------------------------------------------------------------------------
-- Public reference data - readable by anyone, including anonymous visitors
-- (PRD section 03: a public visitor explores charities and draw mechanics).
-- --------------------------------------------------------------------------

create policy "charities are publicly readable"
  on charities for select using (is_active or public.is_admin());

create policy "admins manage charities"
  on charities for all using (public.is_admin()) with check (public.is_admin());

create policy "charity events are publicly readable"
  on charity_events for select using (true);

create policy "admins manage charity events"
  on charity_events for all using (public.is_admin()) with check (public.is_admin());

create policy "active plans are publicly readable"
  on plans for select using (is_active or public.is_admin());

create policy "admins manage plans"
  on plans for all using (public.is_admin()) with check (public.is_admin());

create policy "settings are publicly readable"
  on settings for select using (true);

create policy "admins manage settings"
  on settings for all using (public.is_admin()) with check (public.is_admin());

-- Published draw results are public; drafts and simulations are admin-only.
create policy "published draws are publicly readable"
  on draws for select using (status = 'published' or public.is_admin());

create policy "admins manage draws"
  on draws for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Profiles
-- --------------------------------------------------------------------------

create policy "users read own profile"
  on profiles for select using (id = auth.uid() or public.is_admin());

-- Role is deliberately excluded from what a user may change: the WITH CHECK
-- clause pins it to the value already stored, so nobody can self-promote.
create policy "users update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles p where p.id = auth.uid())
  );

create policy "admins manage profiles"
  on profiles for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Billing - readable by the owner, written only by server-side code
-- --------------------------------------------------------------------------

create policy "users read own subscriptions"
  on subscriptions for select using (user_id = auth.uid() or public.is_admin());

create policy "admins manage subscriptions"
  on subscriptions for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own payments"
  on payments for select using (user_id = auth.uid() or public.is_admin());

create policy "admins manage payments"
  on payments for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own donations"
  on donations for select using (user_id = auth.uid() or public.is_admin());

create policy "admins manage donations"
  on donations for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Scores - the one table subscribers write to directly
-- --------------------------------------------------------------------------

create policy "users read own scores"
  on scores for select using (user_id = auth.uid() or public.is_admin());

-- user_id is pinned to the session, so a forged body cannot write to another
-- account even if it reaches the database directly.
create policy "users insert own scores"
  on scores for insert with check (user_id = auth.uid());

create policy "users update own scores"
  on scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own scores"
  on scores for delete using (user_id = auth.uid());

create policy "admins manage scores"
  on scores for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Draw entries and winners
-- --------------------------------------------------------------------------

-- Entries are visible to their owner once the draw is published, and to admins
-- at any stage. Keeping unpublished entries hidden stops a subscriber inferring
-- a simulation result before the admin publishes it.
create policy "users read own published entries"
  on draw_entries for select using (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from draws d
        where d.id = draw_entries.draw_id and d.status = 'published'
      )
    )
  );

create policy "admins manage draw entries"
  on draw_entries for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own winnings"
  on winners for select using (user_id = auth.uid() or public.is_admin());

-- A winner may attach proof to their own row. Everything else on the row -
-- verification outcome, payout state, prize amount - is admin-only, so the
-- update is constrained to rows that have not yet been reviewed.
create policy "winners submit own proof"
  on winners for update
  using (user_id = auth.uid() and verification_status in ('not_submitted', 'rejected'))
  with check (user_id = auth.uid() and verification_status = 'pending');

create policy "admins manage winners"
  on winners for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Audit log - admin read only; writes go through the service role
-- --------------------------------------------------------------------------

create policy "admins read audit log"
  on audit_log for select using (public.is_admin());

-- --------------------------------------------------------------------------
-- Storage - winner proof screenshots
-- --------------------------------------------------------------------------

-- Only (id, name) are set: storage-api adds the `public` column in its own
-- migrations, which may not have run yet when this file applies locally. The
-- column defaults to false, which is exactly what a proof bucket must be.
insert into storage.buckets (id, name)
values ('winner-proof', 'winner-proof')
on conflict (id) do nothing;

-- Objects are namespaced by user id: winner-proof/<user_id>/<file>. The folder
-- check is what stops one winner reading another's submission.
create policy "winners upload own proof"
  on storage.objects for insert
  with check (
    bucket_id = 'winner-proof'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "winners read own proof"
  on storage.objects for select
  using (
    bucket_id = 'winner-proof'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "admins manage proof objects"
  on storage.objects for all
  using (bucket_id = 'winner-proof' and public.is_admin())
  with check (bucket_id = 'winner-proof' and public.is_admin());
