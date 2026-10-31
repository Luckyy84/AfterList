-- Browser edits are authenticated, atomic, idempotent snapshots; no client-supplied owner.
create table public.watchlist_tombstones (
 user_id uuid not null references auth.users(id) on delete cascade,
 source text not null, external_id text not null, removed_at timestamptz not null,
 primary key(user_id,source,external_id)
);
alter table public.watchlist_tombstones enable row level security;
revoke all on public.watchlist_tombstones from public,anon,authenticated;
grant select on public.watchlist_tombstones to authenticated;
create policy "Owners read removal timestamps" on public.watchlist_tombstones for select to authenticated using (user_id=(select auth.uid()));
create or replace function private.record_watchlist_removal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
 insert into public.watchlist_tombstones values(old.user_id,old.source,old.external_id,greatest(clock_timestamp(),old.updated_at))
 on conflict(user_id,source,external_id) do update set removed_at=greatest(watchlist_tombstones.removed_at,excluded.removed_at);
 return old;
end $$;
revoke all on function private.record_watchlist_removal() from public,anon,authenticated;
create trigger watchlist_record_removal after delete on public.watchlist_items for each row execute function private.record_watchlist_removal();
create or replace function public.apply_browser_watchlist_edit(p_item jsonb,p_removed boolean default false,p_owner uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user_id uuid := auth.uid(); v_row public.watchlist_items; stamp timestamptz; removed timestamptz;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_owner is distinct from v_user_id then raise exception 'Account changed' using errcode='28000'; end if;
 if p_removed is null or p_item->>'source' is null or p_item->>'source' not in ('tmdb','anilist')
 or coalesce(length(p_item->>'externalId'),0) not between 1 and 80 or p_item->>'updatedAt' is null
 or (p_item->>'source'='anilist' and p_item->>'externalId' !~ '^[1-9][0-9]*$')
 or (p_item->>'source'='tmdb' and p_item->>'externalId' !~ '^(movie|tv):[1-9][0-9]*$') then
 raise exception 'Invalid edit' using errcode='22023'; end if;
 stamp := (p_item->>'updatedAt')::timestamptz;
 if not isfinite(stamp) or stamp > clock_timestamp()+interval '5 minutes' then raise exception 'Invalid edit timestamp' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':'||(p_item->>'source')||':'||(p_item->>'externalId'),0));
 select * into v_row from public.watchlist_items where user_id=v_user_id and source=p_item->>'source' and external_id=p_item->>'externalId' for update;
 select removed_at into removed from public.watchlist_tombstones where user_id=v_user_id and source=p_item->>'source' and external_id=p_item->>'externalId';
 if stamp <= removed or stamp < v_row.updated_at or (not p_removed and stamp = v_row.updated_at) then
 return jsonb_build_object('applied',false); end if;
 if v_row.merged_into_id is not null then raise exception 'Media identity changed; review this edit' using errcode='40001'; end if;
 if p_removed then
 delete from public.watchlist_items where user_id=v_user_id and source=p_item->>'source' and external_id=p_item->>'externalId';
 -- The delete trigger uses server time for direct deletes. Browser replay must
 -- retain the edit time instead; the locked timestamp checks above already won.
 insert into public.watchlist_tombstones values(v_user_id,p_item->>'source',p_item->>'externalId',stamp)
 on conflict(user_id,source,external_id) do update set removed_at=excluded.removed_at;
 return jsonb_build_object('applied',true);
 end if;
  insert into public.watchlist_items(user_id,external_id,source,title,type,status,poster,backdrop,progress,rating,description,year,
    current_episode,total_episodes,runtime_minutes,personal_rating,is_favorite,is_rewatching,rewatch_count,started_on,completed_on,private_notes,updated_at)
  values(v_user_id,p_item->>'externalId',p_item->>'source',p_item->>'title',p_item->>'type',p_item->>'status',coalesce(p_item->>'poster',''),
    coalesce(p_item->>'backdrop',''),coalesce(p_item->>'progress',''),coalesce(p_item->>'rating','N/A'),coalesce(p_item->>'description',''),p_item->>'year',
    coalesce((p_item->>'currentEpisode')::integer,0),(p_item->>'totalEpisodes')::integer,(p_item->>'runtimeMinutes')::integer,
    (p_item->>'personalRating')::smallint,coalesce((p_item->>'isFavorite')::boolean,false),coalesce((p_item->>'isRewatching')::boolean,false),
    coalesce((p_item->>'rewatchCount')::integer,0),(p_item->>'startedAt')::date,(p_item->>'completedAt')::date,p_item->>'privateNotes',(p_item->>'updatedAt')::timestamptz)
  on conflict(user_id,source,external_id) do update set
    title=excluded.title,
    type=excluded.type,
    status=excluded.status,
    poster=excluded.poster,
    backdrop=excluded.backdrop,
    progress=excluded.progress,
    rating=excluded.rating,
    description=excluded.description,
    year=excluded.year,
    current_episode=excluded.current_episode,
    total_episodes=excluded.total_episodes,
    runtime_minutes=excluded.runtime_minutes,
    personal_rating=excluded.personal_rating,
    is_favorite=excluded.is_favorite,
    is_rewatching=excluded.is_rewatching,
    rewatch_count=excluded.rewatch_count,
    started_on=excluded.started_on,
    completed_on=excluded.completed_on,
    private_notes=excluded.private_notes,
    updated_at=excluded.updated_at
 where excluded.updated_at > public.watchlist_items.updated_at;
 return jsonb_build_object('applied',true);
end $$;
revoke all on function public.apply_browser_watchlist_edit(jsonb,boolean,uuid) from public,anon;
grant execute on function public.apply_browser_watchlist_edit(jsonb,boolean,uuid) to authenticated;

-- One durable daily job, three invocations maximum; expired workers cannot finish a newer lease.
create table public.refresh_jobs (
 job_day date primary key, status text not null check(status in ('running','failed','succeeded')),
 attempts integer not null check(attempts between 1 and 3), lease uuid not null,
 started_at timestamptz not null, finished_at timestamptz,
 scanned integer not null default 0, updated integer not null default 0, failed integer not null default 0
);
alter table public.refresh_jobs enable row level security;
revoke all on public.refresh_jobs from public,anon,authenticated;
grant select on public.refresh_jobs to service_role;
create or replace function public.claim_refresh_job(p_day date,p_start boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
 insert into public.refresh_jobs(job_day,status,attempts,lease,started_at)
 select p_day,'running',1,gen_random_uuid(),clock_timestamp()
 where p_start or exists(select 1 from public.refresh_jobs where job_day=p_day)
 on conflict(job_day) do update set status='running',attempts=refresh_jobs.attempts+1,
 lease=gen_random_uuid(),started_at=clock_timestamp(),finished_at=null
 where refresh_jobs.attempts<3 and (refresh_jobs.status='failed' or
 (refresh_jobs.status='running' and refresh_jobs.started_at<clock_timestamp()-interval '10 minutes'))
 returning lease into token;
 return token;
end $$;
create or replace function public.finish_refresh_job(p_day date,p_lease uuid,p_ok boolean,p_scanned integer,p_updated integer,p_failed integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.refresh_jobs set status=case when p_ok then 'succeeded' else 'failed' end,
 finished_at=clock_timestamp(),scanned=p_scanned,updated=p_updated,failed=p_failed
 where job_day=p_day and lease=p_lease and status='running';
 return found;
end $$;
revoke all on function public.claim_refresh_job(date,boolean) from public,anon,authenticated;
revoke all on function public.finish_refresh_job(date,uuid,boolean,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_refresh_job(date,boolean) to service_role;
grant execute on function public.finish_refresh_job(date,uuid,boolean,integer,integer,integer) to service_role;
