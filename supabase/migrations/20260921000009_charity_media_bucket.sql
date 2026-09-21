-- Public bucket for charity photography.
--
-- Created up front rather than on first upload: a bucket created mid-request
-- was not served publicly straight away, so the first cover photo on a fresh
-- project could briefly appear broken.
--
-- On a fresh local stack this migration can run before storage-api has added
-- the `public` column, hence the guard; the app then marks the bucket public
-- the first time it is used (see ensureMediaBucket).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public'
  ) then
    insert into storage.buckets (id, name, public)
    values ('charity-media', 'charity-media', true)
    on conflict (id) do update set public = true;
  else
    insert into storage.buckets (id, name)
    values ('charity-media', 'charity-media')
    on conflict (id) do nothing;
  end if;
end;
$$;
