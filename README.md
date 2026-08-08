# AfterList

AfterList is a dark-mode personal media tracker for **anime, movies, and TV series**.

The goal is to build a clean Apple TV / Netflix-inspired watchlist while learning **React**, **TypeScript**, **Vite**, Motion, CSS architecture, deployment, auth, database sync, and real API integration step by step.

## Live Deployment

AfterList is deployed on **Vercel** from the `main` branch.

The app uses Vercel's static Vite deployment flow, Vercel API functions for TMDB search/details, and a `vercel.json` rewrite so direct refreshes on routes like `/anime`, `/movies`, `/series`, `/login`, and `/signup` work correctly.

## Project Goals

- Track anime, movies, and TV series
- Keep the design dark, cinematic, glassy, and polished
- Learn React and TypeScript from the ground up
- Use real API search results instead of local mock catalogs
- Keep TMDB credentials server-side through a Vercel API proxy
- Add real accounts and prepare for cross-device sync
- Deploy the app as a real hosted website
- Keep the codebase organized enough to grow without becoming messy

## Current Status

AfterList now supports the complete private-tracker and opt-in sharing roadmap. Guests remain local-first, signed-in users sync through Supabase, TMDB and AniList data stay behind Vercel API functions, and public profiles remain disabled unless `PUBLIC_PROFILES_ENABLED=true` is configured explicitly.

Implemented so far:

- Live Vercel deployment
- Homepage hero with automatic random rotation
- Empty homepage hero for new/empty lists
- Motion-powered hero transitions
- Hero preview rail with clickable thumbnails
- Netflix-like watchlist rows
- Desktop row arrows
- Mobile native swipe/grab rows
- Media cards with poster, title, type, and status
- Statuses: `Planned`, `Watching`, `Paused`, `Watched`, `Dropped`
- Automatic migration from old `Completed` status to `Watched`
- Details modal for saved items
- Richer TMDB details in saved-item modal: genres, runtime, seasons, episodes, and country metadata
- Motion details modal animation
- Edit status from the details modal
- Remove saved item
- Search button that expands into a nav search bar
- Server-side TMDB movie/TV search proxy
- Server-side TMDB movie/TV details proxy
- Conservative TMDB anime detection for Japanese animation results
- No local demo/search fallback data
- Motion search morph and result transitions
- Search preview/create modal
- Keyboard navigation for search results
- Duplicate prevention and duplicate cleanup on load
- Mobile layering fixes for search and details modal
- Mobile performance pass for expensive blur/filter work while keeping Motion animations active
- TMDB attribution in the UI
- Supabase auth client setup
- Login and signup routes
- Email/password auth wiring
- Google OAuth button wiring
- Signed-in nav state and sign-out button
- Canonical, refresh-safe `/movie`, `/tv`, and `/anime` title URLs
- Native AniList search, discovery, details, and richer anime metadata
- Canonical provider aliases with explicit, reversible duplicate confirmation
- Episode progress, rewatches, dates, ratings, favorites, and private notes
- Custom lists, event history, richer statistics, and JSON export
- Integration API tokens and Jellyfin synchronization
- Private-by-default usernames, profiles, favorites, statistics, libraries, and public lists
- Playwright browser coverage plus migration/RLS pgTAP test assets

## Roadmap

The three planned milestones are implemented in the repository:

1. Stable canonical media pages and legacy-link compatibility.
2. AniList, canonical identity, deeper tracking, lists, history, and export.
3. Private-by-default profiles and explicitly shared libraries and lists.

Before enabling the new database-backed features in an environment, apply the additive Supabase migrations, run the SQL/RLS suite against a disposable database, and then set `PUBLIC_PROFILES_ENABLED=true` deliberately. Follows, feeds, comments, reactions, reviews, and broader moderation remain future work.

## TMDB Proxy Setup

AfterList talks to TMDB through Vercel functions:

```text
/api/search?query=dune
/api/details?externalId=movie:550
/api/details?externalId=tv:1399
```

The frontend calls the local API proxy, not TMDB directly. The real TMDB credential should be stored as a server-side environment variable.

Create a local env file:

```bash
cp .env.example .env.local
```

Then add one TMDB credential:

```env
TMDB_API_KEY=your_tmdb_v3_api_key
# or
TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
```

Do **not** use the `VITE_` prefix for TMDB credentials. `VITE_*` values are exposed in the browser bundle, while this project reads `TMDB_*` from Vercel API functions.

For local testing of the API proxy, use Vercel's local dev server:

```bash
npx vercel dev
```

Using plain `npm run dev` starts Vite only, so `/api/search` and `/api/details` will not run locally unless Vercel's dev server is handling the request.

## Supabase Auth Setup

AfterList uses Supabase for account auth.

Create a Supabase project, then add these frontend publishable values to `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

These are the client-side values from the Supabase project settings/connect dialog. Do **not** use a Supabase secret/service role key in the frontend.

## Integration API and Jellyfin

Apply the latest Supabase migration, then add these server-only Vercel variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
CRON_SECRET=a_long_random_secret
```

Signed-in users can create and revoke `watchlist:read` and `watchlist:write` tokens under **Settings → Integrations**. The token is shown only once. Personal clients can read with `GET /api/v1/watchlist` and idempotently update a title with `PUT /api/v1/watchlist`; older `updatedAt` values cannot overwrite newer progress.

Vercel Cron refreshes TMDB episode totals, runtimes, posters, and backdrops for signed-in users every day at 02:00 Europe/Berlin. Two UTC schedules cover daylight-saving changes; the protected endpoint skips whichever invocation is outside the Berlin 02:00 hour. Generate `CRON_SECRET` as a long random value and configure it only in Vercel Production alongside the Supabase and TMDB server variables.

The development Jellyfin plugin is in `Jellyfin.Plugin.AfterList`. It targets Jellyfin 10.11.x, sends playback-stop and relevant user-data changes immediately, and reconciles watched/in-progress/favourite items periodically. It does not import the entire Jellyfin library.

For Vercel, add the same variables to **Preview** and **Production**:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

For Google OAuth, enable Google as a provider in Supabase Auth, then add your local and deployed URLs in Supabase Auth redirect settings, for example:

```text
http://localhost:5173
https://your-afterlist-vercel-domain.vercel.app
```

## Vercel Deployment

Recommended Vercel settings:

```text
Framework Preset: Vite
Root Directory: ./
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Production Branch: main
```

Required environment variable on Vercel:

```env
TMDB_API_KEY=your_tmdb_v3_api_key
```

or:

```env
TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
```

Add the variable to **Production** and **Preview** environments so both live and preview deployments can search and fetch details.

The project includes `vercel.json` with a single-page-app rewrite that leaves API routes alone:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/"
    }
  ]
}
```

That keeps route refreshes working for `/anime`, `/movies`, `/series`, `/login`, and `/signup` without swallowing `/api/search` or `/api/details`.

## TMDB Notice

This product uses the TMDB API but is not endorsed or certified by TMDB.

TMDB usage in this project is intended for personal, educational, and non-commercial use unless a separate commercial agreement with TMDB is obtained.

## Tech Stack

- React
- TypeScript
- Vite
- CSS
- Motion / `motion/react`
- TMDB API
- Supabase Auth
- Vercel
- Git and GitHub

## Project Structure

```text
api/
├─ details.ts        # Vercel API proxy for richer TMDB details
└─ search.ts         # Vercel API proxy for TMDB search
src/
├─ components/
│  ├─ layout/       # App shell pieces like nav and footer
│  ├─ media/        # Media cards, rows, and saved-item details modal
│  └─ search/       # Search bar, result dropdown, and preview/create flow
├─ context/         # App-level React contexts like Supabase auth
├─ hooks/           # Reusable React hooks
├─ pages/           # Route pages for home/anime/movies/series/auth
├─ services/        # Frontend services that call AfterList API routes and Supabase
├─ styles/
│  ├─ auth/         # Login/signup/account styles
│  ├─ details/      # Details modal/status editor styles
│  ├─ hero/         # Hero and empty-state hero styles
│  ├─ media/        # Cards, hover, and row styles
│  ├─ search/       # Search/nav/modal styles
│  ├─ base.css      # Core layout and shared styles
│  ├─ background.css
│  ├─ index.css     # Imports all grouped CSS files
│  ├─ mobile-fixes.css
│  ├─ mobile-layer-fixes.css
│  └─ mobile-performance.css
└─ types/           # Shared TypeScript types
```

## Git Notes

`main` is the deployed production branch.

Use feature branches for bigger changes:

```bash
git checkout main
git pull origin main
git checkout -b feature-name
```

Before merging back into `main`:

```bash
npm install
npm run build
```

Then open a pull request into `main`, test the Vercel preview, and merge after it looks good.
