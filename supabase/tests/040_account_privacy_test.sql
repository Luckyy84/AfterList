begin;
select no_plan();
-- These are all exported owner tables. Every user FK must cascade, including
-- private reauthentication state; catalog/provider rows are intentionally shared.
select ok(not exists (
 select 1 from pg_constraint c
 where c.confrelid='auth.users'::regclass and c.contype='f' and c.confdeltype <> 'c'
), 'all account-owned foreign keys cascade on auth deletion');
select has_column('public','username_history','username','export ordering uses the real username history key');
insert into storage.objects(bucket_id,name,owner_id) values
 ('avatars','d0000000-0000-0000-0000-000000000002/avatar.webp','d0000000-0000-0000-0000-000000000001');
select is((select count(*) from public.owned_storage_objects('d0000000-0000-0000-0000-000000000001',false)),0::bigint,'avatar path ownership prevents deleting another account avatar via stale owner metadata');
insert into auth.users(id) values ('d0000000-0000-0000-0000-000000000001'),('d0000000-0000-0000-0000-000000000002');
insert into public.api_tokens(user_id,name,token_hash) values
 ('d0000000-0000-0000-0000-000000000001','deleted',repeat('a',64)),
 ('d0000000-0000-0000-0000-000000000002','retained',repeat('b',64));
insert into public.watchlist_tombstones(user_id,source,external_id,removed_at) values
 ('d0000000-0000-0000-0000-000000000001','tmdb','movie:1',now()),
 ('d0000000-0000-0000-0000-000000000002','tmdb','movie:1',now());
select public.consume_account_reauth_attempt('d0000000-0000-0000-0000-000000000001');
delete from auth.users where id='d0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.api_tokens where user_id='d0000000-0000-0000-0000-000000000001'),0::bigint,'deleted account token rows removed');
select is((select count(*) from public.watchlist_tombstones where user_id='d0000000-0000-0000-0000-000000000001'),0::bigint,'deleted account removal history removed');
select is((select count(*) from private.account_reauth_attempts where user_id='d0000000-0000-0000-0000-000000000001'),0::bigint,'deleted account reauth state removed');
select is((select count(*) from public.api_tokens where user_id='d0000000-0000-0000-0000-000000000002'),1::bigint,'other account token retained');
select is((select count(*) from public.watchlist_tombstones where user_id='d0000000-0000-0000-0000-000000000002'),1::bigint,'other account removal history retained');
select * from finish();
rollback;
