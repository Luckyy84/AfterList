alter table public.watchlist_items
  add column if not exists current_episode integer not null default 0,
  add column if not exists total_episodes integer,
  add column if not exists personal_rating smallint,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_current_episode_check') then
    alter table public.watchlist_items add constraint watchlist_items_current_episode_check check (current_episode >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_total_episodes_check') then
    alter table public.watchlist_items add constraint watchlist_items_total_episodes_check check (total_episodes is null or total_episodes > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_episode_progress_check') then
    alter table public.watchlist_items add constraint watchlist_items_episode_progress_check check (total_episodes is null or current_episode <= total_episodes);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_personal_rating_check') then
    alter table public.watchlist_items add constraint watchlist_items_personal_rating_check check (personal_rating is null or personal_rating between 1 and 10);
  end if;
end $$;

create index if not exists watchlist_items_user_id_idx on public.watchlist_items (user_id);
delete from public.watchlist_items older
using public.watchlist_items newer
where older.user_id = newer.user_id
  and older.source = newer.source
  and older.external_id = newer.external_id
  and (coalesce(older.created_at, older.updated_at), older.id)
    < (coalesce(newer.created_at, newer.updated_at), newer.id);
drop index if exists public.watchlist_items_identity_idx;
create unique index watchlist_items_identity_idx on public.watchlist_items (user_id, source, external_id);

alter table public.watchlist_items enable row level security;

do $$
declare existing_policy record;
begin
  for existing_policy in select policyname from pg_policies where schemaname = 'public' and tablename = 'watchlist_items'
  loop
    execute format('drop policy %I on public.watchlist_items', existing_policy.policyname);
  end loop;
end $$;

create policy "Users can read their watchlist"
on public.watchlist_items for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add to their watchlist"
on public.watchlist_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their watchlist"
on public.watchlist_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete from their watchlist"
on public.watchlist_items for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.watchlist_items from anon;
grant select, insert, update, delete on table public.watchlist_items to authenticated;
