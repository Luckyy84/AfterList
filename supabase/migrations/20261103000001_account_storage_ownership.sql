-- Avatar ownership follows the same server-controlled UUID path as delivery and
-- inventory policies. A stale owner_id must not delete a different user's path.
create or replace function public.owned_storage_objects(p_user_id uuid, p_avatars_only boolean default false)
returns table(bucket_id text, name text)
language sql security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where (not p_avatars_only or o.bucket_id = 'avatars')
    and case when o.bucket_id = 'avatars'
      then split_part(o.name, '/', 1) = p_user_id::text
      else o.owner_id = p_user_id::text end
  order by o.bucket_id, o.name limit 100;
$$;
revoke all on function public.owned_storage_objects(uuid, boolean) from public, anon, authenticated;
grant execute on function public.owned_storage_objects(uuid, boolean) to service_role;
