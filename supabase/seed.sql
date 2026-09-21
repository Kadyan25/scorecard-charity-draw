-- Reference data for local development and for the deployed demo.
--
-- Demo users, scores and the worked draw scenario are created by
-- `npm run db:seed` (scripts/seed-demo.ts), which needs Supabase Auth to
-- register real accounts. This file holds only what is pure SQL.

insert into plans (code, name, description, amount_cents, currency, interval, sort_order)
values
  ('monthly', 'Monthly', 'Play every draw, cancel any time.',
   999, 'GBP', 'month', 1),
  ('yearly', 'Yearly', 'Two months free compared with monthly billing.',
   9990, 'GBP', 'year', 2)
on conflict (code) do nothing;

insert into charities (name, slug, tagline, description, mission, category, is_featured, is_active)
values
  (
    'Greenfield Youth Trust',
    'greenfield-youth-trust',
    'Opening the game up to kids who were never invited.',
    'Greenfield Youth Trust runs free coaching programmes in fourteen towns, giving young people access to equipment, tuition and competition that their families could not otherwise fund.',
    'Remove cost as a barrier to sport for every young person in the region.',
    'Youth',
    true,
    true
  ),
  (
    'Fairway to Recovery',
    'fairway-to-recovery',
    'Rehabilitation through routine, air and company.',
    'Fairway to Recovery partners with hospitals to run structured outdoor rehabilitation for people recovering from stroke, injury and long-term illness.',
    'Make recovery less lonely and more physical, for anyone who needs it.',
    'Health',
    false,
    true
  ),
  (
    'The Caddie Fund',
    'the-caddie-fund',
    'Backing the people who keep clubs running.',
    'The Caddie Fund provides emergency hardship grants, training bursaries and retirement support to caddies, groundstaff and club employees.',
    'No one who works in this game should face a crisis alone.',
    'Community',
    false,
    true
  ),
  (
    'Open Green Spaces',
    'open-green-spaces',
    'Protecting the land the game is played on.',
    'Open Green Spaces restores wildlife corridors, replants native species and keeps public green space genuinely public across sixty sites.',
    'Leave more living ground than we found.',
    'Environment',
    false,
    true
  ),
  (
    'Second Shot Veterans',
    'second-shot-veterans',
    'A place to land after service.',
    'Second Shot Veterans runs peer support groups, retraining and family counselling for ex-service personnel making the return to civilian life.',
    'Give every veteran a genuine second shot.',
    'Veterans',
    false,
    true
  ),
  (
    'Birdie Books',
    'birdie-books',
    'Literacy support, one child at a time.',
    'Birdie Books places trained volunteer reading mentors into primary schools in areas with the lowest literacy attainment in the country.',
    'Every child reading confidently by the time they leave primary school.',
    'Education',
    false,
    true
  )
on conflict (slug) do nothing;

insert into charity_events (charity_id, title, description, event_date, location)
select
  c.id,
  'Spring Charity Golf Day',
  'An eighteen-hole shotgun start with an auction afterwards. All proceeds go directly to the coaching programme.',
  current_date + interval '45 days',
  'Greenfield Park Course'
from charities c
where c.slug = 'greenfield-youth-trust'
on conflict do nothing;

insert into charity_events (charity_id, title, description, event_date, location)
select
  c.id,
  'Recovery Walk & Nine Holes',
  'A relaxed nine holes open to patients, families and clinicians. No handicap required.',
  current_date + interval '20 days',
  'Riverside Municipal'
from charities c
where c.slug = 'fairway-to-recovery'
on conflict do nothing;

insert into charity_events (charity_id, title, description, event_date, location)
select
  c.id,
  'Groundstaff Appreciation Open',
  'A members-versus-staff team event, with the hardship fund taking every entry fee.',
  current_date + interval '70 days',
  'Ashcombe Links'
from charities c
where c.slug = 'the-caddie-fund'
on conflict do nothing;
