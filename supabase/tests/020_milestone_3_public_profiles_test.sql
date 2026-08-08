begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('c1000000-0000-4000-8000-000000000001', 'profile-a@example.test'),
  ('c2000000-0000-4000-8000-000000000002', 'profile-b@example.test');

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'reserved_usernames', 'reserved username table exists');
select has_table('public', 'username_history', 'username history table exists');
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'u'
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'username')]::smallint[]
  ),
  'database uniqueness serializes concurrent username claims'
);
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.username_history'::regclass), 'username history has RLS enabled');
select ok(to_regprocedure('public.claim_profile_username(text)') is not null, 'username claim RPC exists');
select ok(to_regprocedure('public.get_public_profile(text)') is not null, 'public profile RPC exists');
select ok(to_regprocedure('public.get_public_library(text,integer,integer)') is not null, 'public library RPC exists');
select ok(to_regprocedure('public.get_public_list(text,text,integer,integer)') is not null, 'public list RPC exists');
select ok(has_function_privilege('anon', 'public.get_public_profile(text)', 'execute'), 'anon can execute curated profile RPC');
select ok(not has_function_privilege('anon', 'public.claim_profile_username(text)', 'execute'), 'anon cannot claim usernames');
select ok(not has_function_privilege('authenticated', 'private.resolve_public_username(text)', 'execute'), 'private resolver is not client-callable');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  public.claim_profile_username('  MiXeD_Name  ')->>'username',
  'mixed_name',
  'username claims trim and normalize case'
);
select throws_ok(
  $$ update public.profiles set username = 'forged_name' where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '42501',
  'direct username mutation is blocked'
);
select lives_ok(
  $$ update public.profiles set username = 'mixed_name', display_name = 'Profile A' where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  'owner may save an unchanged username with other profile fields'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Profile A', bio = 'Public biography',
       external_links = '[{"label":"Website","url":"https://example.test/a"}]'::jsonb
     where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  'owner profile accepts the client external-link array contract'
);
select lives_ok(
  $$ update public.profiles set avatar_url = 'https://cdn.example.test/avatar.png' where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  'absolute HTTPS avatar is accepted'
);
select lives_ok(
  $$ update public.profiles set avatar_url = '' where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  'empty avatar is accepted as no avatar'
);
select throws_ok(
  $$ update public.profiles set avatar_url = 'javascript:alert(1)' where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'non-http avatar URL is rejected'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":"Bad","url":"javascript:alert(1)"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'javascript external link is rejected'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":"Bad","url":"data:text/html,bad"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'data external link is rejected'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":"Bad","url":"https://example.test","extra":"leak"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'external link rejects extra object keys'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":7,"url":"https://example.test"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'external link label must be a string'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":"","url":"https://example.test"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'external link label cannot be empty'
);
select throws_ok(
  $$ update public.profiles set external_links = '[{"label":"1","url":"https://1.test"},{"label":"2","url":"https://2.test"},{"label":"3","url":"https://3.test"},{"label":"4","url":"https://4.test"},{"label":"5","url":"https://5.test"},{"label":"6","url":"https://6.test"},{"label":"7","url":"https://7.test"},{"label":"8","url":"https://8.test"},{"label":"9","url":"https://9.test"}]'::jsonb where user_id = 'c1000000-0000-4000-8000-000000000001' $$,
  '23514',
  'external links are capped at eight entries'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.claim_profile_username('second_user')->>'username', 'second_user', 'second owner can claim a distinct username');
select throws_ok($$ select public.claim_profile_username('MIXED_NAME') $$, '23505', 'case-normalized username uniqueness prevents a competing claim');
select throws_ok($$ select public.claim_profile_username('Admin') $$, '23505', 'reserved usernames are rejected case-insensitively');
select throws_ok($$ select public.claim_profile_username('../bad') $$, '22023', 'invalid username syntax is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.claim_profile_username('current_name')->>'changed', 'true', 'renaming records a changed claim');
select is(
  (select user_id::text from public.username_history where username = 'mixed_name'),
  'c1000000-0000-4000-8000-000000000001',
  'old username is retained for its owner'
);
select ok(
  (select redirect_until > now() + interval '89 days' from public.username_history where username = 'mixed_name'),
  'rename redirect is retained for approximately 90 days'
);

select is((select count(*) from public.profiles), 1::bigint, 'owner A sees only their raw profile row');
select is((select count(*) from public.username_history), 1::bigint, 'owner A sees only their username history');
select throws_ok($$ select count(*) from public.reserved_usernames $$, '42501', 'authenticated clients cannot read the reserved-name table');
select results_eq(
  $$ update public.profiles set display_name = 'Forged by A' where user_id = 'c2000000-0000-4000-8000-000000000002' returning display_name $$,
  $$ select null::text where false $$,
  'forged owner filters cannot update another profile'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'owner B sees only their raw profile row');
select is((select count(*) from public.username_history), 0::bigint, 'owner B cannot read owner A history');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select count(*) from public.profiles $$, '42501', 'anon cannot read the raw profiles table');
select throws_ok($$ select count(*) from public.username_history $$, '42501', 'anon cannot read raw username history');
select is(public.get_public_profile('current_name'), null::jsonb, 'private profile is indistinguishable from unavailable');
select is(public.get_public_profile('missing_user'), null::jsonb, 'missing profile returns the same null contract');
select is(public.get_public_profile('second_user'), null::jsonb, 'another private profile uses the same null contract');

reset role;
update public.profiles set is_public = true where user_id = 'c1000000-0000-4000-8000-000000000001';
insert into public.watchlist_items (
  id, user_id, external_id, source, title, type, status, poster, backdrop, progress, rating,
  description, year, current_episode, total_episodes, personal_rating, is_favorite, private_notes, updated_at
) values
  ('c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'movie:101', 'tmdb', 'Public Favorite', 'Movie', 'Watched', '', '', 'Watched', '8.0', 'Provider description', '2024', 0, null, 9, true, 'owner A secret note', '2026-08-08T01:00:00Z'),
  ('c4000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000002', 'movie:202', 'tmdb', 'Owner B Private', 'Movie', 'Planned', '', '', '2025', 'N/A', '', '2025', 0, null, null, true, 'owner B secret note', '2026-08-08T02:00:00Z');
insert into public.api_tokens (id, user_id, name, token_hash, scopes)
values ('c5000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'Never public', repeat('c', 64), array['watchlist:read']::text[]);
insert into public.custom_lists (id, user_id, name, slug, is_public, sort_order) values
  ('c6000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', 'Public Picks', 'public-picks', true, 0),
  ('c7000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', 'Private Drafts', 'private-drafts', false, 1);
insert into public.custom_list_items (list_id, watchlist_item_id, user_id, position) values
  ('c6000000-0000-4000-8000-000000000006', 'c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 0),
  ('c7000000-0000-4000-8000-000000000007', 'c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 0);

set local role anon;
select is(public.get_public_profile('current_name')->>'username', 'current_name', 'public profile exposes the canonical username');
select is(public.get_public_profile('current_name')->'stats', null::jsonb, 'disabled statistics are omitted');
select is(public.get_public_profile('current_name')->'favorites', null::jsonb, 'disabled favorites are omitted');
select is(public.get_public_library('current_name', 50, 0), null::jsonb, 'disabled public library returns the unavailable contract');
select is(public.get_public_library('missing_user', 50, 0), null::jsonb, 'missing library uses the same unavailable contract');
select is(public.get_public_list('second_user', 'public-picks', 50, 0), null::jsonb, 'private profile list is unavailable');
select is(public.get_public_list('missing_user', 'public-picks', 50, 0), null::jsonb, 'missing profile list is identically unavailable');

reset role;
update public.profiles set show_library = true, show_favorites = true, show_stats = true
where user_id = 'c1000000-0000-4000-8000-000000000001';

set local role anon;
select is((public.get_public_profile('current_name')->'stats'->>'total')::bigint, 1::bigint, 'public statistics count only active owner rows');
select is(jsonb_array_length(public.get_public_profile('current_name')->'favorites'), 1, 'public favorites include only owner A favorites');
select ok(
  not (public.get_public_profile('current_name')::text ~* '(email|profile-a@example|profile-b@example|owner A secret note|owner B secret note|token_hash|private_?notes|watchlist_events|api_tokens|user_?id|Private Drafts)'),
  'public profile explicitly redacts identity, notes, events, tokens, and private lists'
);
select is(
  public.get_public_profile('current_name')->'lists',
  '[{"name":"Public Picks","slug":"public-picks"}]'::jsonb,
  'profile enumerates curated public lists only'
);
select is(jsonb_array_length(public.get_public_library('current_name', 50, 0)->'items'), 1, 'enabled public library returns owner items');
select ok(
  not (public.get_public_library('current_name', 50, 0)::text ~* '(email|user_?id|private_?notes|owner A secret note|watchlist_events|api_tokens|merged_?into_?id|merge_?reason|media_?id)'),
  'public library item projection excludes private and internal fields'
);
select is(
  public.get_public_library('current_name', 50, 0)->'items'->0->>'id',
  'tmdb:movie:101',
  'public cards use a synthetic provider identity rather than the private database UUID'
);
select ok(
  (public.get_public_library('current_name', 50, 0)->'items'->0) ?& array[
    'id','externalId','source','title','type','status','poster','backdrop','year','progress','rating',
    'description','currentEpisode','totalEpisodes','runtimeMinutes','personalRating','isFavorite','updatedAt'
  ],
  'public library projection includes every safe card field explicitly'
);
select is(jsonb_array_length(public.get_public_list('current_name', 'public-picks', 50, 0)->'items'), 1, 'public list returns its visible item');
select is(public.get_public_list('current_name', 'private-drafts', 50, 0), null::jsonb, 'private list uses unavailable contract');
select is(public.get_public_list('current_name', 'missing-list', 50, 0), null::jsonb, 'missing list is indistinguishable from private list');
select ok(
  not (public.get_public_list('current_name', 'public-picks', 50, 0)::text ~* '(email|user_?id|private_?notes|owner A secret note|watchlist_events|api_tokens|merged_?into_?id|merge_?reason|media_?id|Private Drafts)'),
  'public list projection redacts private item fields and private list metadata'
);
select ok(to_regprocedure('public.get_public_profile(text,uuid)') is null, 'public profile RPC has no forgeable owner-id overload');

select is(public.get_public_profile('mixed_name')->>'redirectUsername', 'current_name', 'unexpired old username resolves to canonical redirect');

reset role;
update public.username_history set redirect_until = now() - interval '1 second' where username = 'mixed_name';

set local role anon;
select is(public.get_public_profile('mixed_name'), null::jsonb, 'expired username redirect becomes unavailable');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.claim_profile_username('MIXED_NAME')->>'username', 'mixed_name', 'expired old username can be reclaimed case-insensitively');

select * from finish();
rollback;
