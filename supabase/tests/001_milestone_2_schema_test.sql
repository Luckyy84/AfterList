begin;

select no_plan();

select ok(to_regclass('public.media_entities') is not null, 'canonical media table exists');
select ok(to_regclass('public.media_aliases') is not null, 'provider alias table exists');
select ok(to_regclass('public.user_media_alias_links') is not null, 'per-user alias links exist');
select ok(to_regclass('public.user_media_match_decisions') is not null, 'match decisions exist');
select ok(to_regclass('public.custom_lists') is not null, 'custom lists exist');
select ok(to_regclass('public.custom_list_items') is not null, 'custom list membership exists');
select ok(to_regclass('public.watchlist_events') is not null, 'private tracking events exist');

select ok(
  not exists (
    select 1
    from (values
      ('media_entities'), ('media_aliases'), ('user_media_alias_links'),
      ('user_media_match_decisions'), ('custom_lists'), ('custom_list_items'), ('watchlist_events')
    ) expected(table_name)
    left join pg_class c on c.oid = to_regclass('public.' || expected.table_name)
    where not coalesce(c.relrowsecurity, false)
  ),
  'RLS is enabled on every Milestone 2 table'
);

select ok(
  not has_table_privilege('anon', 'public.user_media_alias_links', 'select')
    and not has_table_privilege('anon', 'public.user_media_match_decisions', 'select')
    and not has_table_privilege('anon', 'public.custom_lists', 'select')
    and not has_table_privilege('anon', 'public.custom_list_items', 'select')
    and not has_table_privilege('anon', 'public.watchlist_events', 'select'),
  'anon has no direct access to user-owned Milestone 2 tables'
);

select ok(
  has_table_privilege('anon', 'public.media_entities', 'select')
    and has_table_privilege('anon', 'public.media_aliases', 'select'),
  'anon may read only provider identity metadata'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'watchlist_items_active_media_idx' and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'one active watchlist row per user and canonical media is enforced'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_aliases'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (provider, external_id)'
  ),
  'provider aliases are globally unique'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.watchlist_items'::regclass
      and conname = 'watchlist_items_status_v2_check'
      and pg_get_constraintdef(oid) like '%Paused%'
  ),
  'Paused is included in the database status constraint'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.watchlist_items'::regclass and conname = 'watchlist_items_rewatch_count_check'
  ) and exists (
    select 1 from pg_constraint
    where conrelid = 'public.watchlist_items'::regclass and conname = 'watchlist_items_dates_check'
  ),
  'rewatch and tracking-date constraints exist'
);

select ok(
  to_regprocedure('public.confirm_media_match(text,text,text,text)') is not null
    and to_regprocedure('public.reject_media_match(text,text,text,text)') is not null,
  'confirm and reject match RPC contracts exist'
);

select ok(
  has_function_privilege('authenticated', 'public.confirm_media_match(text,text,text,text)', 'execute')
    and has_function_privilege('authenticated', 'public.reject_media_match(text,text,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.confirm_media_match(text,text,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.reject_media_match(text,text,text,text)', 'execute'),
  'match RPC execution is authenticated-only'
);

select ok(
  to_regprocedure('public.upsert_watchlist_from_api(text,jsonb)') is not null
    and has_function_privilege('service_role', 'public.upsert_watchlist_from_api(text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.upsert_watchlist_from_api(text,jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.upsert_watchlist_from_api(text,jsonb)', 'execute'),
  'v1 integration upsert remains service-role-only'
);

select ok(
  not exists (
    select 1
    from (values
      ('source'), ('external_id'), ('status'), ('current_episode'), ('total_episodes'),
      ('runtime_minutes'), ('personal_rating'), ('is_favorite'), ('updated_at')
    ) expected(column_name)
    left join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = 'watchlist_items' and c.column_name = expected.column_name
    where c.column_name is null
  ),
  'legacy v1 watchlist columns remain available'
);

select * from finish();
rollback;
