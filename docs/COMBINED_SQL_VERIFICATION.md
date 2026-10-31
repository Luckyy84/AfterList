# Combined SQL verification

Verified locally on PostgreSQL 17.11 with foundation, reliability, tracking, and `20261030000200_safe_avatars.sql` applied in filename order to a fresh disposable database.

```sh
runuser -u postgres -- bash supabase/verification/test-local-postgres.sh
```

Result: **5 files, 161 assertions, PASS** (including `avatars.test.sql`). The original run failed after 22 behavior assertions because the old fixture expected a TMDB series/AniList season merge to succeed. The supported merge fixture now uses `movie:700`; separate TV fixtures verify rejection in either argument order with no identity, alias-link, decision, or audit side effects. Existing ownership, private-note, progress, favorites, list membership, and event redaction checks remain. Added identity-only reversal, right-hand winner, audit transition, replay denial, cross-owner denial while merged, and anonymous denial coverage.

Both disposable PGlite scripts also pass across the combined migration chain:

```sh
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/systems-tracking-sql.mjs
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-systems-reliability.mjs
```

PGlite is an optional external test dependency, not an application dependency. Both scripts reuse the standalone bootstrap's minimal Storage catalog rather than skipping the avatar migration. Their initial combined runs exposed missing `storage.objects` in their old auth-only bootstraps; this harness integration issue is fixed.

## Limits / security follow-up

No migration/API/UI behavior was changed. No critical integration security defect was demonstrated by these runs; passing these checks is not a full security audit. Local auth and Storage catalogs exercise SQL contracts and RLS only: GoTrue, PostgREST, actual Storage HTTP/object bytes, deployed role/default grants, and sanitizer deployment still require disposable full-Supabase verification. No production/cloud database, email, or push was used.
