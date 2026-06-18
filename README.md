# AfterList

AfterList is a dark-mode personal media tracker for **anime, movies, and TV series**.

The goal is to build a clean Apple TV / Netflix-inspired watchlist while learning **React**, **TypeScript**, **Vite**, Motion, CSS architecture, and real API integration step by step.

## Project Goals

- Track anime, movies, and TV series
- Keep the design dark, cinematic, glassy, and polished
- Learn React and TypeScript from the ground up
- Build local-first, then add real APIs, accounts, sync, and sharing
- Keep the codebase organized enough to grow without becoming messy

## Current Status

Phase 1 is mostly complete. The app currently runs on local/mock data, saves to `localStorage`, and uses a polished dark glass UI.

Implemented so far:

- Homepage hero with automatic random rotation
- Hero preview rail with clickable thumbnails
- Netflix-like watchlist rows
- Media cards with poster, title, type, and status
- Statuses: `Planned`, `Watching`, `Watched`, `Dropped`
- Automatic migration from old `Completed` status to `Watched`
- Details modal for saved items
- Edit status from the details modal
- Remove saved item
- Search button that expands into a nav search bar
- Mock search result dropdown
- Search preview/create modal
- Keyboard navigation for search results
- Duplicate prevention and duplicate cleanup on load
- Mobile layering fixes for search and details modal
- Mobile performance pass for expensive blur/filter/layout animation work

## Roadmap

### Phase 1 — Local App Foundation

- Basic homepage ✅
- Media cards ✅
- Demo anime/movie/TV data ✅
- Type filters ✅
- Status filters ✅
- Edit status ✅
- Search / create preview flow ✅
- Remove item ✅
- Save data with localStorage ✅
- Duplicate prevention ✅
- Mobile layout and performance stabilization ✅

### Phase 2 — Real API Search/Add Flow

- Connect TMDB for movies and TV series
- Replace mock movie/TV search results with API results
- Add loading and error states
- Map TMDB results into the app `MediaItem` structure
- Prevent duplicates using API IDs/source IDs
- Add API-based item creation
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

## Tech Stack

- React
- TypeScript
- Vite
- CSS
- Motion
- Git and GitHub

## Project Structure

```text
src/
├─ components/
│  ├─ layout/       # App shell pieces like nav and footer
│  ├─ media/        # Media cards, rows, and saved-item details modal
│  └─ search/       # Search bar, result dropdown, and preview/create flow
├─ data/            # Temporary demo data and mock search catalog
├─ hooks/           # Reusable React hooks
├─ pages/           # Route pages for home/anime/movies/series
├─ styles/
│  ├─ details/      # Details modal/status editor styles
│  ├─ hero/         # Hero preview rail styles
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

## Git Notes

Active development is on `Improved-UI`.

`main` should stay untouched unless a merge is explicitly requested.

## License

This project is licensed under the MIT License.
