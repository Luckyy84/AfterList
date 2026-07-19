# AfterList Homepage V2 — Engineering Handoff

This package is the implementation source of truth for the AfterList homepage redesign.

## Artifacts

- `desktop-1440.png` — signed-in desktop default with Watching titles.
- `mobile-390.png` — dedicated mobile layout with the menu closed.
- `mobile-menu-open.png` — signed-in mobile navigation and focus state.
- `system-and-states.png` — tokens, component states, hero fallbacks, skeletons, empty states, and artwork failures.

The images establish composition and visual character. The measurements, copy, states, and behavior below take precedence where generated-image text or proportions are imperfect.

## Product rules

1. Home answers three questions in order: what can I resume, what is in my list, and what could I add next?
2. A populated list must never receive the empty guest hero just because no title is `Watching`.
3. Guests keep full local-watchlist functionality. Sign-in is explained only as optional cloud sync.
4. Search, profile/sign-in, settings, and sign-out remain reachable at every supported width.
5. Artwork is enhancement, not identity. Every title remains identifiable when an image fails.

## Layout

### Desktop — 1440px

- Page canvas: `#0c0b0a`.
- Content max width: 1400px.
- Page gutter: 32px.
- Header height: 64px minimum; 16px gap before hero.
- Header: brand left, route navigation centered, Search/account/settings right.
- Hero: full content width, 16:7 target ratio, minimum height 520px, radius 26px.
- Hero copy column: maximum 520px; 32px inset; vertically centered.
- Hero selector: maximum five 2:3 posters, 72 × 108px, bottom-left aligned with hero copy.
- Section gap: 40px; heading-to-rail gap: 16px.
- Continue cards: 320px wide, 16:9 artwork, 18px radius.
- Watchlist cards: 320px wide, 16:9 artwork, 16px radius.
- Recommendation cards: 232px wide, 2:3 artwork where current component data supports it; otherwise use the shared landscape card.
- Rails use one horizontal row. Do not wrap into grids on Home.
- Footer begins after 56px and uses one brand column plus Pages, Resources, Legal, and attribution/meta columns.

### Laptop/tablet landscape — 1024px

- Gutter: 24px.
- Header route spacing compresses; Search becomes an icon-only 44px control before navigation collapses.
- Hero minimum height: 480px; copy maximum 46%; hero thumbnails 64 × 96px.
- Cards: 280–300px. Show approximately three cards and a partial next card.
- Footer becomes three columns; brand and legal attribution may span columns.

### Tablet — 768px

- Gutter: 20px.
- Replace route links and account tools with Search + Menu icon controls.
- Hero becomes a stacked composition. Artwork occupies the top/back layer; content remains in the same card.
- Hero uses a bottom-to-top readability fade, not a full-image color wash.
- Actions may share a row only if both remain at least 44px tall and labels do not wrap; otherwise stack.
- Footer becomes two columns.

### Mobile — 390px

- Gutter: 16px.
- Header controls: 48 × 48px Search and Menu.
- Hero radius: 22px; inset: 16px; content stays left aligned.
- H1: 40px/44px maximum, reduced fluidly with `clamp()`.
- Hero actions stack and fill the content width.
- Hero thumbnail row is left aligned and horizontally scrollable.
- Rails use touch scrolling, `scroll-snap-type: x proximity`, hidden visual scrollbar, and a visible next-card peek.
- Landscape card width: `calc(100vw - 48px)`.
- Filters scroll horizontally; they never wrap into multiple rows.
- No desktop rail arrow buttons.
- Footer uses brand summary first, then two columns of links, then attribution/meta.

### Minimum width — 320px

- Gutter: 12px.
- Keep logo mark and wordmark; reduce the wordmark to 18px before removing any required action.
- Search and Menu remain 44 × 44px with an 8px gap.
- H1: 34px/38px.
- Hero title: 20px/26px.
- Body: 15px/23px.
- Landscape card width: `calc(100vw - 40px)`.
- Long CTA labels wrap to two centered lines; height becomes auto with 12px vertical padding.
- Counts may use up to four digits without shrinking label text. Beyond 9999, display `9.9k+` visually and expose the exact count to assistive technology.
- The five hero thumbnails scroll; do not squeeze them below 56 × 84px.
- No element may make the page root wider than the viewport.

## Design tokens

### Color

| Token | Value | Use |
|---|---:|---|
| `canvas` | `#0c0b0a` | Page background |
| `surface` | `#141210` | Cards, menus, skeletons |
| `surface-subtle` | `#12100e` | Recessed panels |
| `border` | `#262320` | Default outlines/dividers |
| `border-hover` | `#3a342d` | Hover emphasis |
| `text-primary` | `#f5f2ec` | Headings and primary labels |
| `text-secondary` | `#b7b0a6` | Body and secondary labels |
| `text-muted` | `#8f887e` | Hints and metadata |
| `text-disabled` | `#6f6960` | Disabled controls only |
| `accent` | `#f4772e` | Progress, active counts, selective brand emphasis |
| `watching-bg/text` | `#22301a` / `#d9edc9` | Watching status |
| `watched-bg/text` | `#1a2430` / `#c9d8ed` | Watched status |
| `planned-bg/text` | `#2b2620` / `#e8e3da` | Planned status |
| `dropped-bg/text` | `#301e1a` / `#edd0c9` | Dropped status |

Orange does not mean “selected” globally. Selected nav and filters use surface, weight, outline, and `aria-selected` in addition to any accent detail.

### Typography

- Preferred headings/wordmark: Sora. Preferred UI/body: Manrope.
- Delivery order: locally hosted files, then the system fallback stack.
- System fallback: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- H1 desktop: 56/60, 800, -0.03em. Mobile: 40/44. 320px: 34/38.
- H2: 28/34, 700, -0.02em. Mobile: 24/30.
- Hero title: 24/30, 700. Mobile: 20/26.
- Card title: 16/22, 700.
- Body large: 16/24, 400.
- Body: 14/22, 400.
- Small/meta: 12/18, 500.
- Labels/buttons: 14/20, 700.
- Browser-default form/control typography is never used.

### Geometry and spacing

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px.
- Radius scale: 8, 12, 16, 18, 26px; 999px only for nav, statuses, and filters.
- Shadows: none for normal cards. Menus use `0 18px 48px rgba(0,0,0,.42)`.
- Focus: 2px `#f5f2ec`, 2px offset using the surrounding background color.
- Minimum touch target: 44 × 44px; target 48px on mobile.

### Motion

- Fast: 120ms; standard: 180ms; deliberate content swap: 260ms.
- Ease: `cubic-bezier(.22, 1, .36, 1)`.
- Hover card transform: translateY(-2px), never more than 1.015 scale.
- Hero selection changes on explicit input only; no automatic rotation.
- Reduced motion removes transforms and scroll animation; state changes use a near-instant opacity swap.

## Component specifications

### Header

- Desktop route selection: warm-white surface, dark text, `aria-current="page"`.
- Search is labeled `Search`; icon-only variants use `aria-label="Search"`.
- Profile opens the account menu. Settings opens preferences; it is not an alias for the account menu.
- Signed-out account label is `Sign in`.
- Dropdown/drawer closes on Escape, outside pointer input, route selection, and successful sign-out.
- On close, focus returns to the triggering control.

### Mobile menu

- Positioned below the header, inside the page gutter; width fills available space.
- Solid `surface`, 18px radius, 1px border, menu shadow.
- Signed-in order: Home, Discover, Library, Statistics, divider, Profile, Settings, Sign out.
- Signed-out order: Home, Discover, Library, Statistics, divider, Sign in, Settings.
- Rows are at least 48px. Current route has `aria-current`, stronger weight, outline, and a check/current marker.
- Opening locks page scroll and moves focus to the current route. Focus is trapped until close.

### Hero

- Feature source: Watching items sorted by latest activity.
- Selector contains up to five Watching items. Selecting a thumbnail updates copy, artwork, metadata, and title-specific action without fetching.
- Selector is a tablist. Thumbnails are tabs with `aria-selected`; hero content is the associated tabpanel.
- Synopsis clamps to three lines desktop and four lines mobile.
- Missing metadata is omitted. Do not render separators for missing fields.
- Rating is omitted when unknown or zero; never fabricate one.

### Buttons

- Primary: warm-white background with dark text for title actions. Accent orange is allowed only when product-wide CTA emphasis is intentionally retained.
- Secondary: transparent/surface background, 1px border, warm-white text.
- Loading retains label width, uses a spinner, sets `aria-busy`, and prevents duplicate activation.
- Disabled uses disabled text and border but must retain legible contrast.

### Filters

- Use a tablist only when the panel content switches in place; otherwise use pressed buttons.
- Every status displays its real count.
- Selected state uses surface contrast, stronger text, outline/current marker, and `aria-selected`; not color alone.
- A zero-count filter remains selectable so users can see its empty-state explanation.

### Rails and cards

- Desktop rails provide previous/next buttons only when content overflows. Disable at each boundary.
- Touch rails use native horizontal scrolling with proximity snap and preserve momentum.
- Arrow buttons are icon-only, 44px, and have descriptive labels.
- Images use fixed aspect-ratio wrappers and `object-fit: cover` to prevent layout shift.
- Title clamps to two lines. Metadata clamps to one line and omits missing values cleanly.
- Progress uses orange plus visible text; color is never the only progress indicator.
- Card focus applies to the primary title link; nested actions remain separately focusable.

## Hero state matrix

| State | Heading | Primary action | Secondary/action note |
|---|---|---|---|
| Watching titles | Pick up where you left off. | View [Title] / Continue watching | Discover something new |
| Saved titles, none Watching | Choose your next story. | Start watching | Choose something from your list; feature the most recently updated Planned title, then another saved title |
| Signed-in empty | Build your watchlist. | Explore trending titles | Search; explain that additions sync across devices |
| Guest local list | Same rules as signed-in populated states | Title-specific action | No sign-in pressure |
| Guest empty | Find it. Save it. Watch it. | Explore trending titles | “Your list is saved in this browser.” |
| Loading | No visible copy replacement | Stable skeleton | Match final hero/card dimensions |
| Data error | We couldn’t load your watchlist. | Retry | Discover remains available when public discovery works |
| Missing artwork | Normal state copy | Normal action | Use backdrop fallback; do not downgrade the whole state to an error |

## Async, empty, and failure states

- Hero skeleton matches final height, copy block, actions, and thumbnail dimensions.
- Rail skeletons match the final card count and aspect ratio visible at that breakpoint.
- Skeleton color: `#151310` base with a restrained `#211e1a` highlight. Disable shimmer for reduced motion.
- Recommendations unavailable: keep the section heading; show “Recommendations aren’t available right now.” and `Retry`. Never block watchlist use.
- Zero-result filter: “No [status] titles yet.” Optional action: `Browse your library` or `Discover titles`, depending on context.
- Poster fallback: 2:3 surface, subtle film-frame mark or title initials, title and year outside/in the normal metadata region.
- Backdrop fallback: 16:7/16:9 surface with a quiet film-frame pattern and edge fade. Keep normal title copy over it.
- Image components hide failed images and swap to fallback in the same wrapper. A broken-image icon is never visible.

## Accessibility

- Landmarks: header/nav, main, labeled sections, footer. One H1 only.
- Focus order follows visual order. Skip-to-content remains first.
- All icon-only controls have accessible names.
- Image alt: informative artwork uses `[Title] backdrop` or `[Title] poster`; duplicate thumbnail/card imagery may use empty alt when the adjacent link already names it.
- Selected state is communicated by `aria-current`, `aria-selected`, text weight, shape, and marker—not color alone.
- Text must survive 200% zoom and browser text resizing without clipping.
- Hero contrast target: 4.5:1 for body/UI text and 3:1 for large text. Use deterministic edge fades around copy.
- Touch targets are at least 44px where practical.
- Respect `prefers-reduced-motion` and `prefers-contrast` where supported.

## Visible copy inventory

### Global

- AfterList
- Home
- Discover
- Library
- Statistics
- Search
- Sign in
- Profile
- Settings
- Sign out

### Default homepage

- Pick up where you left off.
- View [Title]
- Continue watching
- Discover something new
- Continue watching
- [n] items
- Your watchlist
- View full library
- Watching
- Watched
- Planned
- Dropped
- Because it matches your list
- Add to watchlist

### Empty/error states

- Choose your next story.
- Start watching
- Choose something from your list
- Build your watchlist.
- Find it. Save it. Watch it.
- Explore trending titles
- Your list is saved in this browser.
- We couldn’t load your watchlist.
- Recommendations aren’t available right now.
- No [status] titles yet.
- Retry

### Footer

- Your personal tracker for anime, movies, and TV series.
- Pages
- Resources
- Legal
- TMDB
- GitHub
- Privacy & Cookies
- Terms of Use
- AfterList uses third-party services to fetch anime, movie, and series info.
- This product uses the TMDB API but is not endorsed or certified by TMDB.
- © 2026 AfterList
- For educational purposes only
- Made by Luckyy

## Engineering notes

- Reuse the current routes, watchlist data, TMDB media, status enum, and authentication behavior.
- Do not add a carousel package, component library, font package, or new persistence.
- Preserve fixed image containers before image load. Use native lazy loading for below-fold images; prioritize only the active hero backdrop.
- Self-host Sora/Manrope only if font files are committed and preloadable. Otherwise use the system fallback immediately; do not block rendering on remote font CSS.
- Consolidate homepage rules into the existing redesign layer instead of creating another global override file.

## Assumptions and unresolved decisions

- “Start watching” changes a Planned item to Watching only if the existing product already supports that action safely; otherwise link to details and label the CTA `View [Title]`.
- Remaining runtime/episode text is shown only when the existing data model provides it. No derived or fake progress is required.
- Recommendation retry behavior depends on the existing discovery request contract.
- The artwork in concept images is directional placeholder imagery. Production uses TMDB artwork and the defined fallbacks.

## Final audit checklist

- Header actions complete signed in and signed out.
- Populated/no-Watching state does not look empty.
- Hero, rails, and recommendations have stable loading states.
- Missing poster/backdrop never exposes a broken-image icon.
- Menu fits 320px and returns focus on close.
- Filters handle zero and large counts.
- Long titles and CTAs wrap or clamp without clipping.
- Desktop arrows and touch scrolling work at their intended breakpoints.
- All focus states are visible.
- Footer copy and links are complete.
- No root-level horizontal overflow at 320px.
