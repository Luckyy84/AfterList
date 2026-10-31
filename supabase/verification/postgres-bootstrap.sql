-- Standalone PostgreSQL test harness, NOT an application migration.
-- Minimal Supabase auth contract for SQL-only regression tests, not GoTrue emulation.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key, email text, instance_id uuid, aud text, role text, encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
create extension pgtap;
-- Minimal Storage catalog for policy tests; bytes/API behavior needs disposable Supabase.
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text, owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
