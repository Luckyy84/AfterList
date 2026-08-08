-- This file restores the migration version already recorded in production.
-- Every statement is idempotent so it bootstraps an empty local database and is
-- also safe when migration history or the deployed table already exists.
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  source text not null,
  title text not null,
  type text not null,
  status text not null,
  poster text not null default '',
  backdrop text not null default '',
  progress text not null default '',
  rating text not null default 'N/A',
  description text not null default '',
  year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and contype='p') then
    alter table public.watchlist_items add constraint watchlist_items_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_user_id_fkey') then
    alter table public.watchlist_items add constraint watchlist_items_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_external_id_check') then
    alter table public.watchlist_items add constraint watchlist_items_external_id_check check (char_length(external_id) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_source_check') then
    alter table public.watchlist_items add constraint watchlist_items_source_check check (source in ('tmdb','anilist'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_title_check') then
    alter table public.watchlist_items add constraint watchlist_items_title_check check (char_length(title) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_type_check') then
    alter table public.watchlist_items add constraint watchlist_items_type_check check (type in ('Anime','Movie','TV Series'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and conname='watchlist_items_status_check') then
    alter table public.watchlist_items add constraint watchlist_items_status_check check (status in ('Planned','Watching','Watched','Dropped'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.watchlist_items'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (user_id, source, external_id)') then
    alter table public.watchlist_items add constraint watchlist_items_user_id_source_external_id_key unique (user_id,source,external_id);
  end if;
end $$;

alter table public.watchlist_items enable row level security;
revoke all on public.watchlist_items from anon;
grant select, insert, update, delete on public.watchlist_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='watchlist_items' and policyname='Users can read their watchlist') then
    create policy "Users can read their watchlist" on public.watchlist_items for select to authenticated using ((select auth.uid())=user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='watchlist_items' and policyname='Users can add to their watchlist') then
    create policy "Users can add to their watchlist" on public.watchlist_items for insert to authenticated with check ((select auth.uid())=user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='watchlist_items' and policyname='Users can update their watchlist') then
    create policy "Users can update their watchlist" on public.watchlist_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='watchlist_items' and policyname='Users can delete from their watchlist') then
    create policy "Users can delete from their watchlist" on public.watchlist_items for delete to authenticated using ((select auth.uid())=user_id);
  end if;
end $$;
