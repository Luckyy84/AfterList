# Systems preview — what to test

Branch: `feat/systems-upgrade`. This preview uses a separate free Supabase project, not the production database. Production accounts and watchlists are not copied. No Jellyfin changes or new individual-episode records/checklists are included; existing title progress and new season counters remain.

## Before you start

- Confirm you are on the Vercel branch preview, not afterlist.uk.
- Use a disposable preview account and invented watchlist data. Do not paste passwords into issues, screenshots or chat.
- The test project has separate accounts. A production login will not automatically exist here.
- Email confirmation and password recovery require the test project's Auth delivery settings. Real email/Resend delivery is not claimed verified. Do not change production SMTP while testing this preview.
- Check both desktop and phone-width layouts. Report the page, action, expected result, actual result and a screenshot with personal details hidden.

## Suggested test order

### 1. Accounts and sessions

Sign in, reload, sign out and sign back in. Verify loading completes and failures are explained. Signup/reset should reject passwords shorter than 12 characters without changing the existing password-login compatibility. After switching accounts, no previous account's list editor or private selections should remain visible. Recovery emails/native policy behavior require a separately authorized delivery test.

### 2. Watchlist and offline sync

Add a movie and a series, edit status/progress, reload and confirm saved values. Take the browser offline, edit/add/remove items, reload offline, then reconnect. Pending changes should survive reload and synchronize without duplicates. Switch between two disposable accounts; edits must stay with the originating owner. On two devices, test competing edits and a deletion followed by stale replay: old state must not resurrect deleted data. Network failures should remain visible rather than pretending a save succeeded.

### 3. Season progress

Open a series and save progress for two seasons; reload and confirm both values. AniList titles are season/cour entries and use season 1. Associated TMDB/AniList seasons must not silently overwrite one another's title-level counters. There is no individual-episode watched/unwatched checklist.

### 4. Custom lists and privacy

Create lists, select several titles, save membership, reorder titles and lists, and reload. Add a title to multiple lists. Toggle a list public/private and check from a signed-out window while respecting profile-level visibility. A failed save must not look successful. Switch accounts with an editor open and verify private editor state clears immediately.

### 5. Catalog and identity

Open a provider title, then find its cached metadata in Library catalog search. Confirm the result opens the correct canonical details route and survives refresh. Check provenance/refresh information. Catalog search covers fetched entries, not every provider title. For likely duplicates, review confirmation/rejection, audit history and identity restoration; do not expect restoration to undo previously combined private notes/progress. TMDB full series and AniList seasons should not be merged as equivalent progress units.

### 6. History and statistics

Change status/progress, add/remove list items and remove a disposable title. Confirm private activity/history and aggregate statistics remain sensible after reload. Private note contents must not appear in public pages or event payloads.

### 7. Public profiles

Opt in deliberately. Check public profile/library/list links signed out. Turn sharing off and confirm raw private data is not exposed. For a collection large enough to paginate, verify Next/Previous, refresh and URL page position. Invalid usernames/private profiles should not reveal account details. Abuse budgets are process-local, not a claim of a distributed WAF.

### 8. Avatars

Upload a small PNG/JPEG/WebP, reload and verify it displays. Remove it and confirm it disappears. SVG, HTML, corrupt files, MIME-spoofed data, oversized and animated images should be rejected. The server stores a sanitized WebP derivative, not the original file. Previous derivatives are retained until avatar removal/account cleanup; do not upload sensitive photos.

### 9. Integration tokens

Create a read-only token; its one-time secret should be shown once. Read the test watchlist with it and confirm writes are denied. Create a read/write token and test changes on disposable data. Revoke a token and confirm it no longer works. Do not share tokens in bug reports. Existing production tokens are untouched.

### 10. Account deletion — last, disposable account only

Use a second disposable account with a dummy watchlist/avatar. Missing/wrong confirmation or password must not delete it. Correct `DELETE` plus password should delete only that account, clean owned Storage bytes first and sign it out after success. Verify the other test account still exists. Do not use a valuable account for this check.

## Operator checks, not user chores

- CI: lint, strict API types, unit tests, frontend build, browser tests and disposable database migration/RLS checks.
- Database grants, cross-owner access and RPCs: pgTAP plus hosted test-project HTTP checks.
- Refresh jobs: authorized test-only invocation, retry/lease/status history checks; Vercel does not run scheduled crons for preview deployments automatically.
- Backup/recovery: documented runbook plus a restore drill before claiming operational recovery; backups are not activated simply by documenting them.
- Test Auth redirects, email templates/provider and password policy independently of production.

## Known boundaries

This is a preview for acceptance, not a declaration that every hosted operational setting is production-ready. Local mocked browser tests do not prove live Auth, Storage, SMTP or cross-device sync. Provider cache and request budgets are bounded per-process; catalog storage is shared. Rate limiting, backup scheduling, recovery drills and email delivery require their own verified operational configuration. Main and the production database remain untouched until explicit release approval.
