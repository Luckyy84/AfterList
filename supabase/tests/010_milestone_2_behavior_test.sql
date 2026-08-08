begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

create function pg_temp.add_watchlist_item(
  p_id uuid,
  p_user_id uuid,
  p_source text,
  p_external_id text,
  p_title text,
  p_status text,
  p_rewatch_count integer,
  p_started_on date,
  p_completed_on date
) returns uuid
language sql
set search_path = ''
as $$
  insert into public.watchlist_items (
    id, user_id, external_id, source, title, type, status, poster, backdrop,
    progress, rating, description, year, current_episode, total_episodes,
    runtime_minutes, personal_rating, is_favorite, updated_at,
    rewatch_count, started_on, completed_on, private_notes
  ) values (
    p_id, p_user_id, p_external_id, p_source, p_title, 'Anime', p_status, '', '',
    '2018', '8.0', 'Milestone 2 test item', '2018', 0, 24,
    24, null, false, now(), p_rewatch_count, p_started_on, p_completed_on, ''
  ) returning id;
$$;

-- Exact backfill replay: two legacy rows with one provider identity must converge once,
-- and a second pass must not create another entity or alias.
select pg_temp.add_watchlist_item('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tmdb', 'movie:900001', 'Backfill Fixture', 'Planned', 0, null, null);
select pg_temp.add_watchlist_item('10000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'tmdb', 'movie:900001', 'Backfill Fixture', 'Planned', 0, null, null);
create temporary table backfill_original as
  select distinct media_id from public.watchlist_items where external_id = 'movie:900001';
alter table public.watchlist_items disable trigger watchlist_resolve_media_id;
update public.watchlist_items set media_id = null where external_id = 'movie:900001';
delete from public.media_aliases where provider = 'tmdb' and external_id = 'movie:900001';
delete from public.media_entities where id in (select media_id from backfill_original);

do $$
declare identity record; resolved_media_id uuid;
begin
  for identity in
    select source, external_id, min(type) as media_type
    from public.watchlist_items
    where external_id = 'movie:900001'
    group by source, external_id
  loop
    select media_id into resolved_media_id from public.media_aliases
      where provider = identity.source and external_id = identity.external_id;
    if resolved_media_id is null then
      insert into public.media_entities(media_type) values (identity.media_type) returning id into resolved_media_id;
      insert into public.media_aliases(media_id, provider, external_id, provenance)
        values (resolved_media_id, identity.source, identity.external_id, 'primary');
    end if;
    update public.watchlist_items set media_id = resolved_media_id
      where source = identity.source and external_id = identity.external_id and media_id is null;
  end loop;
end $$;
alter table public.watchlist_items enable trigger watchlist_resolve_media_id;

select is(
  (select count(distinct media_id) from public.watchlist_items where external_id = 'movie:900001'),
  1::bigint,
  'backfill maps every exact provider identity to one canonical entity'
);
select is(
  (select count(*) from public.media_aliases where provider = 'tmdb' and external_id = 'movie:900001'),
  1::bigint,
  'backfill creates exactly one provider alias'
);
create temporary table backfill_counts as
  select
    (select count(*) from public.media_entities) as entity_count,
    (select count(*) from public.media_aliases) as alias_count;

do $$
declare identity record; resolved_media_id uuid;
begin
  for identity in
    select source, external_id, min(type) as media_type
    from public.watchlist_items
    where external_id = 'movie:900001'
    group by source, external_id
  loop
    select media_id into resolved_media_id from public.media_aliases
      where provider = identity.source and external_id = identity.external_id;
    if resolved_media_id is null then
      insert into public.media_entities(media_type) values (identity.media_type) returning id into resolved_media_id;
      insert into public.media_aliases(media_id, provider, external_id, provenance)
        values (resolved_media_id, identity.source, identity.external_id, 'primary');
    end if;
    update public.watchlist_items set media_id = resolved_media_id
      where source = identity.source and external_id = identity.external_id and media_id is null;
  end loop;
end $$;

select is(
  (select count(*) from public.media_entities),
  (select entity_count from backfill_counts),
  'replaying the exact backfill creates no extra canonical entity'
);
select is(
  (select count(*) from public.media_aliases),
  (select alias_count from backfill_counts),
  'replaying the exact backfill creates no extra provider alias'
);

insert into public.media_entities(id, media_type)
values ('15000000-0000-4000-8000-000000000001', 'Movie');
select throws_ok(
  $$ insert into public.media_aliases(media_id, provider, external_id) values ('15000000-0000-4000-8000-000000000001', 'tmdb', 'movie:900001') $$,
  '23505',
  'the same provider identity cannot point at two canonical entities'
);

-- Same title/year across providers remains separate until the user confirms it.
select pg_temp.add_watchlist_item('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'tmdb', 'tv:700', 'Shared Title', 'Paused', 1, '2026-01-01', null);
select pg_temp.add_watchlist_item('20000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anilist', '700', 'Shared Title', 'Watching', 2, '2026-02-01', null);
select isnt(
  (select media_id from public.watchlist_items where id = '20000000-0000-4000-8000-000000000001'),
  (select media_id from public.watchlist_items where id = '20000000-0000-4000-8000-000000000002'),
  'title and year similarity never fuzzy-merges canonical identities'
);
select is(
  (select count(*) from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null),
  2::bigint,
  'both probable duplicates remain active before a decision'
);

select lives_ok(
  $$ select pg_temp.add_watchlist_item('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anilist', '701', 'Paused Fixture', 'Paused', 0, null, null) $$,
  'Paused is accepted as a tracking status'
);
select throws_ok(
  $$ select pg_temp.add_watchlist_item('30000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anilist', '702', 'Bad Rewatch', 'Watching', -1, null, null) $$,
  '23514',
  'negative rewatch counts are rejected'
);
select throws_ok(
  $$ select pg_temp.add_watchlist_item('30000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anilist', '703', 'Bad Dates', 'Watched', 0, '2026-03-01', '2026-02-01') $$,
  '23514',
  'completion cannot precede the start date'
);

insert into public.custom_lists (id, user_id, name, slug)
values ('40000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner A List', 'owner-a-list');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.custom_lists where id = '40000000-0000-4000-8000-000000000001'), 0::bigint, 'user B cannot read owner A custom lists');
select is(
  (with changed as (update public.custom_lists set name = 'Stolen' where id = '40000000-0000-4000-8000-000000000001' returning 1) select count(*) from changed),
  0::bigint,
  'user B cannot update owner A custom lists'
);
select throws_ok(
  $$ insert into public.custom_list_items(list_id, watchlist_item_id, user_id) values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '23503',
  'cross-owner list membership is rejected by composite ownership keys'
);
select is((select count(*) from public.watchlist_events where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'user B cannot read owner A events');
select is((select count(*) from public.user_media_match_decisions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'user B cannot read owner A match decisions');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.watchlist_events $$, '42501', 'anon cannot read private watchlist events');
select throws_ok($$ select count(*) from public.custom_lists $$, '42501', 'anon cannot read custom lists');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select count(*) from public.custom_lists where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'owner A can read their custom list');
select lives_ok(
  $$ insert into public.custom_list_items(list_id, watchlist_item_id, user_id) values ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  'owner A can add their own item to their own list'
);

select is(
  (public.reject_media_match('tmdb', 'tv:700', 'anilist', '700')->>'decision'),
  'rejected',
  'reject RPC records an explicit rejection'
);
select is(
  (select decision from public.user_media_match_decisions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and alias_a = 'anilist:700' and alias_b = 'tmdb:tv:700'),
  'rejected',
  'reject decision stores the normalized alias pair'
);
select is(
  (select count(*) from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null),
  2::bigint,
  'rejecting a match performs no merge write'
);

reset role;
update public.watchlist_items set current_episode = 8, is_favorite = true, private_notes = 'TMDB note', updated_at = '2026-03-01'
  where id = '20000000-0000-4000-8000-000000000001';
update public.watchlist_items set current_episode = 4, private_notes = 'AniList note', updated_at = '2026-04-01'
  where id = '20000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(
  (public.confirm_media_match('tmdb', 'tv:700', 'anilist', '700')->>'decision'),
  'confirmed',
  'confirm RPC records an explicit confirmation'
);
select is((select decision from public.user_media_match_decisions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and alias_a = 'anilist:700' and alias_b = 'tmdb:tv:700'), 'confirmed', 'confirmation replaces the prior rejection');
select is((select count(*) from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null), 1::bigint, 'confirmation leaves exactly one active item');
select is((select max(current_episode) from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null), 8, 'confirmation preserves maximum progress');
select ok((select is_favorite from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null), 'confirmation preserves favorites');
select ok((select private_notes like '%TMDB note%' and private_notes like '%AniList note%' from public.watchlist_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Shared Title' and merged_into_id is null), 'confirmation preserves both private notes');
select is((select count(*) from public.custom_list_items where list_id = '40000000-0000-4000-8000-000000000001'), 1::bigint, 'confirmation moves custom-list membership to the winner');
select ok((select count(*) > 0 from public.watchlist_events where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_type = 'merged'), 'merge produces a private audit event');
select ok(
  not exists (
    select 1 from public.watchlist_events
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and (coalesce(old_value, '{}'::jsonb)::text like '%TMDB note%'
        or coalesce(old_value, '{}'::jsonb)::text like '%AniList note%'
        or coalesce(new_value, '{}'::jsonb)::text like '%TMDB note%'
        or coalesce(new_value, '{}'::jsonb)::text like '%AniList note%')
  ),
  'event payloads never copy private note bodies'
);

reset role;
insert into public.api_tokens(id, user_id, name, token_hash, scopes)
values (
  '50000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Legacy v1 fixture',
  repeat('a', 64),
  array['watchlist:read', 'watchlist:write']::text[]
);
select lives_ok(
  $$ select public.upsert_watchlist_from_api(repeat('a', 64), '{
    "external_id":"movie:8800",
    "source":"tmdb",
    "title":"Legacy v1 Movie",
    "type":"Movie",
    "status":"Planned",
    "poster":"",
    "backdrop":"",
    "progress":"2026",
    "rating":"N/A",
    "description":"Legacy payload without Milestone 2 fields",
    "year":"2026",
    "current_episode":0,
    "updated_at":"2026-08-08T00:00:00.000Z"
  }'::jsonb) $$,
  'the retained v1 RPC accepts a legacy payload without additive fields'
);
select is(
  (select count(*) from public.watchlist_items where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and source = 'tmdb' and external_id = 'movie:8800'),
  1::bigint,
  'legacy v1 upsert still creates exactly one watchlist row'
);
select ok(
  (select media_id is not null and rewatch_count = 0 and not is_rewatching
    from public.watchlist_items
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and source = 'tmdb' and external_id = 'movie:8800'),
  'legacy v1 writes receive canonical identity and safe tracking defaults'
);

select * from finish();
rollback;
