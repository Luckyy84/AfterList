# Cloud sync

AfterList has two storage modes:

- Signed out: local guest list in browser storage
- Signed in: saved items sync through Supabase

The frontend service is `src/services/watchlistItems.ts`.
The React state switch is handled by `src/hooks/useWatchlist.ts`.

## Tracking fields

Each item can store episode progress, an optional 1–10 personal rating, a
favorite flag, and an update timestamp. Movies ignore episode fields. Episode
progress is clamped to its known total; reaching the total marks an item as
watched, while reducing completed progress returns it to watching.

## Guest-to-account merge

Signing in merges the browser list with the cloud list by `source` and
`externalId`. The newest timestamp wins; cloud wins when an older browser item
has no trustworthy timestamp. Browser data is removed only after every cloud
write succeeds. A failed merge leaves the browser copy intact and can be
retried through `retrySync` from `useWatchlist`.

Apply the migration in `supabase/migrations` before deploying this frontend.
It adds the tracking columns, constraints, grants, and ownership RLS policies.
