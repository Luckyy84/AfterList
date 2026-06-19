# AfterList

AfterList is a dark-mode personal watchlist for anime, movies, and TV series. It is built as a learning project around React, TypeScript, API integration, authentication, persistence, accessibility, and deployment.

Users can search TMDB, preview a title, add it to a watchlist, change its status, remove it, and browse saved titles by media type. AfterList supports two storage modes:

- **Signed out:** the watchlist is stored in this browser's `localStorage`.
- **Signed in:** the watchlist is loaded from and written to a Supabase `watchlist_items` table.

Guest items are not currently imported into an account automatically. See [Cloud sync](docs/cloud-sync.md) for the current persistence contract and its security limitations.

## Tech stack

- React 19 and React Router
- TypeScript
- Vite
- Plain CSS and Motion
- Supabase Auth and database persistence
- TMDB through Vercel serverless API functions
- Vitest, Testing Library, and ESLint
- Vercel deployment

## Getting started

Requirements:

- Node.js and npm
- A TMDB API credential for search and details
- A Supabase project for account and cloud-watchlist features
- Vercel CLI when testing the local API proxy

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
```

On PowerShell, create the environment file with:

```powershell
Copy-Item .env.example .env.local
```

Never commit `.env.local` or real credentials.

## Environment variables

### TMDB server variables

Configure one of these values:

```env
TMDB_API_KEY=your_tmdb_v3_api_key
# or
TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
```

TMDB credentials are read by the functions in `api/`. Do not prefix them with `VITE_`: Vite exposes `VITE_*` values to the browser bundle.

### Supabase browser variables

Configure both values to enable authentication and signed-in persistence:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

These are intentionally browser-visible publishable values. Never put a Supabase secret key or service-role key in a `VITE_*` variable.

For deployed Preview and Production builds, configure the corresponding values in Vercel. If Google login is enabled, also configure the local and deployed callback URLs in Supabase Auth.

## Local development

Start the Vite frontend only:

```bash
npm run dev
```

This is useful for frontend work, but Vite does not run the Vercel functions under `/api`. Search and details requests therefore require the Vercel development server:

```bash
npx vercel dev
```

Use `vercel dev` when validating the complete local flow, including:

```text
/api/search?query=dune
/api/details?externalId=movie:550
/api/details?externalId=tv:1399
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite frontend development server |
| `npm run preview` | Preview an existing production build |
| `npm run lint` | Lint active project code |
| `npm test` | Run the Vitest suite once in jsdom |
| `npm run build` | Type-check configured projects and create the Vite production build |

Before opening or merging a pull request, run:

```bash
npm run lint
npm test
npm run build
```

Use `npx vercel dev` for manual search/details validation because the production build alone does not exercise live API requests.

## Current features

- Responsive watchlist for anime, movies, and TV series
- Planned, Watching, Watched, and Dropped statuses
- TMDB-backed search and richer title details
- Saved-item and search-preview dialogs
- Duplicate prevention and legacy `Completed` to `Watched` migration
- Guest persistence in `localStorage`
- Supabase email/password and Google authentication wiring
- Signed-in watchlist CRUD through Supabase
- Vercel Analytics and SPA route rewrites

## Project structure

```text
api/                 Vercel functions for TMDB search and details
docs/                Behavior and setup documentation
src/components/      Layout, media, and search UI
src/context/         Authentication context
src/hooks/           Watchlist and reusable React hooks
src/pages/           Home, category, and authentication routes
src/services/        TMDB proxy and Supabase clients
src/styles/          Grouped plain CSS and mobile overrides
src/types/           Shared TypeScript types
src/utils/           Media identity, migration, and normalization helpers
```

`_repo/`, `outputs/`, and archive files are reference or generated material rather than active application source. They should not be used as the implementation source of truth.

## Supabase schema status

The frontend currently expects a `watchlist_items` table, but this repository does **not** contain a reviewed Supabase schema migration or RLS policy migration. That means a fresh Supabase project cannot be reproduced from this repository alone, and the repository cannot prove the security of an existing project's database policies.

Before treating cloud sync as production-ready, a future dedicated change should capture and review:

- table columns, defaults, checks, and indexes;
- uniqueness rules for user and external media identity;
- grants and Row Level Security enablement;
- per-operation ownership policies; and
- migration and rollback instructions.

Do not apply guessed production policies or use a service-role key in the frontend as a workaround.

## Deployment

AfterList is designed for Vercel with the Vite preset, `npm run build`, and `dist` as the output directory. `vercel.json` rewrites non-API routes to the SPA entry point while leaving `/api/*` available to serverless functions.

Configure both TMDB and Supabase variables for the Vercel environments that need the relevant features. Keep TMDB values server-only and use only Supabase publishable values in `VITE_*` variables.

## TMDB notice

This product uses the TMDB API but is not endorsed or certified by TMDB. Usage is intended for personal, educational, and non-commercial purposes unless separately licensed.
