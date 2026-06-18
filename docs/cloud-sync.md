# Cloud sync

AfterList has two storage modes:

- Signed out: local guest list in browser storage
- Signed in: saved items sync through Supabase

The frontend service is `src/services/watchlistItems.ts`.
The React state switch is handled by `src/hooks/useWatchlist.ts`.
