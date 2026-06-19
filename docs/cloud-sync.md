# Cloud sync

AfterList switches storage behavior according to authentication state.

## Storage modes

### Signed out

- The watchlist is read from and written to browser `localStorage`.
- The storage key is `afterlist_items`.
- Data belongs to that browser profile and is not available on another device.
- Invalid legacy entries are filtered, duplicate media entries are removed, and the legacy `Completed` status is migrated to `Watched` when data is loaded.

### Signed in

- The watchlist is loaded from the Supabase `watchlist_items` table for the authenticated user.
- Adds, status changes, and removals are sent to Supabase.
- The UI does not automatically merge or import the signed-out browser list into the account.
- Signing out returns the app to the browser-local guest list.

The mode switch is implemented in `src/hooks/useWatchlist.ts`. Supabase row mapping and CRUD calls live in `src/services/watchlistItems.ts`.

## Required browser configuration

Cloud mode requires these publishable client values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Vite embeds `VITE_*` values in the browser bundle. A Supabase publishable key is intended for this use, with authorization enforced by database policies. Never expose a Supabase secret key or service-role key through a `VITE_*` variable.

## Database prerequisite and security limitation

The client currently expects a `watchlist_items` table with fields matching the `WatchlistItemRow` type in `src/services/watchlistItems.ts`.

No Supabase schema migration or RLS policy migration is currently committed to this repository. Consequently:

- a new contributor cannot recreate the database from version-controlled migrations;
- constraints and duplicate protection cannot be verified from repository code;
- RLS enablement and ownership policies cannot be verified from repository code; and
- client-side `.eq('user_id', userId)` filters must not be treated as authorization.

The active Supabase project must have correctly reviewed Row Level Security policies that restrict every select, insert, update, and delete to the authenticated owner. This documentation does not claim those policies exist or are correct.

A future, separately reviewed database task should capture the current schema, add reproducible migrations, define ownership and uniqueness constraints, test operation-specific RLS behavior, and document rollout and rollback. Do not make ad hoc production schema changes while doing unrelated frontend work.

## Local validation

For frontend-only work:

```bash
npm run dev
```

For a full local session that also serves the TMDB Vercel functions:

```bash
npx vercel dev
```

Run the repository validation commands before submitting changes:

```bash
npm run lint
npm test
npm run build
```

When a configured test Supabase project is available, manually verify:

1. Signed-out adds, updates, and removals persist after a browser refresh.
2. Signing in loads the account watchlist rather than merging the guest list.
3. Signed-in adds, updates, and removals persist after refresh and on another session.
4. Signing out restores the local guest list.
5. One account cannot read or modify another account's rows.
6. Missing configuration and rejected database operations produce visible errors rather than appearing as successful syncs.

The cross-account check is an RLS acceptance test and must be performed against a non-production test project before cloud sync is considered secure.
