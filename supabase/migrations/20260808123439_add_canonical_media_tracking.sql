create schema if not exists private;

create table public.media_entities (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('Anime', 'Movie', 'TV Series')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_aliases (
  media_id uuid not null references public.media_entities(id) on delete cascade,
  provider text not null check (provider in ('tmdb', 'anilist', 'mal')),
  external_id text not null check (char_length(external_id) between 1 and 80),
  provenance text not null default 'primary' check (provenance in ('primary', 'provider_crosswalk', 'admin_verified')),
  created_at timestamptz not null default now(),
  primary key (provider, external_id),
  unique (media_id, provider)
);

alter table public.media_entities enable row level security;
alter table public.media_aliases enable row level security;
revoke all on public.media_entities, public.media_aliases from anon, authenticated;
grant select on public.media_entities, public.media_aliases to anon, authenticated;
grant all on public.media_entities, public.media_aliases to service_role;
create policy "Public media entities are readable" on public.media_entities for select to anon, authenticated using (true);
create policy "Public media aliases are readable" on public.media_aliases for select to anon, authenticated using (true);

alter table public.watchlist_items
  add column if not exists media_id uuid references public.media_entities(id),
  add column if not exists merged_into_id uuid references public.watchlist_items(id),
  add column if not exists merge_reason text,
  add column if not exists is_rewatching boolean not null default false,
  add column if not exists rewatch_count integer not null default 0,
  add column if not exists started_on date,
  add column if not exists completed_on date,
  add column if not exists private_notes text;

alter table public.watchlist_items drop constraint if exists watchlist_items_status_check;
alter table public.watchlist_items drop constraint if exists watchlist_items_status_v2_check;
alter table public.watchlist_items add constraint watchlist_items_status_v2_check
  check (status in ('Planned', 'Watching', 'Paused', 'Watched', 'Dropped'));
alter table public.watchlist_items add constraint watchlist_items_rewatch_count_check check (rewatch_count >= 0);
alter table public.watchlist_items add constraint watchlist_items_dates_check
  check (started_on is null or completed_on is null or completed_on >= started_on);
alter table public.watchlist_items add constraint watchlist_items_merge_check
  check (merged_into_id is null or merged_into_id <> id);
alter table public.watchlist_items add constraint watchlist_items_private_notes_check
  check (private_notes is null or char_length(private_notes) <= 5000);

do $$
declare
  identity record;
  resolved_media_id uuid;
begin
  for identity in
    select source, external_id, min(type) as media_type
    from public.watchlist_items
    group by source, external_id
  loop
    select media_id into resolved_media_id
    from public.media_aliases
    where provider = identity.source and external_id = identity.external_id;

    if resolved_media_id is null then
      insert into public.media_entities(media_type) values (identity.media_type) returning id into resolved_media_id;
      insert into public.media_aliases(media_id, provider, external_id, provenance)
      values (resolved_media_id, identity.source, identity.external_id, 'primary');
    end if;

    update public.watchlist_items
    set media_id = resolved_media_id
    where source = identity.source and external_id = identity.external_id and media_id is null;
  end loop;
end $$;

create unique index if not exists watchlist_items_active_media_idx
  on public.watchlist_items(user_id, media_id)
  where media_id is not null and merged_into_id is null;
create unique index if not exists watchlist_items_id_user_idx on public.watchlist_items(id, user_id);
create index if not exists watchlist_items_user_updated_idx on public.watchlist_items(user_id, updated_at desc);
create index if not exists watchlist_items_merged_into_idx on public.watchlist_items(merged_into_id) where merged_into_id is not null;
create index if not exists api_tokens_user_id_idx on public.api_tokens(user_id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.watchlist_items'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, source, external_id)'
  ) then
    drop index if exists public.watchlist_items_identity_idx;
  else
    create unique index if not exists watchlist_items_identity_idx
      on public.watchlist_items(user_id, source, external_id);
  end if;
end $$;

create table public.user_media_alias_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('tmdb', 'anilist', 'mal')),
  external_id text not null check (char_length(external_id) between 1 and 80),
  media_id uuid not null references public.media_entities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider, external_id)
);

create table public.user_media_match_decisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  alias_a text not null check (char_length(alias_a) between 3 and 90),
  alias_b text not null check (char_length(alias_b) between 3 and 90),
  decision text not null check (decision in ('confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, alias_a, alias_b),
  check (alias_a < alias_b)
);

alter table public.user_media_alias_links enable row level security;
alter table public.user_media_match_decisions enable row level security;
grant select, insert, update, delete on public.user_media_alias_links, public.user_media_match_decisions to authenticated;
grant all on public.user_media_alias_links, public.user_media_match_decisions to service_role;
revoke all on public.user_media_alias_links, public.user_media_match_decisions from anon;

create policy "Users own alias links" on public.user_media_alias_links for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users own match decisions" on public.user_media_match_decisions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.resolve_watchlist_media_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_id uuid;
  candidate_id uuid;
begin
  select media_id into resolved_id from public.user_media_alias_links
  where user_id = new.user_id and provider = new.source and external_id = new.external_id;

  if resolved_id is null then
    select media_id into resolved_id from public.media_aliases
    where provider = new.source and external_id = new.external_id;
  end if;

  if resolved_id is null then
    insert into public.media_entities(media_type) values (new.type) returning id into candidate_id;
    insert into public.media_aliases(media_id, provider, external_id, provenance)
    values (candidate_id, new.source, new.external_id, 'primary')
    on conflict (provider, external_id) do nothing;
    select media_id into resolved_id from public.media_aliases
    where provider = new.source and external_id = new.external_id;
    if resolved_id <> candidate_id then delete from public.media_entities where id = candidate_id; end if;
  end if;

  new.media_id := resolved_id;
  return new;
end;
$$;

revoke all on function private.resolve_watchlist_media_id() from public, anon, authenticated;
drop trigger if exists watchlist_resolve_media_id on public.watchlist_items;
create trigger watchlist_resolve_media_id before insert or update of source, external_id, user_id, media_id
on public.watchlist_items for each row execute function private.resolve_watchlist_media_id();

create or replace function private.validate_watchlist_merge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.merged_into_id is not null and not exists (
    select 1 from public.watchlist_items target
    where target.id = new.merged_into_id and target.user_id = new.user_id and target.merged_into_id is null
  ) then
    raise exception 'Merge target must be an active item owned by the same user' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_watchlist_merge() from public, anon, authenticated;
create trigger watchlist_validate_merge before insert or update of merged_into_id, user_id
on public.watchlist_items for each row execute function private.validate_watchlist_merge();

create table public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  is_public boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index custom_lists_user_slug_idx on public.custom_lists(user_id, lower(slug));

create table public.custom_list_items (
  list_id uuid not null,
  watchlist_item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position between 0 and 1000000),
  created_at timestamptz not null default now(),
  primary key (list_id, watchlist_item_id),
  foreign key (list_id, user_id) references public.custom_lists(id, user_id) on delete cascade,
  foreign key (watchlist_item_id, user_id) references public.watchlist_items(id, user_id) on delete cascade
);

create table public.watchlist_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_item_id uuid not null,
  event_type text not null check (event_type in ('created', 'tracking_updated', 'merged', 'unmerged')),
  old_value jsonb,
  new_value jsonb,
  origin text not null check (origin in ('web', 'integration', 'import')),
  created_at timestamptz not null default now(),
  foreign key (watchlist_item_id, user_id) references public.watchlist_items(id, user_id) on delete cascade
);

alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;
alter table public.watchlist_events enable row level security;
grant select, insert, update, delete on public.custom_lists, public.custom_list_items to authenticated;
grant select on public.watchlist_events to authenticated;
revoke insert, update, delete on public.watchlist_events from authenticated;
revoke all on sequence public.watchlist_events_id_seq from anon, authenticated;
grant all on public.custom_lists, public.custom_list_items, public.watchlist_events to service_role;
grant all on sequence public.watchlist_events_id_seq to service_role;
revoke all on public.custom_lists, public.custom_list_items, public.watchlist_events from anon;
create policy "Users own custom lists" on public.custom_lists for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users own custom list items" on public.custom_list_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read their watchlist events" on public.watchlist_events for select to authenticated using ((select auth.uid()) = user_id);
create index custom_list_items_user_idx on public.custom_list_items(user_id);
create index watchlist_events_user_created_idx on public.watchlist_events(user_id, created_at desc);

create or replace function private.record_watchlist_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_state jsonb;
  new_state jsonb;
begin
  new_state := jsonb_build_object('status', new.status, 'currentEpisode', new.current_episode, 'totalEpisodes', new.total_episodes,
    'personalRating', new.personal_rating, 'isFavorite', new.is_favorite, 'isRewatching', new.is_rewatching,
    'rewatchCount', new.rewatch_count, 'startedOn', new.started_on, 'completedOn', new.completed_on, 'mergeReason', new.merge_reason);
  if tg_op = 'INSERT' then
    insert into public.watchlist_events(user_id, watchlist_item_id, event_type, new_value, origin)
    values (new.user_id, new.id, 'created', new_state, case when (select auth.uid()) is null then 'integration' else 'web' end);
  else
    old_state := jsonb_build_object('status', old.status, 'currentEpisode', old.current_episode, 'totalEpisodes', old.total_episodes,
      'personalRating', old.personal_rating, 'isFavorite', old.is_favorite, 'isRewatching', old.is_rewatching,
      'rewatchCount', old.rewatch_count, 'startedOn', old.started_on, 'completedOn', old.completed_on, 'mergeReason', old.merge_reason);
    if old_state is distinct from new_state or old.merged_into_id is distinct from new.merged_into_id then
      insert into public.watchlist_events(user_id, watchlist_item_id, event_type, old_value, new_value, origin)
      values (new.user_id, new.id, case when new.merged_into_id is distinct from old.merged_into_id then case when new.merged_into_id is null then 'unmerged' else 'merged' end else 'tracking_updated' end,
        old_state, new_state, case when (select auth.uid()) is null then 'integration' else 'web' end);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.record_watchlist_event() from public, anon, authenticated;
create trigger watchlist_record_event after insert or update on public.watchlist_items
for each row execute function private.record_watchlist_event();

create or replace function public.reject_media_match(p_left_provider text, p_left_external_id text, p_right_provider text, p_right_external_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := (select auth.uid()); a text; b text;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_left_provider is null or p_right_provider is null or p_left_external_id is null or p_right_external_id is null
    or p_left_provider not in ('tmdb','anilist','mal') or p_right_provider not in ('tmdb','anilist','mal')
    or char_length(p_left_external_id) not between 1 and 80 or char_length(p_right_external_id) not between 1 and 80 then
    raise exception 'Invalid media alias' using errcode = '22023';
  end if;
  a := least(p_left_provider || ':' || p_left_external_id, p_right_provider || ':' || p_right_external_id);
  b := greatest(p_left_provider || ':' || p_left_external_id, p_right_provider || ':' || p_right_external_id);
  if a = b then raise exception 'Aliases must differ' using errcode = '22023'; end if;
  insert into public.user_media_match_decisions(user_id, alias_a, alias_b, decision)
  values (uid, a, b, 'rejected') on conflict (user_id, alias_a, alias_b)
  do update set decision = excluded.decision, updated_at = now();
  return jsonb_build_object('decision','rejected');
end;
$$;

create or replace function public.confirm_media_match(p_left_provider text, p_left_external_id text, p_right_provider text, p_right_external_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid()); target_media uuid; a text; b text;
  winner public.watchlist_items; loser public.watchlist_items; tmp public.watchlist_items;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_left_provider is null or p_right_provider is null or p_left_external_id is null or p_right_external_id is null
    or p_left_provider not in ('tmdb','anilist','mal') or p_right_provider not in ('tmdb','anilist','mal')
    or char_length(p_left_external_id) not between 1 and 80 or char_length(p_right_external_id) not between 1 and 80 then
    raise exception 'Invalid media alias' using errcode = '22023';
  end if;
  a := least(p_left_provider || ':' || p_left_external_id, p_right_provider || ':' || p_right_external_id);
  b := greatest(p_left_provider || ':' || p_left_external_id, p_right_provider || ':' || p_right_external_id);
  if a = b then raise exception 'Aliases must differ' using errcode = '22023'; end if;

  select coalesce(ul.media_id, ma.media_id) into target_media
  from (values (1)) v(n)
  left join public.user_media_alias_links ul on ul.user_id = uid and ul.provider = p_left_provider and ul.external_id = p_left_external_id
  left join public.media_aliases ma on ma.provider = p_left_provider and ma.external_id = p_left_external_id;
  if target_media is null then raise exception 'Unknown media alias' using errcode = '22023'; end if;

  insert into public.user_media_alias_links(user_id, provider, external_id, media_id)
  values (uid,p_left_provider,p_left_external_id,target_media),(uid,p_right_provider,p_right_external_id,target_media)
  on conflict (user_id,provider,external_id) do update set media_id = excluded.media_id;
  insert into public.user_media_match_decisions(user_id,alias_a,alias_b,decision)
  values(uid,a,b,'confirmed') on conflict(user_id,alias_a,alias_b) do update set decision='confirmed',updated_at=now();

  select * into winner from public.watchlist_items where user_id=uid and merged_into_id is null
    and (media_id=target_media or (source=p_left_provider and external_id=p_left_external_id) or (source=p_right_provider and external_id=p_right_external_id))
    order by updated_at desc, id desc limit 1 for update;
  if winner.id is null then return jsonb_build_object('decision','confirmed','item',null); end if;

  for loser in select * from public.watchlist_items where user_id=uid and merged_into_id is null and id<>winner.id
    and (media_id=target_media or (source=p_left_provider and external_id=p_left_external_id) or (source=p_right_provider and external_id=p_right_external_id))
    order by updated_at desc, id desc for update
  loop
    update public.watchlist_items set merged_into_id=winner.id, merge_reason='user_confirmed_alias_notes_retained' where id=loser.id;
    insert into public.custom_list_items(list_id,watchlist_item_id,user_id,position)
      select list_id,winner.id,user_id,position from public.custom_list_items where watchlist_item_id=loser.id
      on conflict(list_id,watchlist_item_id) do nothing;
    delete from public.custom_list_items where watchlist_item_id=loser.id;
    update public.watchlist_items set
      media_id=target_media,
      current_episode=greatest(winner.current_episode,loser.current_episode),
      progress=case when loser.current_episode>winner.current_episode then loser.progress else winner.progress end,
      total_episodes=case when winner.total_episodes is null and loser.total_episodes is null then null else greatest(coalesce(winner.total_episodes,0),coalesce(loser.total_episodes,0),winner.current_episode,loser.current_episode) end,
      personal_rating=coalesce(winner.personal_rating,loser.personal_rating),
      is_favorite=winner.is_favorite or loser.is_favorite,
      is_rewatching=winner.is_rewatching or loser.is_rewatching,
      rewatch_count=greatest(winner.rewatch_count,loser.rewatch_count),
      started_on=case when winner.started_on is null then loser.started_on when loser.started_on is null then winner.started_on else least(winner.started_on,loser.started_on) end,
      completed_on=case when winner.completed_on is null then loser.completed_on when loser.completed_on is null then winner.completed_on else greatest(winner.completed_on,loser.completed_on) end,
      private_notes=case
        when nullif(winner.private_notes,'') is null then loser.private_notes
        when nullif(loser.private_notes,'') is null or winner.private_notes=loser.private_notes then winner.private_notes
        when char_length(winner.private_notes)+char_length(loser.private_notes)+23 <= 5000 then winner.private_notes || E'\n\n--- Merged note ---\n' || loser.private_notes
        else left(winner.private_notes,2400) || E'\n\n--- Merged notes truncated; originals retained in source rows ---\n\n' || left(loser.private_notes,2400)
      end
    where id=winner.id returning * into tmp;
    winner := tmp;
  end loop;
  update public.watchlist_items set media_id=target_media where id=winner.id returning * into tmp;
  winner := tmp;
  return jsonb_build_object('decision','confirmed','item',to_jsonb(winner));
end;
$$;

revoke all on function public.reject_media_match(text,text,text,text) from public, anon;
revoke all on function public.confirm_media_match(text,text,text,text) from public, anon;
grant execute on function public.reject_media_match(text,text,text,text) to authenticated;
grant execute on function public.confirm_media_match(text,text,text,text) to authenticated;

create or replace function public.undo_media_merge(p_winner_id uuid, p_loser_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  winner public.watchlist_items;
  loser public.watchlist_items;
  global_loser_media uuid;
  user_link_media uuid;
  a text;
  b text;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_winner_id is null or p_loser_id is null or p_winner_id = p_loser_id then
    raise exception 'Invalid merge pair' using errcode = '22023';
  end if;

  select * into winner from public.watchlist_items where id = p_winner_id and user_id = uid and merged_into_id is null for update;
  select * into loser from public.watchlist_items where id = p_loser_id and user_id = uid and merged_into_id = p_winner_id for update;
  if winner.id is null or loser.id is null then raise exception 'Merge pair not found' using errcode = 'P0002'; end if;
  if loser.media_id is null or loser.media_id = winner.media_id or exists (
    select 1 from public.watchlist_items active
    where active.user_id = uid and active.media_id = loser.media_id and active.merged_into_id is null and active.id <> loser.id
  ) then
    raise exception 'Original media identity is already active' using errcode = '23505';
  end if;

  select media_id into user_link_media from public.user_media_alias_links
  where user_id = uid and provider = loser.source and external_id = loser.external_id;
  if user_link_media is not null then
    select media_id into global_loser_media from public.media_aliases
    where provider = loser.source and external_id = loser.external_id;
    if user_link_media <> winner.media_id or global_loser_media is distinct from loser.media_id then
      raise exception 'Alias mapping changed since merge; undo would be unsafe' using errcode = '40001';
    end if;
    delete from public.user_media_alias_links
    where user_id = uid and provider = loser.source and external_id = loser.external_id and media_id = winner.media_id;
  end if;

  a := least(winner.source || ':' || winner.external_id, loser.source || ':' || loser.external_id);
  b := greatest(winner.source || ':' || winner.external_id, loser.source || ':' || loser.external_id);
  if a < b then
    insert into public.user_media_match_decisions(user_id, alias_a, alias_b, decision)
    values (uid, a, b, 'rejected') on conflict (user_id, alias_a, alias_b)
    do update set decision = 'rejected', updated_at = now();
  end if;

  update public.watchlist_items set merged_into_id = null, merge_reason = null
  where id = loser.id returning * into loser;
  return jsonb_build_object('decision', 'undone', 'winner', to_jsonb(winner), 'loser', to_jsonb(loser));
end;
$$;
revoke all on function public.undo_media_merge(uuid,uuid) from public, anon;
grant execute on function public.undo_media_merge(uuid,uuid) to authenticated;
comment on function public.undo_media_merge(uuid,uuid) is
  'Identity-only undo: restores the retained loser identity and rejection decision; combined winner tracking, notes, and list memberships remain to avoid discarding post-merge data.';

create or replace function public.upsert_watchlist_from_api(p_token_hash text, p_item jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_row public.watchlist_items; v_exact public.watchlist_items; v_applied boolean;
begin
  select user_id into v_user_id from public.api_tokens where token_hash=p_token_hash and revoked_at is null
    and (expires_at is null or expires_at>now()) and 'watchlist:write'=any(scopes);
  if v_user_id is null then raise exception 'Invalid integration token' using errcode='28000'; end if;

  select * into v_exact from public.watchlist_items
  where user_id=v_user_id and source=p_item->>'source' and external_id=p_item->>'external_id'
  for update;
  if v_exact.merged_into_id is not null then
    select * into v_row from public.watchlist_items
    where id=v_exact.merged_into_id and user_id=v_user_id and merged_into_id is null
    for update;
    if v_row.id is null then raise exception 'Merged watchlist target is missing' using errcode='23503'; end if;

    update public.watchlist_items set
      title=p_item->>'title', type=p_item->>'type',
      status=case when coalesce((p_item->>'current_episode')::integer,0)<v_row.current_episode then v_row.status else p_item->>'status' end,
      poster=case when coalesce(p_item->>'poster','')='' then v_row.poster else p_item->>'poster' end,
      backdrop=case when coalesce(p_item->>'backdrop','')='' then v_row.backdrop else p_item->>'backdrop' end,
      progress=case when coalesce((p_item->>'current_episode')::integer,0)<v_row.current_episode then v_row.progress else coalesce(p_item->>'progress','') end,
      rating=coalesce(p_item->>'rating','N/A'),
      description=case when coalesce(p_item->>'description','')='' then v_row.description else p_item->>'description' end,
      year=coalesce(p_item->>'year',v_row.year),
      current_episode=greatest(coalesce((p_item->>'current_episode')::integer,0),v_row.current_episode),
      total_episodes=case when p_item->>'total_episodes' is null and v_row.total_episodes is null then null else greatest(coalesce((p_item->>'total_episodes')::integer,0),coalesce(v_row.total_episodes,0),coalesce((p_item->>'current_episode')::integer,0),v_row.current_episode) end,
      runtime_minutes=coalesce((p_item->>'runtime_minutes')::integer,v_row.runtime_minutes),
      personal_rating=coalesce((p_item->>'personal_rating')::smallint,v_row.personal_rating),
      is_favorite=coalesce((p_item->>'is_favorite')::boolean,v_row.is_favorite),
      is_rewatching=coalesce((p_item->>'is_rewatching')::boolean,v_row.is_rewatching),
      rewatch_count=greatest(coalesce((p_item->>'rewatch_count')::integer,0),v_row.rewatch_count),
      started_on=coalesce((p_item->>'started_on')::date,v_row.started_on),
      completed_on=coalesce((p_item->>'completed_on')::date,v_row.completed_on),
      private_notes=coalesce(p_item->>'private_notes',v_row.private_notes),
      updated_at=(p_item->>'updated_at')::timestamptz
    where id=v_row.id and (p_item->>'updated_at')::timestamptz>=v_row.updated_at
    returning * into v_row;
    v_applied:=found;
    if not v_applied then select * into v_row from public.watchlist_items where id=v_exact.merged_into_id; end if;
    update public.api_tokens set last_used_at=now() where token_hash=p_token_hash;
    return jsonb_build_object('applied',v_applied,'item',to_jsonb(v_row));
  end if;

  insert into public.watchlist_items(user_id,external_id,source,title,type,status,poster,backdrop,progress,rating,description,year,
    current_episode,total_episodes,runtime_minutes,personal_rating,is_favorite,is_rewatching,rewatch_count,started_on,completed_on,private_notes,updated_at)
  values(v_user_id,p_item->>'external_id',p_item->>'source',p_item->>'title',p_item->>'type',p_item->>'status',coalesce(p_item->>'poster',''),
    coalesce(p_item->>'backdrop',''),coalesce(p_item->>'progress',''),coalesce(p_item->>'rating','N/A'),coalesce(p_item->>'description',''),p_item->>'year',
    coalesce((p_item->>'current_episode')::integer,0),(p_item->>'total_episodes')::integer,(p_item->>'runtime_minutes')::integer,
    (p_item->>'personal_rating')::smallint,coalesce((p_item->>'is_favorite')::boolean,false),coalesce((p_item->>'is_rewatching')::boolean,false),
    coalesce((p_item->>'rewatch_count')::integer,0),(p_item->>'started_on')::date,(p_item->>'completed_on')::date,p_item->>'private_notes',(p_item->>'updated_at')::timestamptz)
  on conflict(user_id,source,external_id) do update set
    title=excluded.title,type=excluded.type,
    status=case when excluded.current_episode<public.watchlist_items.current_episode then public.watchlist_items.status else excluded.status end,
    poster=case when excluded.poster='' then public.watchlist_items.poster else excluded.poster end,
    backdrop=case when excluded.backdrop='' then public.watchlist_items.backdrop else excluded.backdrop end,
    progress=case when excluded.current_episode<public.watchlist_items.current_episode then public.watchlist_items.progress else excluded.progress end,
    rating=excluded.rating,description=case when excluded.description='' then public.watchlist_items.description else excluded.description end,
    year=coalesce(excluded.year,public.watchlist_items.year),current_episode=greatest(excluded.current_episode,public.watchlist_items.current_episode),
    total_episodes=case when excluded.total_episodes is null and public.watchlist_items.total_episodes is null then null else greatest(coalesce(excluded.total_episodes,0),coalesce(public.watchlist_items.total_episodes,0),excluded.current_episode,public.watchlist_items.current_episode) end,
    runtime_minutes=coalesce(excluded.runtime_minutes,public.watchlist_items.runtime_minutes),personal_rating=coalesce(excluded.personal_rating,public.watchlist_items.personal_rating),
    is_favorite=excluded.is_favorite,is_rewatching=excluded.is_rewatching,rewatch_count=greatest(excluded.rewatch_count,public.watchlist_items.rewatch_count),
    started_on=coalesce(excluded.started_on,public.watchlist_items.started_on),completed_on=coalesce(excluded.completed_on,public.watchlist_items.completed_on),
    private_notes=coalesce(excluded.private_notes,public.watchlist_items.private_notes),updated_at=excluded.updated_at
  where excluded.updated_at>=public.watchlist_items.updated_at returning * into v_row;
  v_applied:=found;
  if not v_applied then select * into v_row from public.watchlist_items where user_id=v_user_id and source=p_item->>'source' and external_id=p_item->>'external_id'; end if;
  update public.api_tokens set last_used_at=now() where token_hash=p_token_hash;
  return jsonb_build_object('applied',v_applied,'item',to_jsonb(v_row));
end;
$$;
revoke all on function public.upsert_watchlist_from_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_watchlist_from_api(text,jsonb) to service_role;
