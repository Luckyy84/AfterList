# Systems tracking acceptance

## Scope and migration

This change adds **season counters only**. It does not add per-episode records, episode checklists, Jellyfin integration, notifications, emails, push, or cloud configuration changes. Existing title-level progress remains unchanged.

Apply the repository's migrations in filename order, ending with `supabase/migrations/20261030000001_systems_tracking.sql`, through the normal reviewed deployment process. This branch does **not** apply migrations to a live database. The migration depends on the existing canonical-media and public-profile migrations; it is not a standalone bootstrap or an idempotent script.

The migration adds owner-scoped season progress, AniList-season associations and identity decision audit; atomic bulk-list/order RPCs; a provider-owned shared catalog and indexed title search; retained watch events and account-scoped analytics; and bounded public library/list projections. All privileged RPCs validate authentication/ownership and use an empty search path. Removing an account still cascades its history and audit records.

Server catalog configuration uses existing `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and **server-only** `SUPABASE_SERVICE_ROLE_KEY`. TMDB uses existing server provider credentials; AniList uses its existing proxy. Never expose the service-role key in Vite variables. Browsers cannot write catalog snapshots. Public profile/list visibility remains opt-in.

`src/services/profiles.ts` preserves the existing own-profile save/claim and sharing functions. Its public collection functions add an optional third/fourth `offset` parameter after `AbortSignal`, defaulting to zero; foundation changes to the other functions should be retained when integrating workers.

## Runnable checks (local only)

```sh
npm test
npm run build
npm run lint
npm run test:e2e -- --workers=2
```

For concurrent worktrees, do not reuse another worker's default-port dev server. Start this checkout with `npm run dev -- --host 127.0.0.1 --port 4279 --strictPort` and run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4279 npm run test:e2e -- --workers=2`; stop only the server you started. Verification here: 46 Vitest files / 155 tests passed, build and lint passed, disposable SQL passed, and 32 Playwright checks passed against the isolated local server. An earlier shared-port run lost its server mid-suite; the isolated rerun was clean.

SQL acceptance uses disposable in-memory PostgreSQL via PGlite, never Supabase. No application dependency is added. Install the test tool outside the checkout if it is not already present:

```sh
npm install --prefix "$TMPDIR/afterlist-sql" --no-save @electric-sql/pglite
PGLITE_MODULE="$TMPDIR/afterlist-sql/node_modules/@electric-sql/pglite/dist/index.js" node tests/systems-tracking-sql.mjs
```

The SQL runner applies every repository migration from scratch. It exercises authenticated/anonymous roles, cross-owner isolation, season/provider validation, retained title counters, atomic bulk selections and order, duplicate rejection, merge reversal with the right-hand provider winning, audit, catalog read-only search, public list ordering/continuation, note privacy, more than 150 events in the analytics window, and account deletion. PGlite is not a hosted Supabase/PostgREST deployment test.

## Acceptance checklist

- [x] Library exposes shared catalog search, provenance timestamps, canonical result links and details reloads.
- [x] Fresh catalog entries avoid provider refetch; stale entries can be returned when the provider is unavailable; unavailable catalog storage falls back to the existing provider client.
- [x] Series/anime details expose editable bounded season counters; title counters and watch-time estimates are not rewritten or double-counted.
- [x] AniList titles use season 1 because seasons/cours are separate titles. TMDB series-to-AniList associations are season-specific, never automatic title-progress merges.
- [x] Existing duplicate confirmation/rejection remains available; retained source identities, recent account decision audit and guarded identity-only reversal are exposed.
- [x] Custom lists support bulk matching-title selection, explicit title order, list order and public sharing when the profile is public.
- [x] Statistics aggregate the complete UTC window in SQL rather than sampling the latest 50 events; season totals are reported separately.
- [x] Public library/list routes accept bounded offsets, deterministic order, continuation metadata, URL page selection, previous/next controls and username redirects that retain page selection.
- [x] Public routes share a bounded per-IP abuse budget; errors are not cached and private/missing profiles share the same unavailable state.
- [x] Component/service tests and disposable SQL checks exercise writes and failures; Playwright covers catalog search/details and public pagination on desktop and 320px mobile alongside existing route/profile suites.
- [ ] After reviewed migration deployment, verify signed-in persistence and reload on a real test account, across two devices, with another account denied access. Not performed here: live/cloud changes are prohibited.

## Deliberate limitations

- Catalog search covers previously fetched titles using indexed full-word search, not exhaustive provider discovery or fuzzy matching. Entries refresh on details access after 24 hours; no background refresh job is introduced.
- Rate limiting is best-effort process-local (60 requests/minute/IP, 5,000 active IP buckets). It is not a distributed WAF. Deployment proxy IP trust and multi-instance enforcement belong in reviewed deployment configuration.
- Public offsets cap at 10,000, with UI pages of 50. Offset pagination can shift while owners edit collections; no snapshot consistency is promised. Legacy unmigrated responses without continuation metadata retain a length-based fallback.
- Bulk editing and list ordering cap at 1,000 entries. Lists above the editing limit fail visibly rather than silently dropping unseen entries. Titles absent from the loaded library are retained in the ordered selection.
- Merge reversal restores identities, not pre-merge combined notes/progress or list memberships. Unsafe chains/changed aliases are rejected; the UI explicitly asks for a library reload after restore. Retained loser season counters become visible again on restore; they are not merged into winner counters.
- Season matching supports one AniList title per TMDB season. Split cours remain distinct titles; no automatic synchronization of associated counters is performed.
- Watch events retain only tracking fields and a `notesChanged` flag, never note text. Events predating tracking cannot be reconstructed. Deleted-title history is retained privately until account deletion. Daily analytics include active days only; season completion totals reflect current active titles, not historical episode events.
- The local browser suites use fixture API responses, and component tests mock authenticated service boundaries. They establish UI wiring, not hosted authentication, cross-device delivery, or real-provider availability.
