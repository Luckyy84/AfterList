# Systems reliability

## Implemented paths

`App` calls `useWatchlist`; guest storage and signed-in storage are separate. Account edits are synchronously written to `afterlist_queue:<auth user id>` before the optimistic UI changes. The queue contains private notes and is **private browser storage**, never provider-cache input. Signing out or switching accounts hides the previous account's items; it does not import that account's queue into the next account. Returning to the original account replays its edits.

Replay runs on edit, sign-in/remount, browser `online`, and the existing Retry sync control. Latest pending snapshot per provider identity replaces older pending snapshots; removals are durable queue entries, not disappearance from a guest list. Acknowledgements remove only the exact revision sent. In-flight additions cannot acknowledge a later removal. Replay drains newly staged revisions in at most ten batches, and failed edits stop after three attempts. Explicit Retry sync resets the attempt budget without changing edit timestamps. Corrupt queues are reported and retained; storage-quota failures are not reported as successful saves.

Guest imports reuse the existing timestamp-aware merge utility. Unknown-recency guest entries lose to an existing cloud entry. Imports are transferred to the signed-in owner's durable queue before deleting the guest bucket. Pending account edits/removals win over guest imports. Explicit guest edits clear the unknown-recency marker. Existing TMDB runtime enrichment remains enabled.

The new authenticated `apply_browser_watchlist_edit` RPC derives ownership from `auth.uid()` and verifies the expected owner, so a session change while a request starts cannot replay account A into account B. Only whitelisted snapshot fields are written; client IDs, ownership, canonical IDs, and merge pointers are not trusted. Existing canonical-media triggers still resolve identities. Existing merged identities fail visibly rather than being silently overwritten. The transaction serializes same-identity browser edits, preserves newer stored timestamps, and treats equal edit timestamps idempotently. Local edit timestamps advance even for same-millisecond edits. The RPC rejects timestamps more than five minutes in the future.

Deletes record durable, owner-readable tombstones (also for deletes through existing paths). Browser removal tombstones use the original edit timestamp, not replay time, so a newer offline add is not incorrectly blocked; independent direct deletes use server time. A stale browser edit cannot resurrect a removed title. Removal wins a timestamp tie. A genuinely newer explicit add can restore it. Tombstones cascade on account deletion; the delete trigger does not recreate them during that cascade. Browser conflict resolution is newest-timestamp-wins, not field-level merging; the authoritative list is fetched after replay.

## Public catalogue providers

Search, discovery, details and AniList use `api/_lib/provider.ts`. Only public catalogue responses enter this cache. Requests containing cookies, authenticated AniList requests, non-HTTPS origins, ports, URL credentials or unapproved hosts are rejected. Browser authentication headers/private watchlist data are never forwarded by these routes. TMDB authorization comes only from existing server configuration.

Per warm process: 128 cached responses, maximum 512,000 response-text characters per entry, 60-second TTL, 12 distinct requests in flight, and 60 upstream cache misses per provider per minute. Identical requests share the in-flight operation; each caller receives its own response clone. Cache hits do not consume request budget. Errors, invalid JSON, GraphQL errors and structurally invalid payloads are not cached. Invalid successful payloads become gateway errors instead of publicly cached empty results; AniList's null-title response remains an uncached 404. There are no automatic upstream retries. Existing request timeouts and input bounds remain; TMDB search/discovery now return 504 for timeouts and preserve numeric Retry-After on 429. Errors use no-store responses and do not log upstream URLs, credentials or response bodies.

These are process-local safeguards, not a distributed abuse-prevention service. Existing public CDN cache headers remain. Cache state does not survive cold starts. No shared private-data cache or new dependency was introduced.

## Durable refresh job

`refresh_jobs` is a Supabase table with RLS and no anonymous/authenticated access. Only service-role RPCs can claim/finish work. One job per Berlin calendar day has running/failed/succeeded state, attempt count, lease, timestamps and row counts. Claims are atomic. A live lease excludes duplicates; a crashed worker's lease becomes reclaimable after ten minutes. At most three invocations can claim a job. A stale worker cannot finish a newer lease. Successful jobs cannot be forced to execute twice on the same day.

The cron route authenticates with the existing CRON_SECRET before any database operation. Missing migration returns 503 with a migration-needed message before touching watchlist rows. Partial failures return 502 with `ok:false`, not a false success. Final status is read back before reporting completion. `?status=true` reads today's durable status without claiming/running work; it requires the same secret and returns no lease or private row data.

The checked-in Vercel schedule adds 02:00 and 03:00 UTC retry opportunities to the existing 00:00/01:00 UTC invocations. New jobs start only at 02:00 Berlin (unless manually forced); later invocations may retry an existing failed/expired job. This handles summer/winter start times and the repeated DST hour without a duplicate successful job. This is repository configuration only: **no deployed schedule or cloud setting was changed**.

Refresh reuses the existing grouped-TMDB fetch and metadata-only patch builder, three provider requests concurrently and ten-second request timeouts. It stops starting new title requests after 45 seconds, counts unprocessed rows as failures, and retries the idempotent whole scan on a later invocation. It does not change user tracking timestamps or private notes. A conditional update guards concurrent episode changes; zero-row writes count as failures. It uses direct bounded refresh requests, not the interactive catalogue process's 60/minute budget.

## Setup and verification

A maintainer must review and deploy `supabase/migrations/20261030090000_systems_reliability.sql` through the normal migration process **before enabling browser writes in that deployment**. It depends on existing migrations. This implementation did not run migrations against local/preview/production Supabase, change secrets, send email, push commits, or deploy anything. Without the migration, queued edits remain in the browser and the UI reports migration needed.

Existing server environment: Supabase admin configuration, TMDB_API_KEY or TMDB_ACCESS_TOKEN, and CRON_SECRET. Keep all secrets in the existing server environment; never put them into browser config, screenshots or command-line arguments.

Automated checks:

```sh
npm test
npm run lint
npm run build
```

A standalone database regression check uses disposable in-memory PGlite, bootstraps mock Supabase roles/auth and executes the migration chain only inside that memory database. It does not connect to Supabase. PGlite is a test tool, not an application dependency:

```sh
npm install --prefix "$TMPDIR/afterlist-db" @electric-sql/pglite --ignore-scripts --no-audit --no-fund
PGLITE_MODULE="$TMPDIR/afterlist-db/node_modules/@electric-sql/pglite/dist/index.js" node scripts/test-systems-reliability.mjs
```

Manual acceptance checks on an isolated preview with its own test Supabase:

1. Sign in as A; go offline, change progress/notes, remove another item, and add a title. Reload. Pending additions/edits remain; pending removals remain hidden. Reconnect or press Retry sync: check the actual rows and reload again.
2. While A has pending private notes, sign out and sign in as B. B must not see or receive A's queue. Return to A and verify replay. Do not test with production accounts.
3. Change an item on a second device with a newer timestamp, then replay an older offline edit. The newer cloud state wins. Delete an item, then replay an older browser add: the tombstone prevents resurrection. Make a new explicit add after deletion: it succeeds.
4. Add a title, immediately edit/remove it while the request is delayed, then release the request. The latest state must survive, with no pending stale add.
5. Block RPC requests until three attempts fail. Edits remain pending and an error is visible. Restore connectivity, press Retry sync and verify actual rows. With the new migration absent, expect an explicit migration-needed error, not success.
6. Using server-side secret handling, invoke the cron route with force=true on the isolated preview. Read status=true afterward. A second force call on the successful day skips. Simulate provider failure: expect failed status/502 and a later retry incrementing attempts, at most three. Simulate two concurrent claims and a stale completion: only the current lease may finish.
7. Repeatedly request the same public title/search: upstream requests coalesce/cache. Change credentials and ensure the old key is not reused. Exercise provider 429, timeout and invalid JSON cases; verify no-store error responses and no sensitive logs.

## Deliberate limits

- Browser localStorage is not encrypted and belongs to the browser origin. It is not protection against another person/devtools on the same browser or an XSS compromise. Do not use shared browser profiles for private accounts. Clearing browser storage clears pending edits.
- Queue staging is synchronous and replay is serialized within one tab/process. Simultaneous edits from multiple tabs can race on localStorage; use one editing tab. A cross-tab locking/IndexedDB transaction layer is the upgrade if concurrent-tab editing is required.
- Only pending account edits are durable offline snapshots. Unedited cloud items are fetched normally; this is not an offline copy of the entire private library.
- Tombstone checks govern this browser RPC. Existing independent integration/direct-write paths are not rewritten here and can deliberately insert a title after deletion. Tombstones record their deletes so stale browser edits still cannot resurrect them.
- Whole-job retries rescan metadata; there is no per-title cursor. A library exceeding the invocation time budget can remain failed after three attempts, visibly. Add a database checkpoint/cursor before operating at that scale, not an external queue. A hard platform kill remains running until lease expiry; the status timestamps make this visible.
- No deployed end-to-end account test is claimed. Automated UI/provider tests mock network boundaries; SQL behavior was exercised in an ephemeral PostgreSQL-compatible engine, not the hosted Supabase stack. No Jellyfin work.
