# Integrated systems verification

## Branch and safety

All work is on `feat/systems-upgrade`; no merge to main or production database migration was performed. The preview uses the separate free Supabase project `lqaciyhuidpjhimcacpi`; production remains `chojaljwksrmchxltprr`. Vercel variables are scoped to this preview branch only. Browser assets were checked for the test project reference and absence of the server credential. Passwords/keys are not part of this repository.

Stable preview: https://after-list-git-feat-systems-upgrade-luckko.vercel.app

## Actual verification

- Parent rerun: production build, lint, strict backend types and 275 unit tests across 60 files passed after consolidation.
- Browser regression suite: 32 desktop/mobile checks passed in the consolidation workstream; parent previously reran all 32 against the integrated UI before the unchanged-handler relocation.
- Parent local PostgreSQL 17 replay: all 14 migrations; 161 pgTAP assertions across five files passed.
- Hosted isolated Supabase: all five SQL suites passed with `finish(true)` and transaction rollback, including its real Storage direct-delete protection. The native protection returns SQLSTATE42501; the test asserts that rather than bypassing protection. A previous CI failure reproduced the mismatched test expectation and was corrected.
- Hosted Auth/PostgREST: generated disposable accounts signed in without email delivery; own watchlist and season progress saved/read back; another owner could not read/write those values; bulk list membership and analytics worked.
- Deployed Vercel API: provider search/catalog returned200; signed-out integration access returned401; helper paths404; unsupported methods405.
- Deployed token creation defaulted to read-only; read succeeded and write was rejected.
- Deployed avatar: real PNG passed the server sanitizer, persisted in native Storage and returned a readable WebP; MIME-spoofed SVG data was rejected400.
- Deployed account deletion: wrong confirmation400, wrong password403; correct fresh password204. Readback verified auth user absence, empty owned avatar inventory and invalidated integration credential while the second account remained intact. All internally generated test accounts were then removed.
- Real browser against the deployed preview: expanded Library catalog search, searched Game, opened Game of Thrones and reached canonical /tv/1399 details. No page errors in that smoke run.
- Production dependency audit after router patch update: zero reported vulnerabilities. This does not assert that every development dependency is advisory-free.

## Free-plan deployment fix

The first deployment exceeded Vercel Hobby's twelve-function cap. Original handlers/tests now live in `server/api/`, with one static allowlisted `api/router.ts`. External endpoint URLs, method/body/query forwarding and authentication are preserved. Route tests cover all endpoint-method mappings, helper isolation and signed-out authorization. Vercel accepted the consolidated deployment as READY, and native HTTP tests confirmed rewriting.

## Honest remaining boundaries

- This is a branch preview for user acceptance, not a production release.
- Production Auth/provider configuration, real Resend/SMTP delivery, password-recovery emails and a timed encrypted backup/restore drill remain separate operational acceptance. No real email was sent and production SMTP was not modified.
- Backup/recovery strategy is documented, not an activated production backup schedule.
- Public/provider rate limits are bounded per-process, not a distributed WAF. Offline pending edits are private unencrypted browser storage, not a full offline copy or cross-tab transaction engine.
- Durable refresh jobs have leases, bounded retries, status/error history and a protected status endpoint; scheduled production runs and external failure-notification delivery are not claimed verified in a preview.
- Merge reversal restores identities, not a full pre-merge snapshot of combined notes/progress.
- Season-level counters only: no new individual-episode records/checklists, no Jellyfin work.

Use `docs/SYSTEMS_PREVIEW_TESTING.md` for the user acceptance sequence. GitHub Actions results must be read for the exact published commit; local success or a READY Vercel deployment does not imply CI is green.
