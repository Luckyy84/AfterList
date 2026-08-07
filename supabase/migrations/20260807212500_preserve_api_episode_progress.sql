create or replace function public.upsert_watchlist_from_api(p_token_hash text, p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_row public.watchlist_items;
  v_applied boolean;
begin
  select user_id into v_user_id
  from public.api_tokens
  where token_hash = p_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and 'watchlist:write' = any(scopes);

  if v_user_id is null then
    raise exception 'Invalid integration token' using errcode = '28000';
  end if;

  insert into public.watchlist_items (
    user_id, external_id, source, title, type, status, poster, backdrop,
    progress, rating, description, year, current_episode, total_episodes,
    runtime_minutes, personal_rating, is_favorite, updated_at
  ) values (
    v_user_id,
    p_item->>'external_id',
    p_item->>'source',
    p_item->>'title',
    p_item->>'type',
    p_item->>'status',
    coalesce(p_item->>'poster', ''),
    coalesce(p_item->>'backdrop', ''),
    coalesce(p_item->>'progress', ''),
    coalesce(p_item->>'rating', 'N/A'),
    coalesce(p_item->>'description', ''),
    p_item->>'year',
    coalesce((p_item->>'current_episode')::integer, 0),
    (p_item->>'total_episodes')::integer,
    (p_item->>'runtime_minutes')::integer,
    (p_item->>'personal_rating')::smallint,
    coalesce((p_item->>'is_favorite')::boolean, false),
    (p_item->>'updated_at')::timestamptz
  )
  on conflict (user_id, source, external_id) do update set
    title = excluded.title,
    type = excluded.type,
    status = case
      when excluded.current_episode < public.watchlist_items.current_episode then public.watchlist_items.status
      else excluded.status
    end,
    poster = case when excluded.poster = '' then public.watchlist_items.poster else excluded.poster end,
    backdrop = case when excluded.backdrop = '' then public.watchlist_items.backdrop else excluded.backdrop end,
    progress = case
      when excluded.current_episode < public.watchlist_items.current_episode then public.watchlist_items.progress
      else excluded.progress
    end,
    rating = excluded.rating,
    description = case when excluded.description = '' then public.watchlist_items.description else excluded.description end,
    year = coalesce(excluded.year, public.watchlist_items.year),
    current_episode = greatest(excluded.current_episode, public.watchlist_items.current_episode),
    total_episodes = case
      when excluded.total_episodes is null and public.watchlist_items.total_episodes is null then null
      else greatest(
        coalesce(excluded.total_episodes, 0),
        coalesce(public.watchlist_items.total_episodes, 0),
        excluded.current_episode,
        public.watchlist_items.current_episode
      )
    end,
    runtime_minutes = coalesce(excluded.runtime_minutes, public.watchlist_items.runtime_minutes),
    personal_rating = coalesce(excluded.personal_rating, public.watchlist_items.personal_rating),
    is_favorite = excluded.is_favorite,
    updated_at = excluded.updated_at
  where excluded.updated_at >= public.watchlist_items.updated_at
  returning * into v_row;

  v_applied := found;
  if not v_applied then
    select * into v_row from public.watchlist_items
    where user_id = v_user_id
      and source = p_item->>'source'
      and external_id = p_item->>'external_id';
  end if;

  update public.api_tokens set last_used_at = now()
  where token_hash = p_token_hash;

  return jsonb_build_object('applied', v_applied, 'item', to_jsonb(v_row));
end;
$$;

revoke all on function public.upsert_watchlist_from_api(text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_watchlist_from_api(text, jsonb) to service_role;
