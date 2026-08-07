create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (char_length(token_hash) = 64),
  scopes text[] not null default array['watchlist:read', 'watchlist:write']::text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

alter table public.api_tokens enable row level security;
revoke all on table public.api_tokens from anon, authenticated;

delete from public.watchlist_items older
using public.watchlist_items newer
where older.user_id = newer.user_id
  and older.source = newer.source
  and older.external_id = newer.external_id
  and (older.updated_at, older.id) < (newer.updated_at, newer.id);

create unique index if not exists watchlist_items_identity_idx
  on public.watchlist_items (user_id, source, external_id);

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
    status = excluded.status,
    poster = case when excluded.poster = '' then public.watchlist_items.poster else excluded.poster end,
    backdrop = case when excluded.backdrop = '' then public.watchlist_items.backdrop else excluded.backdrop end,
    progress = excluded.progress,
    rating = excluded.rating,
    description = case when excluded.description = '' then public.watchlist_items.description else excluded.description end,
    year = coalesce(excluded.year, public.watchlist_items.year),
    current_episode = excluded.current_episode,
    total_episodes = coalesce(excluded.total_episodes, public.watchlist_items.total_episodes),
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
