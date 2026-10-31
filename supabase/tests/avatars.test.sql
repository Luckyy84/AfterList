begin;
select plan(11);
select is((select public from storage.buckets where id='avatars'), true, 'sanitized avatars have public byte delivery');
select is((select allowed_mime_types from storage.buckets where id='avatars'), array['image/webp'], 'bucket accepts only sanitized output');
select ok(not has_function_privilege('authenticated', 'public.owned_storage_objects(uuid,boolean)', 'EXECUTE'), 'no browser inventory RPC');
select ok(not has_function_privilege('anon', 'public.owned_storage_objects(uuid,boolean)', 'EXECUTE'), 'no anon inventory RPC');
select ok(has_function_privilege('service_role', 'public.owned_storage_objects(uuid,boolean)', 'EXECUTE'), 'service inventory allowed');
insert into storage.objects(bucket_id,name,owner_id) values ('avatars','11111111-1111-1111-1111-111111111111/a.webp',null), ('avatars','22222222-2222-2222-2222-222222222222/b.webp',null);
select is((select count(*) from public.owned_storage_objects('11111111-1111-1111-1111-111111111111',true)),1::bigint,'service-created object owned by path');
-- A permissive legacy policy cannot let browser clients bypass sanitization.
create policy avatar_test_legacy_write on storage.objects for all to authenticated using (true) with check (true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select is((select count(*) from storage.objects where bucket_id='avatars'),1::bigint,'owner can list only own paths even with legacy policy');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('avatars','11111111-1111-1111-1111-111111111111/raw.webp')$$,'42501',null,'even owner cannot upload unsanitized bytes');
select results_eq($$with changed as (update storage.objects set name='evil.webp' where bucket_id='avatars' returning *) select count(*) from changed$$, array[0::bigint], 'browser cannot replace sanitized objects');
-- Native Supabase also rejects SQL DELETE before row policies via protect_delete.
-- Keep that protection enabled; the minimal PostgreSQL harness has no such trigger.
select case when to_regprocedure('storage.protect_delete()') is not null then
  throws_ok($$delete from storage.objects where bucket_id='avatars'$$, '42501', 'Direct deletion from storage tables is not allowed. Use the Storage API instead.', 'native Storage rejects direct browser deletion')
else
  results_eq($$with removed as (delete from storage.objects where bucket_id='avatars' returning *) select count(*) from removed$$, array[0::bigint], 'browser cannot delete another avatar')
end;
reset role;
select is((select count(*) from storage.objects where bucket_id='avatars'),2::bigint,'objects retained after unauthorized writes');
select * from finish();
rollback;
