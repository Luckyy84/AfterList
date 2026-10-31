-- Season counters only. No individual episode records and no changes to title counters.
create table public.season_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_item_id uuid not null,
  season integer not null check (season between 0 and 999),
  current_episode integer not null default 0 check (current_episode between 0 and 10000),
  total_episodes integer check (total_episodes between 1 and 10000 and total_episodes >= current_episode),
  updated_at timestamptz not null default now(),
  primary key (watchlist_item_id,season),
  foreign key (watchlist_item_id,user_id) references public.watchlist_items(id,user_id) on delete cascade
);
alter table public.season_progress enable row level security;
revoke all on public.season_progress from public,anon,authenticated;
grant select on public.season_progress to authenticated;
grant all on public.season_progress to service_role;
create policy "Read own season progress" on public.season_progress for select to authenticated using (user_id=(select auth.uid()));
create index season_progress_user_idx on public.season_progress(user_id);

create or replace function public.save_season_progress(p_item_id uuid,p_season integer,p_current integer,p_total integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); item public.watchlist_items; before_row public.season_progress; after_row public.season_progress;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_season is null or p_season not between 0 and 999 or p_current is null or p_current not between 0 and 10000
    or (p_total is not null and (p_total not between 1 and 10000 or p_current>p_total)) then raise exception 'Invalid season progress' using errcode='22023'; end if;
  select * into item from public.watchlist_items where id=p_item_id and user_id=uid and merged_into_id is null for update;
  if item.id is null then raise exception 'Title not found' using errcode='P0002'; end if;
  if item.type='Movie' then raise exception 'Movies have no seasons' using errcode='22023'; end if;
  if item.source='anilist' and p_season<>1 then raise exception 'AniList seasons are separate titles; use season 1 for this title' using errcode='22023'; end if;
  select * into before_row from public.season_progress where watchlist_item_id=p_item_id and season=p_season;
  insert into public.season_progress(user_id,watchlist_item_id,season,current_episode,total_episodes) values(uid,p_item_id,p_season,p_current,p_total)
    on conflict(watchlist_item_id,season) do update set current_episode=excluded.current_episode,total_episodes=excluded.total_episodes,updated_at=now() returning * into after_row;
  if before_row.current_episode is distinct from after_row.current_episode or before_row.total_episodes is distinct from after_row.total_episodes then
    insert into public.watchlist_events(user_id,watchlist_item_id,event_type,old_value,new_value,origin)
    values(uid,p_item_id,'tracking_updated',jsonb_build_object('season',p_season,'currentEpisode',before_row.current_episode,'totalEpisodes',before_row.total_episodes),jsonb_build_object('season',p_season,'currentEpisode',p_current,'totalEpisodes',p_total),'web');
  end if;
  return to_jsonb(after_row);
end;
$$;
revoke all on function public.save_season_progress(uuid,integer,integer,integer) from public,anon;
grant execute on function public.save_season_progress(uuid,integer,integer,integer) to authenticated;

create or replace function public.save_custom_list_items(p_list_id uuid,p_item_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform 1 from public.custom_lists where id=p_list_id and user_id=uid for update;
  if not found then raise exception 'List not found' using errcode='P0002'; end if;
  if p_item_ids is null or cardinality(p_item_ids)>1000 or exists(select 1 from unnest(p_item_ids) id group by id having count(*)>1)
    or exists(select 1 from unnest(p_item_ids) id where id is null or not exists(select 1 from public.watchlist_items w where w.id=id and w.user_id=uid and w.merged_into_id is null)) then
    raise exception 'Invalid list selection' using errcode='22023';
  end if;
  delete from public.custom_list_items where list_id=p_list_id and not(watchlist_item_id=any(p_item_ids));
  insert into public.custom_list_items(list_id,watchlist_item_id,user_id,position)
    select p_list_id,id,uid,(position-1)::integer from unnest(p_item_ids) with ordinality as selected(id,position)
    on conflict(list_id,watchlist_item_id) do update set position=excluded.position;
  update public.custom_lists set updated_at=now() where id=p_list_id;
  return to_jsonb(p_item_ids);
end;
$$;
revoke all on function public.save_custom_list_items(uuid,uuid[]) from public,anon;
grant execute on function public.save_custom_list_items(uuid,uuid[]) to authenticated;

create or replace function public.reorder_custom_lists(p_list_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  -- Serialize complete-list ordering per account, not across accounts.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,73));
  if p_list_ids is null or cardinality(p_list_ids)>1000 or cardinality(p_list_ids)<>(select count(*) from public.custom_lists where user_id=uid)
    or exists(select 1 from unnest(p_list_ids) id group by id having count(*)>1)
    or exists(select 1 from unnest(p_list_ids) id where id is null or not exists(select 1 from public.custom_lists l where l.id=id and l.user_id=uid)) then
    raise exception 'List collection changed; reload before ordering' using errcode='22023';
  end if;
  update public.custom_lists l set sort_order=(selected.position-1)::integer,updated_at=now()
    from unnest(p_list_ids) with ordinality as selected(id,position) where l.id=selected.id and l.user_id=uid;
  return to_jsonb(p_list_ids);
end;
$$;
revoke all on function public.reorder_custom_lists(uuid[]) from public,anon;
grant execute on function public.reorder_custom_lists(uuid[]) to authenticated;
create index custom_list_items_order_idx on public.custom_list_items(list_id,position,watchlist_item_id);

-- Identity-only undo preserves post-merge tracking and notes. Both identities must be restored,
-- including when the most recently updated winner was the right-hand provider.
create or replace function public.undo_media_merge(p_winner_id uuid,p_loser_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); winner public.watchlist_items; loser public.watchlist_items; winner_media uuid; loser_media uuid; a text; b text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,74));
  select * into winner from public.watchlist_items where id=p_winner_id and user_id=uid and merged_into_id is null for update;
  select * into loser from public.watchlist_items where id=p_loser_id and user_id=uid and merged_into_id=p_winner_id for update;
  if winner.id is null or loser.id is null then raise exception 'Merge pair not found' using errcode='P0002'; end if;
  select media_id into winner_media from public.media_aliases where provider=winner.source and external_id=winner.external_id;
  select media_id into loser_media from public.media_aliases where provider=loser.source and external_id=loser.external_id;
  if winner_media is null or loser_media is null or winner_media=loser_media then raise exception 'Original identities cannot be separated safely' using errcode='40001'; end if;
  if exists(select 1 from public.watchlist_items where user_id=uid and merged_into_id=winner.id and id<>loser.id)
    or exists(select 1 from public.user_media_alias_links where user_id=uid and media_id=winner.media_id
      and not ((provider=winner.source and external_id=winner.external_id) or (provider=loser.source and external_id=loser.external_id)))
    or exists(select 1 from public.user_media_alias_links where user_id=uid and ((provider=winner.source and external_id=winner.external_id) or (provider=loser.source and external_id=loser.external_id)) and media_id<>winner.media_id)
    or exists(select 1 from public.watchlist_items where user_id=uid and merged_into_id is null and id<>winner.id and media_id in(winner_media,loser_media)) then
    raise exception 'Alias mapping changed or merge chain exists; undo would be unsafe' using errcode='40001';
  end if;
  delete from public.user_media_alias_links where user_id=uid and ((provider=winner.source and external_id=winner.external_id) or (provider=loser.source and external_id=loser.external_id));
  update public.watchlist_items set media_id=winner_media where id=winner.id returning * into winner;
  update public.watchlist_items set media_id=loser_media,merged_into_id=null,merge_reason=null where id=loser.id returning * into loser;
  a:=least(winner.source||':'||winner.external_id,loser.source||':'||loser.external_id);
  b:=greatest(winner.source||':'||winner.external_id,loser.source||':'||loser.external_id);
  insert into public.user_media_match_decisions(user_id,alias_a,alias_b,decision) values(uid,a,b,'rejected')
    on conflict(user_id,alias_a,alias_b) do update set decision='rejected',updated_at=now();
  return jsonb_build_object('decision','undone','winner',to_jsonb(winner),'loser',to_jsonb(loser));
end;
$$;
revoke all on function public.undo_media_merge(uuid,uuid) from public,anon;
grant execute on function public.undo_media_merge(uuid,uuid) to authenticated;

create table public.media_match_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  alias_a text not null, alias_b text not null,
  old_decision text, new_decision text,
  created_at timestamptz not null default now()
);
alter table public.media_match_audit enable row level security;
revoke all on public.media_match_audit from public,anon,authenticated;
grant select on public.media_match_audit to authenticated;
grant all on public.media_match_audit to service_role;
create policy "Read own match audit" on public.media_match_audit for select to authenticated using(user_id=(select auth.uid()));
create index media_match_audit_owner_idx on public.media_match_audit(user_id,created_at desc,id desc);
create or replace function private.audit_media_decision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' and not exists(select 1 from auth.users where id=old.user_id) then return null; end if;
  if tg_op='INSERT' then
    insert into public.media_match_audit(user_id,alias_a,alias_b,new_decision) values(new.user_id,new.alias_a,new.alias_b,new.decision);
  elsif tg_op='DELETE' then
    insert into public.media_match_audit(user_id,alias_a,alias_b,old_decision) values(old.user_id,old.alias_a,old.alias_b,old.decision);
  elsif old.decision is distinct from new.decision then
    insert into public.media_match_audit(user_id,alias_a,alias_b,old_decision,new_decision) values(new.user_id,new.alias_a,new.alias_b,old.decision,new.decision);
  end if;
  return null;
end;
$$;
revoke all on function private.audit_media_decision() from public,anon,authenticated;
create trigger media_decision_audit after insert or update or delete on public.user_media_match_decisions for each row execute function private.audit_media_decision();

-- TMDB TV is a series; AniList is typically a season/cour. Never merge their title counters.
alter function public.confirm_media_match(text,text,text,text) set schema private;
alter function private.confirm_media_match(text,text,text,text) rename to confirm_title_media_match;
revoke all on function private.confirm_title_media_match(text,text,text,text) from public,anon,authenticated;
create function public.confirm_media_match(p_left_provider text,p_left_external_id text,p_right_provider text,p_right_external_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text,74));
  if (p_left_provider='tmdb' and p_left_external_id like 'tv:%' and p_right_provider='anilist')
    or (p_right_provider='tmdb' and p_right_external_id like 'tv:%' and p_left_provider='anilist') then
    raise exception 'Use a season-level match: TMDB series and AniList season counters must stay separate' using errcode='22023';
  end if;
  return private.confirm_title_media_match(p_left_provider,p_left_external_id,p_right_provider,p_right_external_id);
end;
$$;
revoke all on function public.confirm_media_match(text,text,text,text) from public,anon;
grant execute on function public.confirm_media_match(text,text,text,text) to authenticated;
create table public.anime_season_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_item_id uuid not null,
  season integer not null check(season between 1 and 999),
  anilist_external_id text not null check(anilist_external_id ~ '^[1-9][0-9]{0,9}$'),
  updated_at timestamptz not null default now(),
  primary key(watchlist_item_id,season),
  unique(user_id,anilist_external_id),
  foreign key(watchlist_item_id,user_id) references public.watchlist_items(id,user_id) on delete cascade
);
alter table public.anime_season_matches enable row level security;
revoke all on public.anime_season_matches from public,anon,authenticated;
grant select on public.anime_season_matches to authenticated;
grant all on public.anime_season_matches to service_role;
create policy "Read own season matches" on public.anime_season_matches for select to authenticated using(user_id=(select auth.uid()));
create function public.save_anime_season_match(p_item_id uuid,p_season integer,p_anilist_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid()); item public.watchlist_items; previous text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_season is null or p_season not between 1 and 999 or (p_anilist_id is not null and p_anilist_id !~ '^[1-9][0-9]{0,9}$') then raise exception 'Invalid season match' using errcode='22023'; end if;
  select * into item from public.watchlist_items where id=p_item_id and user_id=uid and source='tmdb' and external_id like 'tv:%' and merged_into_id is null for update;
  if item.id is null then raise exception 'TMDB series not found' using errcode='P0002'; end if;
  if p_anilist_id is not null and not exists(select 1 from public.watchlist_items where user_id=uid and source='anilist' and external_id=p_anilist_id and merged_into_id is null) then
    raise exception 'Add the AniList season to your library first' using errcode='22023';
  end if;
  select anilist_external_id into previous from public.anime_season_matches where watchlist_item_id=p_item_id and season=p_season;
  if p_anilist_id is null then delete from public.anime_season_matches where watchlist_item_id=p_item_id and season=p_season;
  else insert into public.anime_season_matches(user_id,watchlist_item_id,season,anilist_external_id) values(uid,p_item_id,p_season,p_anilist_id)
    on conflict(watchlist_item_id,season) do update set anilist_external_id=excluded.anilist_external_id,updated_at=now(); end if;
  if previous is distinct from p_anilist_id then
    insert into public.media_match_audit(user_id,alias_a,alias_b,old_decision,new_decision)
      values(uid,'tmdb:'||item.external_id||':season:'||p_season,'anilist:'||coalesce(p_anilist_id,previous),previous,p_anilist_id);
  end if;
  return jsonb_build_object('season',p_season,'anilist_external_id',p_anilist_id);
end;
$$;
revoke all on function public.save_anime_season_match(uuid,integer,text) from public,anon;
grant execute on function public.save_anime_season_match(uuid,integer,text) to authenticated;

-- Provider-local, shared public metadata; never accepts browser-supplied snapshots.
create table public.media_catalog (
  provider text not null check(provider in('tmdb','anilist')),
  external_id text not null check(char_length(external_id) between 1 and 80),
  title text not null check(char_length(title) between 1 and 300),
  payload jsonb not null check(jsonb_typeof(payload)='object' and payload ? 'item' and payload ? 'details'),
  refreshed_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('simple'::regconfig,title)) stored,
  primary key(provider,external_id)
);
alter table public.media_catalog enable row level security;
revoke all on public.media_catalog from public,anon,authenticated;
grant select on public.media_catalog to anon,authenticated;
grant all on public.media_catalog to service_role;
create policy "Public provider metadata" on public.media_catalog for select to anon,authenticated using(true);
create index media_catalog_search_idx on public.media_catalog using gin(search_document);
create index media_catalog_refreshed_idx on public.media_catalog(refreshed_at);
create function public.search_media_catalog(p_query text,p_limit integer default 30)
returns table(provider text,external_id text,title text,payload jsonb,refreshed_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_query is null or char_length(btrim(p_query)) not between 2 and 100 or p_limit is null or p_limit not between 1 and 30 then raise exception 'Invalid catalog search' using errcode='22023'; end if;
  return query select c.provider,c.external_id,c.title,c.payload,c.refreshed_at from public.media_catalog c
    where c.search_document @@ plainto_tsquery('simple'::regconfig,btrim(p_query))
    order by ts_rank(c.search_document,plainto_tsquery('simple'::regconfig,btrim(p_query))) desc,c.title,c.provider,c.external_id limit p_limit;
end;
$$;
revoke all on function public.search_media_catalog(text,integer) from public;
grant execute on function public.search_media_catalog(text,integer) to anon,authenticated,service_role;

-- Retain owner-scoped history after title deletion; never snapshot private note text.
alter table public.watchlist_events drop constraint watchlist_events_watchlist_item_id_user_id_fkey;
alter table public.watchlist_events drop constraint watchlist_events_event_type_check;
alter table public.watchlist_events add constraint watchlist_events_event_type_check
  check(event_type in ('created','tracking_updated','merged','unmerged','removed'));
create or replace function private.record_watchlist_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare before_state jsonb; after_state jsonb; event text;
begin
  -- Account erasure must cascade without re-creating history for the deleted owner.
  if tg_op='DELETE' and not exists(select 1 from auth.users where id=old.user_id) then return null; end if;
  if tg_op <> 'INSERT' then
    before_state:=jsonb_build_object('status',old.status,'currentEpisode',old.current_episode,'totalEpisodes',old.total_episodes,
      'personalRating',old.personal_rating,'isFavorite',old.is_favorite,'isRewatching',old.is_rewatching,
      'rewatchCount',old.rewatch_count,'startedOn',old.started_on,'completedOn',old.completed_on,'mergeReason',old.merge_reason);
  end if;
  if tg_op <> 'DELETE' then
    after_state:=jsonb_build_object('status',new.status,'currentEpisode',new.current_episode,'totalEpisodes',new.total_episodes,
      'personalRating',new.personal_rating,'isFavorite',new.is_favorite,'isRewatching',new.is_rewatching,
      'rewatchCount',new.rewatch_count,'startedOn',new.started_on,'completedOn',new.completed_on,'mergeReason',new.merge_reason);
  end if;
  if tg_op='DELETE' then event:='removed';
  elsif tg_op='INSERT' then event:='created';
  elsif old.merged_into_id is distinct from new.merged_into_id then
    event:=case when new.merged_into_id is null then 'unmerged' else 'merged' end;
  elsif before_state is distinct from after_state or old.private_notes is distinct from new.private_notes then
    event:='tracking_updated';
    if old.private_notes is distinct from new.private_notes then after_state:=after_state||'{"notesChanged":true}'::jsonb; end if;
  else return null;
  end if;
  insert into public.watchlist_events(user_id,watchlist_item_id,event_type,old_value,new_value,origin)
    values(case when tg_op='DELETE' then old.user_id else new.user_id end,
      case when tg_op='DELETE' then old.id else new.id end,event,before_state,after_state,
      case when (select auth.uid()) is null then 'integration' else 'web' end);
  return null;
end;
$$;
drop trigger watchlist_record_event on public.watchlist_items;
create trigger watchlist_record_event after insert or update or delete on public.watchlist_items
  for each row execute function private.record_watchlist_event();

create function public.get_watch_activity(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); start_at timestamptz; result jsonb; seasons jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_days is null or p_days not between 1 and 366 then raise exception 'Invalid activity window' using errcode='22023'; end if;
  start_at:=((now() at time zone 'UTC')::date-(p_days-1))::timestamp at time zone 'UTC';
  select jsonb_build_object('totalEvents',count(*),'updates',count(*) filter(where event_type='tracking_updated'),
    'added',count(*) filter(where event_type='created'),'removed',count(*) filter(where event_type='removed'),
    'completions',count(*) filter(where event_type in ('created','tracking_updated') and new_value->>'status'='Watched' and old_value->>'status' is distinct from 'Watched'),
    'activeDays',count(distinct (created_at at time zone 'UTC')::date),'days',p_days) into result
    from public.watchlist_events where user_id=uid and created_at>=start_at and created_at<=now();
  select jsonb_build_object('trackedSeasons',count(*),'completedSeasons',count(*) filter(where s.total_episodes is not null and s.current_episode=s.total_episodes)) into seasons
    from public.season_progress s join public.watchlist_items w on w.id=s.watchlist_item_id
    where s.user_id=uid and w.merged_into_id is null;
  return result||seasons||jsonb_build_object('daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'events',events) order by day)
    from (select (created_at at time zone 'UTC')::date as day,count(*) as events from public.watchlist_events
      where user_id=uid and created_at>=start_at and created_at<=now() group by day) daily),'[]'::jsonb));
end;
$$;
revoke all on function public.get_watch_activity(integer) from public,anon;
grant execute on function public.get_watch_activity(integer) to authenticated;

create index watchlist_public_page_idx on public.watchlist_items(user_id,updated_at desc,id desc) where merged_into_id is null;
create or replace function private.resolve_public_username(p_username text)
returns text language sql stable security invoker set search_path='' as $$
  select candidate.username from (
    select p.username,0 as priority from public.profiles p where p.username=lower(btrim(p_username)) and p.is_public
    union all
    select p.username,1 from public.username_history h join public.profiles p on p.user_id=h.user_id
      where h.username=lower(btrim(p_username)) and h.redirect_until>now() and p.is_public
  ) candidate order by candidate.priority limit 1;
$$;
create or replace function public.get_public_library(p_username text,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare requested text:=lower(btrim(p_username)); current_name text; p public.profiles; items jsonb; more boolean;
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid public library request' using errcode='22023'; end if;
  current_name:=private.resolve_public_username(requested);
  select * into p from public.profiles where username=current_name and is_public and show_library;
  if p.user_id is null then return null; end if;
  select coalesce(jsonb_agg(private.public_watchlist_item(w) order by w.updated_at desc,w.id desc),'[]'::jsonb) into items
    from (select * from public.watchlist_items where user_id=p.user_id and merged_into_id is null order by updated_at desc,id desc limit p_limit+1 offset p_offset) w;
  more:=jsonb_array_length(items)>p_limit and p_offset+p_limit<=10000;
  if jsonb_array_length(items)>p_limit then items:=items-p_limit; end if;
  return jsonb_build_object('redirectUsername',case when requested<>current_name then current_name else null end,'username',p.username,'displayName',p.display_name,'items',items,'hasMore',more,'nextOffset',case when more then p_offset+p_limit else null end);
end;
$$;
create or replace function public.get_public_list(p_username text,p_list_slug text,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare requested text:=lower(btrim(p_username)); list_slug text:=lower(btrim(p_list_slug)); current_name text; p public.profiles; l public.custom_lists; items jsonb; more boolean;
begin
  if requested is null or requested !~ '^[a-z0-9_]{3,30}$' or list_slug is null or list_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(list_slug)>80
    or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid public list request' using errcode='22023'; end if;
  current_name:=private.resolve_public_username(requested);
  select * into p from public.profiles where username=current_name and is_public;
  if p.user_id is null then return null; end if;
  select * into l from public.custom_lists where user_id=p.user_id and slug=list_slug and is_public;
  if l.id is null then return null; end if;
  select coalesce(jsonb_agg(private.public_watchlist_item(listed.item) order by listed.position,listed.id),'[]'::jsonb) into items
    from (select w as item,cli.position,w.id from public.custom_list_items cli join public.watchlist_items w on w.id=cli.watchlist_item_id and w.user_id=cli.user_id
      where cli.list_id=l.id and w.merged_into_id is null order by cli.position,w.id limit p_limit+1 offset p_offset) listed;
  more:=jsonb_array_length(items)>p_limit and p_offset+p_limit<=10000;
  if jsonb_array_length(items)>p_limit then items:=items-p_limit; end if;
  return jsonb_build_object('redirectUsername',case when requested<>current_name then current_name else null end,'username',p.username,'displayName',p.display_name,'name',l.name,'slug',l.slug,'items',items,'hasMore',more,'nextOffset',case when more then p_offset+p_limit else null end);
end;
$$;
