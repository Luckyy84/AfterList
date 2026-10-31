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

The oldest migration bootstraps an empty database. CI replays the full history on local Supabase; a SQL-only PostgreSQL fallback and its deliberately minimal auth contract are documented in `docs/SYSTEMS_FOUNDATION.md`. The tests fail closed if tables, constraints, RLS policies, grants, or RPCs are absent.
