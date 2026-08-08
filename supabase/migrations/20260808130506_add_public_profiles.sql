create or replace function private.valid_profile_external_links(p_links jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_links) <> 'array' then false
    when jsonb_array_length(p_links) > 8 then false
    else not exists (
      select 1 from jsonb_array_elements(p_links) link
      where jsonb_typeof(link) <> 'object'
        or not (link ? 'label' and link ? 'url')
        or link - 'label' - 'url' <> '{}'::jsonb
        or jsonb_typeof(link->'label') <> 'string'
        or char_length(link->>'label') not between 1 and 40
        or btrim(link->>'label') = ''
        or jsonb_typeof(link->'url') <> 'string'
        or char_length(link->>'url') not between 1 and 500
        or (link->>'url') !~ '^https?://[^/[:space:]]+(/[^[:space:]]*)?$'
    ) end;
$$;
revoke all on function private.valid_profile_external_links(jsonb) from public, anon, authenticated;
grant execute on function private.valid_profile_external_links(jsonb) to authenticated, service_role;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$' and username = lower(username)),
  display_name text check (display_name is null or char_length(display_name) <= 80),
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text check (avatar_url is null or avatar_url = '' or (char_length(avatar_url) <= 500 and avatar_url ~ '^https?://[^/[:space:]]+(/[^[:space:]]*)?$')),
  external_links jsonb not null default '[]'::jsonb check (private.valid_profile_external_links(external_links)),
  is_public boolean not null default false,
  show_library boolean not null default false,
  show_favorites boolean not null default false,
  show_stats boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reserved_usernames (
  username text primary key check (username ~ '^[a-z0-9_]{1,30}$' and username = lower(username)),
  created_at timestamptz not null default now()
);

insert into public.reserved_usernames(username) values
  ('admin'),('administrator'),('afterlist'),('api'),('auth'),('discover'),('help'),('library'),
  ('login'),('me'),('moderator'),('privacy'),('profile'),('settings'),('signup'),('statistics'),
  ('support'),('system'),('terms'),('user'),('users')
on conflict (username) do nothing;

create table public.username_history (
  username text primary key check (username ~ '^[a-z0-9_]{3,30}$' and username = lower(username)),
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_until timestamptz not null,
  created_at timestamptz not null default now()
);
create index username_history_user_idx on public.username_history(user_id);
create index username_history_redirect_idx on public.username_history(username, redirect_until desc);

alter table public.profiles enable row level security;
alter table public.reserved_usernames enable row level security;
alter table public.username_history enable row level security;
revoke all on public.profiles, public.reserved_usernames, public.username_history from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.username_history to authenticated;
grant all on public.profiles, public.reserved_usernames, public.username_history to service_role;

create policy "Users own their profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read their username history" on public.username_history for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.protect_profile_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
  if current_setting('afterlist.username_rpc', true) is distinct from 'on' then
    raise exception 'Username changes must use claim_profile_username' using errcode = '42501';
  end if;
  new.username := lower(btrim(new.username));
  return new;
end;
$$;
revoke all on function private.protect_profile_username() from public, anon, authenticated;
create trigger profiles_protect_username before insert or update of username on public.profiles
for each row execute function private.protect_profile_username();

create or replace function private.touch_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_profile_updated_at() from public, anon, authenticated;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_profile_updated_at();

create or replace function public.claim_profile_username(p_username text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  requested text := lower(btrim(p_username));
  current_name text;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' then raise exception 'Invalid username' using errcode = '22023'; end if;
  if exists (select 1 from public.reserved_usernames where username = requested) then raise exception 'Username is reserved' using errcode = '23505'; end if;
  if exists (select 1 from public.profiles where username = requested and user_id <> uid) then raise exception 'Username is unavailable' using errcode = '23505'; end if;
  if exists (select 1 from public.username_history where username = requested and user_id <> uid and redirect_until > now()) then
    raise exception 'Username is temporarily unavailable' using errcode = '23505';
  end if;

  select username into current_name from public.profiles where user_id = uid for update;
  if current_name = requested then return jsonb_build_object('username', requested, 'changed', false); end if;
  perform set_config('afterlist.username_rpc', 'on', true);

  if current_name is null then
    insert into public.profiles(user_id, username) values (uid, requested);
  else
    insert into public.username_history(username, user_id, redirect_until)
    values (current_name, uid, now() + interval '90 days')
    on conflict (username) do update set user_id = excluded.user_id, redirect_until = excluded.redirect_until, created_at = now();
    update public.profiles set username = requested, updated_at = now() where user_id = uid;
  end if;
  delete from public.username_history where username = requested and user_id = uid;
  return jsonb_build_object('username', requested, 'changed', true);
end;
$$;
revoke all on function public.claim_profile_username(text) from public, anon;
grant execute on function public.claim_profile_username(text) to authenticated;

create or replace function private.public_watchlist_item(p_item public.watchlist_items)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_item.source || ':' || p_item.external_id, 'externalId', p_item.external_id, 'source', p_item.source, 'title', p_item.title, 'type', p_item.type,
    'status', p_item.status, 'poster', p_item.poster, 'backdrop', p_item.backdrop, 'year', p_item.year,
    'progress', p_item.progress, 'rating', p_item.rating, 'description', p_item.description, 'runtimeMinutes', p_item.runtime_minutes, 'currentEpisode', p_item.current_episode,
    'totalEpisodes', p_item.total_episodes, 'personalRating', p_item.personal_rating, 'isFavorite', p_item.is_favorite,
    'updatedAt', p_item.updated_at
  );
$$;
revoke all on function private.public_watchlist_item(public.watchlist_items) from public, anon, authenticated;

create or replace function private.resolve_public_username(p_username text)
returns text language sql stable security invoker set search_path = '' as $$
  select p.username from public.profiles p
  where p.is_public and (
    p.username = lower(btrim(p_username)) or exists (
      select 1 from public.username_history h
      where h.username = lower(btrim(p_username)) and h.user_id = p.user_id and h.redirect_until > now()
    )
  )
  order by (p.username = lower(btrim(p_username))) desc
  limit 1;
$$;
revoke all on function private.resolve_public_username(text) from public, anon, authenticated;

create or replace function public.get_public_profile(p_username text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare requested text := lower(btrim(p_username)); current_name text; p public.profiles; stats jsonb; favorites jsonb; lists jsonb;
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' then raise exception 'Invalid username' using errcode='22023'; end if;
  current_name := private.resolve_public_username(requested);
  if current_name is null then return null; end if;
  select * into p from public.profiles where username=current_name and is_public;
  if p.show_stats then
    select jsonb_build_object('total',count(*),'planned',count(*) filter(where status='Planned'),'watching',count(*) filter(where status='Watching'),
      'paused',count(*) filter(where status='Paused'),'watched',count(*) filter(where status='Watched'),'dropped',count(*) filter(where status='Dropped'))
    into stats from public.watchlist_items where user_id=p.user_id and merged_into_id is null;
  end if;
  if p.show_favorites then
    select coalesce(jsonb_agg(private.public_watchlist_item(w) order by w.updated_at desc),'[]'::jsonb) into favorites
    from (select * from public.watchlist_items where user_id=p.user_id and merged_into_id is null and is_favorite order by updated_at desc limit 24) w;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',listed.name,'slug',listed.slug) order by listed.sort_order,listed.name),'[]'::jsonb) into lists
  from (select name,slug,sort_order from public.custom_lists where user_id=p.user_id and is_public order by sort_order,name limit 50) listed;
  return jsonb_build_object('redirectUsername',case when requested<>current_name then current_name else null end,
    'username',p.username,'displayName',p.display_name,'bio',p.bio,'avatarUrl',p.avatar_url,'externalLinks',p.external_links,
    'stats',stats,'favorites',favorites,'lists',lists);
end;
$$;

create or replace function public.get_public_library(p_username text, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare requested text := lower(btrim(p_username)); current_name text; p public.profiles; items jsonb;
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' or p_limit not between 1 and 100 or p_offset not between 0 and 10000 then
    raise exception 'Invalid public library request' using errcode='22023';
  end if;
  current_name := private.resolve_public_username(requested);
  if current_name is null then return null; end if;
  select * into p from public.profiles where username=current_name and is_public and show_library;
  if p.user_id is null then return null; end if;
  select coalesce(jsonb_agg(private.public_watchlist_item(w) order by w.updated_at desc),'[]'::jsonb) into items
  from (select * from public.watchlist_items where user_id=p.user_id and merged_into_id is null order by updated_at desc limit p_limit offset p_offset) w;
  return jsonb_build_object('redirectUsername',case when requested<>current_name then current_name else null end,
    'username',p.username,'displayName',p.display_name,'items',items);
end;
$$;

create or replace function public.get_public_list(p_username text, p_list_slug text, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare requested text := lower(btrim(p_username)); list_slug text := lower(btrim(p_list_slug)); current_name text; p public.profiles; l public.custom_lists; items jsonb;
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' or list_slug is null or list_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(list_slug)>80 or p_limit not between 1 and 100 or p_offset not between 0 and 10000 then
    raise exception 'Invalid public list request' using errcode='22023';
  end if;
  current_name := private.resolve_public_username(requested);
  if current_name is null then return null; end if;
  select * into p from public.profiles where username=current_name and is_public;
  if p.user_id is null then return null; end if;
  select * into l from public.custom_lists where user_id=p.user_id and slug=list_slug and is_public;
  if l.id is null then return null; end if;
  select coalesce(jsonb_agg(private.public_watchlist_item(listed.item) order by listed.position,listed.updated_at desc),'[]'::jsonb) into items
  from (
    select w as item, cli.position, w.updated_at
    from public.custom_list_items cli join public.watchlist_items w on w.id=cli.watchlist_item_id and w.user_id=cli.user_id
    where cli.list_id=l.id and w.merged_into_id is null
    order by cli.position,w.updated_at desc limit p_limit offset p_offset
  ) listed;
  return jsonb_build_object('redirectUsername',case when requested<>current_name then current_name else null end,
    'username',p.username,'displayName',p.display_name,'name',l.name,'slug',l.slug,'items',items);
end;
$$;

revoke all on function public.get_public_profile(text) from public;
revoke all on function public.get_public_library(text,integer,integer) from public;
revoke all on function public.get_public_list(text,text,integer,integer) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;
grant execute on function public.get_public_library(text,integer,integer) to anon, authenticated, service_role;
grant execute on function public.get_public_list(text,text,integer,integer) to anon, authenticated, service_role;
