# Systems foundation: operations and acceptance

## Scope and deployment boundary

This branch adds CI, SQL regression coverage, account deletion, password/session hardening and least-privilege integration token selection. It does **not** apply migrations or change hosted Supabase/Vercel settings. No SMTP connection, email delivery, live database reset, production backup or restore was attempted.

Apply `20261030000100_systems_foundation.sql` only after reviewing it and backing up the target. It follows all existing migrations and adds a private per-user reauthentication attempt counter, a server-only throttling RPC, a token scope constraint/default and a profile username trigger fix. It does not rewrite existing token scopes. Existing unsupported token scopes cause validation to fail closed; inspect and resolve those rows deliberately rather than silently broadening access.

Deletion requires the migration: missing RPC/schema produces HTTP 503 with migration instructions, never success. Profile and token schema errors likewise explain migration requirements. Deploy the server functions together with the UI. Vite alone does not run `/api`; use a Vercel preview for full integration. Required variables are the existing Supabase URL and server-only secret/service-role key plus browser URL/publishable key. Never put the secret in a `VITE_` variable.

## Acceptance checks

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

GitHub Actions runs those checks plus a disposable Supabase stack, `supabase db reset --local --no-seed`, and `supabase test db --local`. CLI version is pinned to 2.122.0; Docker is required. No hosted credentials or `--linked` are used. The oldest migration already bootstraps an empty database; no baseline rewrite was needed.

SQL-only fallback, with PostgreSQL 17, pgTAP and `pg_prove` installed:

```sh
# Local socket only. Run as a local PostgreSQL superuser with access to this checkout.
runuser -u postgres -- bash supabase/verification/test-local-postgres.sh
```

The script creates a uniquely named disposable database, replays **every** migration with `ON_ERROR_STOP`, executes all pgTAP files and drops only that database on exit. Its bootstrap is an explicitly minimal auth users/UID contract, **not** a replacement for GoTrue or the full Supabase integration check. It accepts no remote URL. Full Supabase supplies `auth.users`, `auth.uid()`, `anon`, `authenticated`, `service_role` and pgTAP; do not install the fallback bootstrap into Supabase.

Observed locally: **151 unit tests in 43 files**, **28 desktop/mobile browser tests**, lint and production build passed. The owned account/token API files also passed standalone TypeScript checking. All migrations replayed on PostgreSQL 17; **130 pgTAP assertions passed**. Existing pgTAP tests had incorrect three-argument exception expectations (description was interpreted as exception message), an invalid nested data-modifying CTE and SQL NULL versus JSON null expectations. These were corrected without weakening their SQLSTATE or ownership assertions. A real failing username-mutation test exposed a transaction-local flag bypass; the new trigger also rejects direct `anon`/`authenticated` mutations even if the flag remains set.

Unit coverage verifies server-confirmed password deletion, deliberate confirmation, throttling, read-only/write token selection, invalid scopes, actionable migration errors, password limits, failed-session bootstrap and no-row privacy updates. Browser coverage exercises existing desktop and 320px flows without live account credentials. Unit API tests substitute Supabase boundaries; they are not a hosted end-to-end account deletion claim.

## Grants and RLS audit

All public application tables have RLS enabled, asserted by SQL. Raw watchlists/profiles/lists/events/match decisions are owner-scoped; anon has no raw personal-table access. Canonical media identity metadata is intentionally public. Curated public-profile RPCs intentionally permit anon reads but enforce saved visibility flags and never return token hashes or private notes. API tokens have no browser grants. Integration writes pass through the existing service-only scoped RPC. The new `private.account_reauth_attempts` table has no browser grants; only the service-role RPC can consume counters. Its upsert locks serialize concurrent attempts and allows five attempts per 15-minute window, with cascading removal on account deletion.

Useful read-only inventory on a disposable/approved audit connection:

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','private') order by 1,2,3;
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public','private') order by 1,2,3,4;
select n.nspname, p.proname, p.prosecdef, p.proconfig, p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prosecdef order by 1,2;
```

Run the SQL suite after every grant, policy, definer function or auth-FK change. Do not infer deployed grants from source: the live audit remains an operator task.

## Authentication, recovery and abuse controls

New/signup/reset passwords require 12–1024 characters; existing passwords remain usable at login. The same validation is in AuthContext, not just HTML. Supabase still owns session refresh, verification and recovery-link exchange. Failed initial session lookup no longer leaves the application loading forever. Password changes globally sign out via the existing flow.

Local Supabase config now uses 12-character server policy, confirmed email, secure password changes, one-minute email frequency, one-hour OTP lifetime and explicit native per-IP login/signup/verification limits. Recovery redirect is explicitly allowlisted. **Hosted projects do not inherit local config.** Before production acceptance an operator must review/set equivalent hosted settings, allowlist the exact deployed `/reset-password` URL, review SMTP quotas, enable leaked-password protection where supported, and enable Supabase CAPTCHA if abuse warrants it. Client-only cooldowns would be bypassable, so none are presented as security controls. No new email proxy was added.

Recovery acceptance in a disposable project: generate a test recovery link via local admin tooling, open it once, verify expired/reused links fail, set a compliant password, confirm global signout and old-password rejection. Do not test with real account email or live SMTP. Hosted delivery and native rate-limit enforcement remain unverified here.

## Account deletion

Settings → Account requires exact `DELETE` plus the current password. The authenticated bearer session chooses the user; no submitted user ID or client freshness timestamp is trusted. The server consumes a persisted attempt limit and verifies the password with Supabase immediately before deleting that same auth user. Wrong credentials cannot delete, integration bearer tokens cannot authenticate this endpoint, and a missing migration fails closed. Passwords/tokens are never logged or persisted by this code. Google-only users must first establish a password through recovery; OAuth freshness is not guessed from JWT issuance time.

Auth deletion cascades account-owned FK rows (watchlists, profiles, lists, events, match decisions, username history, integration tokens, throttle state). Shared canonical media metadata is retained. Browser guest data and downloaded exports are not erased. The user is signed out only after successful deletion. Backups retain historical data until their retention period expires; an operator must keep a deletion ledger and reapply deletions after restore. The server now inventories owned Storage objects across **all** buckets (including server-created avatar paths), removes bytes through the Storage API, and reads back an empty inventory **before** auth deletion. Inventory/migration/removal failures return 503 and leave auth active; partial cleanup can already have removed files, so retry is safe but not a rollback. Reauthentication uses a separate nonpersistent client: signing in must never replace the administrative client's authorization. Cleanup has a bounded 100 × 100-object ceiling per attempt and fails closed; retry to finish larger accounts. Avoid concurrent uploads during deletion; the final hosted integration acceptance must exercise this race and Storage ownership behavior.

## Privacy and avatars

Existing private-by-default profile, library, favorites, statistics and per-list controls are retained. List privacy requires an actual matching updated row. External avatar URLs remain supported; those hosts can observe viewer requests.

Settings → Profile now offers authenticated upload and removal. `POST /api/account/avatar` takes raw PNG/JPEG/WebP bytes with the matching exact Content-Type, not multipart, object paths or user IDs. The streaming 2 MiB limit applies even without Content-Length. Sharp 0.35.5 decodes with a 4096 × 4096 input/pixel ceiling, rejects corrupt/animated images and MIME/decoded-format mismatches, rotates/resizes to at most 512 × 512, and re-encodes WebP without EXIF/ICC metadata. SVG/HTML are never allowed input formats. No original/source image is stored. Generated `<authenticated UUID>/<random UUID>.webp` paths prevent submitted filenames or owner overrides. The server updates only the authenticated profile. Removal inventories and deletes all that user's uploaded derivatives before clearing the profile; older replacement derivatives remain owned until removal/account deletion. External URL removal only clears the reference, never fetches/deletes an external host.

Deployment requires **`20261030000200_safe_avatars.sql` after `20261030000100_systems_foundation.sql`**, the real Supabase Storage schema/API, and Node >=20.9 with Sharp's platform optional native packages installed (do not omit optional dependencies). The migration refuses to publish a pre-existing nonempty `avatars` bucket: review/move those objects first. The exact bucket is `avatars`, public byte delivery, 2 MiB limit, only `image/webp`; public URLs are intentionally readable regardless of profile privacy and can be retained by viewers/caches. Storage object listing is owner-path scoped. Restrictive policies prevent **all browser insert/update/delete**, including owner uploads and writes accidentally allowed by unrelated permissive policies. Only the server sanitizer with an untouched service-role client writes; service-created objects are associated with their owner by the validated UUID path. `owned_storage_objects` is service-role-only, searches owner_id across buckets and avatar owner paths, and pages at 100 objects. Never grant browsers that RPC or create direct-upload policies/signed upload URLs for this bucket. Source/service secrets stay server-only in existing `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, never `VITE_` variables. Missing bucket/RPC/profile migrations fail with actionable 503 responses. Deploy server functions and UI together; Vite alone cannot execute these routes.

Verified for this follow-up: lint, build, **167 unit tests / 46 files**, **28 existing desktop/mobile browser tests**, standalone avatar/deletion/storage API TypeScript checks, and **141 pgTAP assertions** on a disposable PostgreSQL database. RED runs observed authentication/upload absence, rejected input errors, missing removal/cleanup behavior, reauth/admin session bleed and legacy-policy ownership/write bypass before GREEN. The SQL fallback now includes only a minimal Storage catalog/policy contract; it does not emulate Storage HTTP or object byte deletion. A disposable full Supabase deployment must still verify native upload/download/removal, exact public byte versus private-listing behavior, failure retries and auth deletion with owned objects. No hosted changes or email were performed.

Full-tree standalone API checking also ran: it still reports the unchanged baseline `api/discover.ts:138` TS2322 (`string` versus `TmdbMediaType | undefined`), reproduced against an isolated `11413f0` source snapshot. This upload slice does not edit discover. Owned avatar/deletion/storage sources pass the same NodeNext check.

Dependency audit: Sharp was not previously installed; added the established decoder and lockfile native optional packages. Updated only the existing compatible `undici` transitive dependency (jsdom's development/test transport, 7.28.0 → 7.30.1) to remove its reported high advisories. Final audit still reports pre-existing React Router runtime advisories (2 production package findings: 1 high, 1 moderate); this is a browser-only SPA, so SSR/RSC-specific cases are not used, but navigation/route-matching exposure is not dismissed. The remaining full-tree findings are development/build tooling (ESLint/minimatch, Vitest/mocker, Vite, PostCSS/source maps, browser mapping, Zod and related transitive packages); dev servers must not be exposed to untrusted networks/inputs. No broad/major audit fix or unrelated router/toolchain upgrade was mixed into this upload slice.

## Integration credential contract

`POST /api/v1/tokens` accepts `{ "name": "Reader", "scopes": ["watchlist:read"] }`. Omitted scopes now default to read-only. Select **Read and write** in Settings to issue `["watchlist:read","watchlist:write"]`. Empty, unknown or duplicate scopes are rejected. Scopes cannot be modified by browser table writes; revoke and recreate to change authority. Existing broad tokens remain broad until revoked. Tokens still use 256-bit random secrets, SHA-256 hashes, one-time secret display and 90-day expiry. No Jellyfin feature was added; settings copy is client-neutral. Removing existing plugin files or per-episode code is outside this worker's ownership.

## Backup and recovery runbook

Owner: deployment operator. Start with a daily encrypted backup and 30-day rolling retention; target RPO 24h / RTO 4h until a timed drill proves otherwise. Managed PITR can reduce RPO if purchased/configured; it is not assumed enabled. Keep keys and restore access separate from the backup location. Monitor failed/missing backups and periodically verify checksum/decryption; never store dumps in this repository or CI artifacts.

1. Inventory database version/extensions, migration versions, auth configuration, OAuth redirect allowlists, server secrets and any Storage buckets. Database backups alone do not include Storage object bytes or hosted settings.
2. Use the provider's approved backup/export mechanism with least-privilege credentials. For a PostgreSQL archive, run `pg_dump --format=custom --file=afterlist.dump "$APPROVED_SOURCE_DB_URL"` from a trusted operator host with TLS; encrypt immediately and record SHA-256, timestamp, version and migration head. The auth schema contains sensitive data: restrict access. Do not blindly restore managed auth roles or provider ownership into hosted projects.
3. Provision a **new isolated disposable target**, never overwrite production. Restore with provider-supported tooling or `pg_restore --exit-on-error --no-owner --no-acl --dbname="$DISPOSABLE_TARGET_DB_URL" afterlist.dump` where appropriate. Supabase-managed schemas require the provider's supported restore procedure rather than assuming generic pg_restore suffices.
4. Reapply required roles/grants via reviewed migrations, verify extensions and migration history, then run all pgTAP tests, app build/unit/browser checks and disposable-auth sign-in/recovery/deletion checks. Count owner rows, inspect public/private visibility, verify token expiry/revocation and reapply post-backup deletion ledger entries. Verify avatar object bytes independently; database restore does not restore Storage bytes.
5. Record actual restore duration and last recoverable timestamp. Cut over only after explicit operator approval, rotate exposed credentials and revoke restored integration tokens if compromise triggered recovery. Preserve the prior target for rollback; do not reverse-delete data as a rollback strategy.

Remaining deployment acceptance: full Supabase/GoTrue/Storage native-policy integration run, hosted operator settings review, and encrypted database **and avatar object bytes** backup/restore drill. Neither passing local tests nor a CI definition asserts those operational tasks happened.
