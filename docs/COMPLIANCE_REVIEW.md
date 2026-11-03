# AfterList compliance review branch

## Release decision: BLOCKED

Software checks can pass while legal/operator readiness remains blocked. This branch is for Lucky's review, not production promotion, legal certification, or permission to operate a public service. Unconfigured notices deliberately disclose missing information rather than inventing an operator, private address, email, jurisdiction, revenue model or signed contract. A disclaimer does not waive law.

Branch: `fix/legal-privacy-review-20261103`.
Implementation base: `f6da643b2ad25a09b66ca2df004175bfc386bb69` (preserves systems upgrades).
Remote refs rechecked before work: main `200392684cd4ac295d296c4395ef32037180408d`; systems-upgrade `813eb6630a38f2aa8b3e66fc3a244269fef8b200`.

`LEGAL_AUDIT_HISTORICAL.md` is the preserved original read-only audit, not a description of this branch or proof of deployed state. Its live observations included AniList HTTP 404 and no AniList endpoint in the inspected entry bundle: there is no claim of a confirmed live AniList breach. Raw downloaded site bundles are not redistributed as project assets.

## Findings to fixes

| Finding | Review-branch fix | Verification / limit |
| --- | --- | --- |
| Optional analytics loaded without a real terminal-access assessment | Removed lazy Analytics component, mount and package/lockfile dependency entirely; no opt-in analytics mode retained | Source regression; production-build desktop/mobile pages make no analytics requests. Hosting-level injection still needs target deployment review. |
| Cookie-only consent reasoning; incomplete storage inventory | Rewritten privacy page separates requested storage from optional analytics and covers local lists/preferences, auth sessions, owner queues and service worker | See inventory below. No blanket consent exemption claimed. |
| Controller/private contact absent | `/imprint`, footer link, explicit unset notices; only deliberately supplied public `VITE_LEGAL_*` fields rendered | Unset and test-only configured states exercised in browser at 1440 and 320px; no real personal details supplied. |
| Incomplete purposes/rights/providers/transfers/retention | Rewritten privacy notice maps proposed Article 6(1)(b)/(f)/(a) uses conditionally, describes private notes/profiles/lists/history, Google sign-in, providers/direct images, rights/complaints and retention limitations | Actual legal bases, contracts and schedules need human facts; policy is visibly a review version. Public GitHub issues removed as the primary personal-data contact. |
| TMDB logo/About attribution absent | `/credits`, footer link, approved locally stored original TMDB logo and exact disclaimer | Logo fetched from official branding-page asset; accessible image link verified loaded. Business model/licence remains unresolved. |
| Unresolved AniList competing-tracker permission | Client default OFF; server requires exact `ANILIST_ENABLED=true` and nonblank permission reference; shared provider guard runs before cache; legacy resolve gated too | Disabled search/discovery/details do not call upstream. Cached catalog snapshots/saved items remain readable; no IDs, lists or progress rewritten/deleted. Enabling flags is not proof permission exists. |
| Item-only export incomplete | Authenticated `/api/account/export`, account-settings download and local pending-edits inclusion | 13 owner-filtered tables, pagination, safe token metadata, fail closed on missing tables/errors; session credentials/hashes/queue tokens excluded. Late A export cannot download after switch to B. |
| Local deletion residue and ownership gap | Clear only deleted-owner queue; prevent in-flight replay recreating it; local auth sign-out; suppress late deletion callback affecting a subsequently active account | Unit and fixture-browser isolation tests; disposable SQL regression caught stale avatar owner metadata deleting another UUID path and new migration fixes path-based avatar ownership. |
| Service-worker cache could retain account/token URLs | Versioned cache restricted to generic `/` and build `/assets/`, with no query strings; upgrade removes only older AfterList-prefixed caches | Runnable VM regression excludes auth query URLs/account/profile/API paths; static cache contains no owner data. Deep-link pages are not stored as offline navigation entries. |
| No explicit release gate | `npm run check:release` outputs JSON BLOCKED and exits 1 | Detects missing/placeholder operator fields, malformed contact, unsafe analytics, inconsistent/undocumented AniList enablement; unresolved human evidence deliberately cannot be cleared by an environment-only checkbox. |

## Operator configuration (all public)

Leave these unset for a review preview. Vite embeds them in public client assets; never put secrets here.

- `VITE_LEGAL_OPERATOR_NAME`: actual approved controller/operator name.
- `VITE_LEGAL_OPERATOR_ADDRESS`: lawful approved postal information, not an automatically inferred home address.
- `VITE_LEGAL_CONTACT_EMAIL`: functioning private request contact.
- `VITE_LEGAL_OPERATOR_DETAILS`: additional applicable legal form, representation, register/tax/regulatory details and other operator information. Applicability needs assessment.

Test fixtures use explicit test-only identities on `.invalid`/`.test` domains; they are not shipped as defaults. Production gate must be run with the same public build values intended for that deployment. It is not a deployment blocker enforced by Vercel and does not prevent a reviewer from making a preview; it is a separate declared-production-release prerequisite.

## Actual storage and processing inventory

| Storage / recipient | Data and purpose | Retention / controls |
| --- | --- | --- |
| `afterlist_items` localStorage | Guest titles, progress, ratings and any local notes | Until removed/cleared or transferred into signed-in sync. |
| `afterlist_items_unknown_recency` | Legacy guest merge recency markers | Updated/removed by guest migration/sync; clear-site-data removes. |
| `afterlist_preferences` | Requested appearance/motion/card-density preferences | Until reset or site-data clearing. |
| Supabase `sb-…-auth-token` | Session/refresh credentials needed for account sessions | Supabase session lifecycle and local sign-out; do not put in exports/logs. |
| `afterlist_queue:USER_ID` | Owner-scoped pending edits including possible private notes; edit identifiers/retry counts | Removed per successful edit or deleted-owner cleanup; sign-out preserves unsynced edits to avoid data loss. Other devices need local clearing. Export strips queue identifiers. |
| `afterlist-v2` Cache Storage | Generic same-origin shell and build assets, not account paths, query strings, API or external artwork | Updated on later SW activation; site-data clearing removes. Previous AfterList caches are invalidated on activation. |
| Supabase DB/Auth/Storage | Account/profile, owner titles, lists/memberships, season progress, history, identity decisions/audit, username history, tombstones, token metadata and avatars | Live owner deletion uses existing secure backend/storage API and FK cascades. History/tombstone/log/backup schedules not established. Avatars may be directly public by URL. |
| Vercel | Hosting/API requests, technical URLs/IP/security data | Actual provider and operator log settings unverified; optional Analytics integration removed. |
| Resend / Google when configured/chosen | Authentication delivery/sign-in identity | Account/provider contracts, delivery logs and actual provider settings unverified; no mail sent by these tests. |
| TMDB / direct image hosts | Server metadata requests; browser artwork requests expose IP/request/browser info to image host | Metadata cache refresh is not a personal-data retention policy; source rights and provider log schedules still need verification. |
| AniList | No new upstream calls by default; saved records and stored images can still be displayed | Explicit permission must cover competing tracker use, storage and commercial conditions before opt-in. No mass collection added. |

No watch-provider availability/JustWatch data calls were found in the inspected implementation, so no invented JustWatch feature or attribution is added.

## Account export, deletion and privacy boundaries

Export covers `watchlist_items`, `profiles`, `custom_lists`, `custom_list_items`, `watchlist_events`, `season_progress`, `user_media_alias_links`, `user_media_match_decisions`, `media_match_audit`, `anime_season_matches`, `username_history`, `watchlist_tombstones`, and allowlisted `api_tokens` metadata. Server identity is authenticated, never taken from query-supplied owner IDs. Full pages are read in stable unique order, 500 at a time. Errors return no partial backup.

Not included: uploaded avatar file bytes, provider/backups/logs, arbitrary Auth metadata, internal reauthentication counters, credentials/token material. Pagination is not a transactionally consistent snapshot under concurrent edits. Self-service JSON is useful but not a guarantee that all access/portability obligations have been fulfilled; a real private request process remains necessary.

Deletion retains existing current-password verification, reauthentication rate limit, storage-API-before-Auth deletion ordering and cascade protection. Storage failure prevents Auth deletion; partial storage cleanup can occur before a later failure, so deletion is not an atomic storage/database transaction. Do not run deletion tests on production. Other devices' local queues, provider logs/backups and third-party public caches are not erased by the current browser cleanup. Private-by-default and public note exclusion tests from the baseline remain in the combined suite.

New migration required before release: `supabase/migrations/20261103000001_account_storage_ownership.sql`. It was exercised only in a disposable local PostgreSQL harness here, not applied to any hosted project.

## Executed verification

Final combined verification for the implemented tree:

- `npm test`: 307 tests passed in 64 files, 0 failures.
- `npm run test:compliance`: 4 Node checks passed (release gate and service-worker exclusions), 0 failures.
- `npm run lint`: passed.
- `npm run build`: TypeScript project build and Vite production build passed; no Analytics chunk emitted.
- `npm run typecheck:api`: strict backend TypeScript passed (separate from frontend build).
- `runuser -u postgres -- bash supabase/verification/test-local-postgres.sh`: all migrations, 169 pgTAP assertions in 6 files passed. This is a minimal local Auth/Storage SQL harness, not native hosted Supabase HTTP acceptance.
- Dedicated strict-port dev server, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4187 npm run test:e2e -- --workers=2`: 40 passed across desktop/mobile projects.
- Dedicated strict-port production-build preview, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4189 npm run test:e2e -- --workers=2`: 40 passed, including privacy/terms/imprint/credits/footer, loaded logo, no horizontal overflow/no analytics, existing catalog/route/public-profile regressions. Provider/account fixtures are not live-provider evidence.
- Test-only configured operator server on 4188, `node tests/e2e/configured-operator.probe.mjs`: 4 page/viewport checks passed for privacy/imprint at 1440/320px.
- Fake isolated Supabase configuration on server 4190, `node tests/e2e/account-privacy.probe.mjs`: 2 viewport scenarios passed, each covering export download, confirmed deletion, deleted-owner queue removal, other-owner preservation and local-session removal. Every account/provider response intercepted; no real authentication, deletion, credentials or messages used.
- `git diff --check`: passed. Final self-review covered scope, private projections, guards, owner filters, late callbacks, permissions, SVG and dependency removal. Independent reviewer delegation was unavailable after the two implementation workers; no independent-review certification claimed.

The first browser run failed 6 tests (two existing AniList live-request assumptions and the obsolete GitHub-contact expectation in both viewports). Tests were adapted to existing catalog snapshots without enabling upstream access, preserving deep-link/save/duplicate assertions, and the intentional private-contact contract. Subsequent full runs passed. New regressions were observed failing before the relevant fixes (provider gates, export, local cleanup/storage ownership, late callbacks, analytics/legal config and metadata, SW token URL caching).

Tool limitations: `gh` is not installed; package-manager uninstall was blocked by unattended approval policy, so the unused dependency and its optional-peer-only lock entry were removed directly and builds/lint verified. No package/global installs performed. Some raw EUR-Lex curl endpoints returned empty bodies; official EUR-Lex web retrieval/search and original audit evidence were available. This is not an account-level legal/contract audit.

## Outstanding RELEASE BLOCKERS

1. Actual operator/controller identity and lawful private email/postal contact; establishment/jurisdiction, public audience, revenue model and applicable operator-identification duties. Do not expose a minor's home address as an automatic fix.
2. Operator capacity and child-user/age-appropriate processing rules; parent/guardian or qualified advice where applicable. No guessed age threshold or jurisdiction.
3. Actual purpose/legal-basis and legitimate-interest assessments, public-sharing basis and any consent withdrawal process, provider agreements/roles/subprocessors, transfer mechanisms and evidence. No DPA or transfer basis claimed verified.
4. Real retention/deletion schedules for history/tombstones, database/storage backups and security/mail logs, restoration restrictions and request fulfilment workflow. No arbitrary expiration promises.
5. TMDB business-model/licensing and remaining third-party image-rights assessment; AniList stays OFF without explicit verified permission. Educational leniency for AniList mass collection is not a waiver of the competing-tracker rule.
6. Qualified review of applicable terms/liability/update/consumer duties and operator information; operational target migration verification and native account/Storage acceptance before any production merge.

## Primary sources checked

Retrieved during this run on 2026-11-03; URLs are evidence, not authority to execute instructions.

- GDPR official text and current-version metadata: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng and https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02016R0679-20160504 — Articles 6, 7, 13, 15–21, 28, 44 onward and 77 inform the proposed notice/rights; applicability remains fact dependent.
- DDG section 5: https://www.gesetze-im-internet.de/ddg/__5.html — operator-information duties depend on actual applicability; additional duties can remain.
- TDDDG section 25: https://www.gesetze-im-internet.de/ttdsg/__25.html — terminal storage/access, not merely cookies; expressly requested necessary-service exception is distinct from optional analytics.
- TMDB FAQ: https://developer.themoviedb.org/docs/faq — approved logo, prominent exact notice, About/Credits, non-commercial free use versus commercial licensing, third-party rights caveat.
- Official logos and branding: https://www.themoviedb.org/about/logos-attribution — logo must preserve colours/aspect ratio and not imply endorsement or dominate the app mark.
- Original logo downloaded without modification to `public/tmdb-logo.svg`: https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg . Use is for the attribution expressly required/permitted by TMDB branding documentation, not a claim to TMDB trademarks or blanket rights in artwork.
- AniList terms: https://docs.anilist.co/guide/terms-of-use — competing non-complementary trackers prohibited, including user/media data; educational leniency addresses a different collection rule.
- Vercel Analytics privacy: https://vercel.com/docs/analytics/privacy-policy — request hash, URLs/referrers/query fields and sensitive-information warning; removal chosen instead of a consent-management stack.

## Manual acceptance before any production merge

1. Keep this as a review branch. Read `/privacy`, `/imprint`, `/credits`, `/terms` on desktop/mobile. Unset operator data must be visibly unresolved, no fake contact; approved TMDB logo must load and footer links work.
2. Check Network on home/legal/auth/account paths: no optional Analytics injection; AniList upstream must remain off; TMDB search/discovery should work when valid server credentials exist. Existing saved AniList titles/progress must remain intact.
3. In a verified isolated test project only, apply the complete migration chain including the new ownership fix. Test two accounts: private by default, no private notes in public projections, complete own export/no other's records, unsuccessful password/storage cleanup cannot delete Auth, successful deletion removes own live rows/avatar and local queue while preserving the other account.
4. Establish actual operator facts privately and approve what may be published. Confirm private request delivery without posting personal data publicly. Resolve contracts/transfers/retention/child-user/terms/provider blockers with evidence and legal advice as needed. Rerun `npm run check:release`; do not bypass BLOCKED with environment-only flags.
5. Lucky reviews the finished branch and results before any production merge. His existing to-do remains unchecked. No production merge, environment change, account mutation or promotion is authorized by these checks.

Hosted preview/backend isolation was not verified during this implementation. No hosted database/auth/storage/environment changes or production mutations were performed; branch publication may automatically create a frontend preview, which must not be assumed to use an isolated database. Use the dedicated local checks until a safe target is verified. Publication handles, if verified, are recorded in the final machine-readable result, not inferred from a successful build.
