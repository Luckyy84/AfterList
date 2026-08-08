alter table public.api_tokens
  alter column expires_at set default (now() + interval '90 days');

update public.api_tokens
set expires_at = created_at + interval '90 days'
where expires_at is null
  and revoked_at is null;
