create or replace function public.upsert_watchlist_from_api(p_token_hash text, p_item jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_row public.watchlist_items;
  v_exact public.watchlist_items;
  v_applied boolean;
  v_starting_rewatch boolean := false;
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
    v_starting_rewatch := coalesce((p_item->>'is_rewatching')::boolean,false) and not v_row.is_rewatching;

    update public.watchlist_items set
      title=p_item->>'title', type=p_item->>'type',
      status=case when v_starting_rewatch then 'Watching' when coalesce((p_item->>'current_episode')::integer,0)<v_row.current_episode then v_row.status else p_item->>'status' end,
      poster=case when coalesce(p_item->>'poster','')='' then v_row.poster else p_item->>'poster' end,
      backdrop=case when coalesce(p_item->>'backdrop','')='' then v_row.backdrop else p_item->>'backdrop' end,
      progress=case when v_starting_rewatch then case when v_row.total_episodes is null then '0 episodes' else '0/'||v_row.total_episodes||' episodes' end when coalesce((p_item->>'current_episode')::integer,0)<v_row.current_episode then v_row.progress else coalesce(p_item->>'progress','') end,
      rating=coalesce(p_item->>'rating','N/A'),
      description=case when coalesce(p_item->>'description','')='' then v_row.description else p_item->>'description' end,
      year=coalesce(p_item->>'year',v_row.year),
      current_episode=case when v_starting_rewatch then 0 else greatest(coalesce((p_item->>'current_episode')::integer,0),v_row.current_episode) end,
      total_episodes=case when p_item->>'total_episodes' is null and v_row.total_episodes is null then null else greatest(coalesce((p_item->>'total_episodes')::integer,0),coalesce(v_row.total_episodes,0),case when v_starting_rewatch then 0 else coalesce((p_item->>'current_episode')::integer,0) end) end,
      runtime_minutes=coalesce((p_item->>'runtime_minutes')::integer,v_row.runtime_minutes),
      personal_rating=coalesce((p_item->>'personal_rating')::smallint,v_row.personal_rating),
      is_favorite=coalesce((p_item->>'is_favorite')::boolean,v_row.is_favorite),
      is_rewatching=coalesce((p_item->>'is_rewatching')::boolean,v_row.is_rewatching),
      rewatch_count=greatest(coalesce((p_item->>'rewatch_count')::integer,0),v_row.rewatch_count),
      started_on=case when v_starting_rewatch then coalesce((p_item->>'started_on')::date,(p_item->>'updated_at')::timestamptz::date) else coalesce((p_item->>'started_on')::date,v_row.started_on) end,
      completed_on=case when v_starting_rewatch then null else coalesce((p_item->>'completed_on')::date,v_row.completed_on) end,
      private_notes=coalesce(p_item->>'private_notes',v_row.private_notes),
      updated_at=(p_item->>'updated_at')::timestamptz
    where id=v_row.id and (p_item->>'updated_at')::timestamptz>=v_row.updated_at
    returning * into v_row;
    v_applied:=found;
    if not v_applied then select * into v_row from public.watchlist_items where id=v_exact.merged_into_id; end if;
    update public.api_tokens set last_used_at=now() where token_hash=p_token_hash;
    return jsonb_build_object('applied',v_applied,'item',to_jsonb(v_row));
  end if;

  v_starting_rewatch := v_exact.id is not null
    and coalesce((p_item->>'is_rewatching')::boolean,false)
    and not v_exact.is_rewatching;

  insert into public.watchlist_items(user_id,external_id,source,title,type,status,poster,backdrop,progress,rating,description,year,
    current_episode,total_episodes,runtime_minutes,personal_rating,is_favorite,is_rewatching,rewatch_count,started_on,completed_on,private_notes,updated_at)
  values(v_user_id,p_item->>'external_id',p_item->>'source',p_item->>'title',p_item->>'type',p_item->>'status',coalesce(p_item->>'poster',''),
    coalesce(p_item->>'backdrop',''),coalesce(p_item->>'progress',''),coalesce(p_item->>'rating','N/A'),coalesce(p_item->>'description',''),p_item->>'year',
    coalesce((p_item->>'current_episode')::integer,0),(p_item->>'total_episodes')::integer,(p_item->>'runtime_minutes')::integer,
    (p_item->>'personal_rating')::smallint,coalesce((p_item->>'is_favorite')::boolean,false),coalesce((p_item->>'is_rewatching')::boolean,false),
    coalesce((p_item->>'rewatch_count')::integer,0),(p_item->>'started_on')::date,(p_item->>'completed_on')::date,p_item->>'private_notes',(p_item->>'updated_at')::timestamptz)
  on conflict(user_id,source,external_id) do update set
    title=excluded.title,type=excluded.type,
    status=case when v_starting_rewatch then 'Watching' when excluded.current_episode<public.watchlist_items.current_episode then public.watchlist_items.status else excluded.status end,
    poster=case when excluded.poster='' then public.watchlist_items.poster else excluded.poster end,
    backdrop=case when excluded.backdrop='' then public.watchlist_items.backdrop else excluded.backdrop end,
    progress=case when v_starting_rewatch then case when public.watchlist_items.total_episodes is null then '0 episodes' else '0/'||public.watchlist_items.total_episodes||' episodes' end when excluded.current_episode<public.watchlist_items.current_episode then public.watchlist_items.progress else excluded.progress end,
    rating=excluded.rating,description=case when excluded.description='' then public.watchlist_items.description else excluded.description end,
    year=coalesce(excluded.year,public.watchlist_items.year),
    current_episode=case when v_starting_rewatch then 0 else greatest(excluded.current_episode,public.watchlist_items.current_episode) end,
    total_episodes=case when excluded.total_episodes is null and public.watchlist_items.total_episodes is null then null else greatest(coalesce(excluded.total_episodes,0),coalesce(public.watchlist_items.total_episodes,0),case when v_starting_rewatch then 0 else excluded.current_episode end) end,
    runtime_minutes=coalesce(excluded.runtime_minutes,public.watchlist_items.runtime_minutes),personal_rating=coalesce(excluded.personal_rating,public.watchlist_items.personal_rating),
    is_favorite=excluded.is_favorite,is_rewatching=coalesce((p_item->>'is_rewatching')::boolean,public.watchlist_items.is_rewatching),rewatch_count=greatest(excluded.rewatch_count,public.watchlist_items.rewatch_count),
    started_on=case when v_starting_rewatch then coalesce(excluded.started_on,excluded.updated_at::date) else coalesce(excluded.started_on,public.watchlist_items.started_on) end,
    completed_on=case when v_starting_rewatch then null else coalesce(excluded.completed_on,public.watchlist_items.completed_on) end,
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
