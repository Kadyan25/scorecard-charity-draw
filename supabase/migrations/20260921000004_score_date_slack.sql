-- Allow one day of slack on the "not in the future" score check.
--
-- current_date is evaluated in the database's timezone (UTC). A golfer ahead of
-- UTC - India is UTC+5:30 - logging a round shortly after local midnight would
-- otherwise have today's score rejected as "not played yet". One day covers
-- every real timezone while still refusing genuinely future dates.

alter table scores drop constraint scores_played_on_check;

alter table scores
  add constraint scores_played_on_not_future
  check (played_on <= current_date + 1);
