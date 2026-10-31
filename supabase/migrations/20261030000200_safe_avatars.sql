-- Requires Supabase Storage schema; sanitized derivatives only, no original uploads.
-- Never publish a pre-existing bucket containing unreviewed bytes.
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'avatars') then
    raise exception 'safe_avatars requires an empty avatars bucket; review/move existing objects before deployment';
  end if;
end $$;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public bytes are deliberate: only the trusted sanitizer can insert/update/delete.
-- No anon/authenticated write policy: owner paths alone cannot guarantee sanitized bytes.
create policy avatars_owner_inventory on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Restrictive guards survive unrelated permissive policies on a shared Storage table.
create policy avatars_owner_select on storage.objects as restrictive for select to public
using (bucket_id <> 'avatars' or (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_server_insert on storage.objects as restrictive for insert to public
with check (bucket_id <> 'avatars');
create policy avatars_server_update on storage.objects as restrictive for update to public
using (bucket_id <> 'avatars') with check (bucket_id <> 'avatars');
create policy avatars_server_delete on storage.objects as restrictive for delete to public
using (bucket_id <> 'avatars');

create function public.owned_storage_objects(p_user_id uuid, p_avatars_only boolean default false)
returns table(bucket_id text, name text)
language sql security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where (not p_avatars_only or o.bucket_id = 'avatars')
    and (o.owner_id = p_user_id::text
      or (o.bucket_id = 'avatars' and split_part(o.name, '/', 1) = p_user_id::text))
  order by o.bucket_id, o.name limit 100;
$$;
revoke all on function public.owned_storage_objects(uuid, boolean) from public, anon, authenticated;
grant execute on function public.owned_storage_objects(uuid, boolean) to service_role;
