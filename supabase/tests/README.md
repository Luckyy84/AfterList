# Supabase verification

Run these tests only against a disposable local or preview database after its migrations have been applied:

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
```

To target an already migrated disposable database, use a percent-encoded connection string:

```powershell
npx supabase test db --db-url "postgresql://..."
```

The suite runs in transactions and rolls fixture data back. Never use `--linked` for routine verification.

The repository's oldest migration currently assumes `public.watchlist_items` already exists. A clean `db reset` therefore requires the production baseline migration to be added first; until then, use a disposable database restored from that baseline. The tests intentionally fail closed if Milestone 2 tables, constraints, RLS policies, grants, or RPCs are absent.
