-- The old transaction-local GUC remained on after claim_profile_username, allowing
-- a direct username update later in that transaction. Only the definer may mutate.
create or replace function private.protect_profile_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
  if current_user in ('anon', 'authenticated') or current_setting('afterlist.username_rpc', true) is distinct from 'on' then
    raise exception 'Username changes must use claim_profile_username' using errcode = '42501';
  end if;
  new.username := lower(btrim(new.username));
  return new;
end;
$$;

-- Server-only, transactional throttling; no browser grants or exposed schema.
create table private.account_reauth_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0)
);
revoke all on private.account_reauth_attempts from public, anon, authenticated;
create function public.consume_account_reauth_attempt(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  insert into private.account_reauth_attempts(user_id) values (p_user_id)
  on conflict (user_id) do update set
    attempts = case when private.account_reauth_attempts.window_started_at < now() - interval '15 minutes' then 1 else private.account_reauth_attempts.attempts + 1 end,
    window_started_at = case when private.account_reauth_attempts.window_started_at < now() - interval '15 minutes' then now() else private.account_reauth_attempts.window_started_at end
  returning attempts into used;
  return used <= 5;
end;
$$;
revoke all on function public.consume_account_reauth_attempt(uuid) from public, anon, authenticated;
grant execute on function public.consume_account_reauth_attempt(uuid) to service_role;

-- Least privilege for newly issued integration credentials, also enforced for direct service writes.
alter table public.api_tokens alter column scopes set default array['watchlist:read']::text[];
alter table public.api_tokens add constraint api_tokens_scopes_systems_foundation check (
  cardinality(scopes) between 1 and 2 and scopes <@ array['watchlist:read','watchlist:write']::text[]
) not valid;
alter table public.api_tokens validate constraint api_tokens_scopes_systems_foundation;
