# AfterList

AfterList is a dark-mode personal media tracker for **anime, movies, and TV series**.

The goal is to build a clean Apple TV / Netflix-inspired watchlist while learning **React**, **TypeScript**, **Vite**, Motion, CSS architecture, deployment, and real API integration step by step.

## Live Deployment

AfterList is deployed on **Vercel** from the `main` branch.

The app uses Vercel's static Vite deployment flow, a Vercel API function for TMDB search, and a `vercel.json` rewrite so direct refreshes on routes like `/anime`, `/movies`, and `/series` work correctly.

## Project Goals

- Track anime, movies, and TV series
- Keep the design dark, cinematic, glassy, and polished
- Learn React and TypeScript from the ground up
- Use real API search results instead of local mock catalogs
- Keep TMDB credentials server-side through a Vercel API proxy
- Deploy the app as a real hosted website
- Keep the codebase organized enough to grow without becoming messy

## Current Status

Phase 1 is complete and Phase 2 has started. The app saves API-backed items to `localStorage`, uses a polished dark glass UI with Motion-powered hero, carousel, search, and modal animations, and searches TMDB through an AfterList Vercel API proxy.

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
- Statuses: `Planned`, `Watching`, `Watched`, `Dropped`
- Automatic migration from old `Completed` status to `Watched`
- Details modal for saved items
- Motion details modal animation
- Edit status from the details modal
- Remove saved item
- Search button that expands into a nav search bar
- Server-side TMDB movie/TV search proxy
- Conservative TMDB anime detection for Japanese animation results
- No local demo/search fallback data
- Motion search morph and result transitions
- Search preview/create modal
- Keyboard navigation for search results
- Duplicate prevention and duplicate cleanup on load
- Mobile layering fixes for search and details modal
- Mobile performance pass for expensive blur/filter work while keeping Motion animations active
- TMDB attribution in the UI

## Roadmap

### Phase 1 — App Foundation

- Basic homepage ✅
- Media cards ✅
- Type filters ✅
- Status filters ✅
- Edit status ✅
- Search / create preview flow ✅
- Remove item ✅
- Save data with localStorage ✅
- Duplicate prevention ✅
- Motion animations for hero, rows, search, and modals ✅
- Mobile layout and performance stabilization ✅
- Vercel deployment ✅

### Phase 2 — Real API Search/Add Flow

- Connect TMDB for movies and TV series ✅
- Replace mock movie/TV search results with API results ✅
- Remove local search/demo fallback data ✅
- Add loading and error states ✅
- Map TMDB results into the app `MediaItem` structure ✅
- Prevent duplicates using API IDs/source IDs ✅
- Add API-based item creation ✅
- Add TMDB attribution in the UI ✅
- Move TMDB requests behind a Vercel/serverless API proxy ✅
- Add anime API later, likely AniList or Jikan

### Phase 3 — Accounts and Sync

- User accounts
- Login system
- Database storage
- Sync watchlist across devices

### Phase 4 — Sharing

- Public user profiles
- Friend sharing
- Optional public watchlists

## TMDB Proxy Setup

AfterList searches TMDB through the Vercel function at:

```text
/api/search?query=dune
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

Do **not** use the `VITE_` prefix for TMDB credentials. `VITE_*` values are exposed in the browser bundle, while this project reads `TMDB_*` from the Vercel API function.

For local testing of the API proxy, use Vercel's local dev server:

```bash
npx vercel dev
```

Using plain `npm run dev` starts Vite only, so `/api/search` will not run locally unless Vercel's dev server is handling the request.

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

Add the variable to **Production** and **Preview** environments so both live and preview deployments can search.

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

That keeps route refreshes working for `/anime`, `/movies`, and `/series` without swallowing `/api/search`.

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
- Vercel
- Git and GitHub

## Project Structure

```text
api/
└─ search.ts         # Vercel API proxy for TMDB search
src/
├─ components/
│  ├─ layout/       # App shell pieces like nav and footer
│  ├─ media/        # Media cards, rows, and saved-item details modal
│  └─ search/       # Search bar, result dropdown, and preview/create flow
├─ hooks/           # Reusable React hooks
├─ pages/           # Route pages for home/anime/movies/series
├─ services/        # Frontend services that call AfterList API routes
├─ styles/
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
├─ types/           # TypeScript types
├─ utils/           # Helper functions
├─ App.tsx          # Main app component
└─ main.tsx         # React entry point
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite-only dev server:

```bash
npm run dev
```

Start the Vercel dev server when testing `/api/search`:

```bash
npx vercel dev
```

Build for production:

```bash
npm run build
```

## Git Notes

`main` is the deployed production branch.

Use short-lived feature branches for new work, then merge back into `main` through pull requests.

## License

This project is licensed under the MIT License.
