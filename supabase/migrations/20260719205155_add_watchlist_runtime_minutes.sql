alter table public.watchlist_items
  add column if not exists runtime_minutes integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_runtime_minutes_check') then
    alter table public.watchlist_items
      add constraint watchlist_items_runtime_minutes_check
      check (runtime_minutes is null or runtime_minutes > 0);
  end if;
end $$;
