# Memory Card Game — web edition (in development)

The progressive web app edition of Memory Card Game. The plan, decisions and phases are in [`../docs/PWA-PLAN.md`](../docs/PWA-PLAN.md).

**Status: Phase 4.** An installable progressive web app for 1–4 players on phones, tablets and desktops, playable offline after the first visit, with the six built-in decks and a deck library for your own pictures. The web edition of the adult guide (Phase 5) is still to come, so setup has no Adult guide button yet.

## Deck library

Setup → **Deck library** lists every deck. Custom decks can be renamed or deleted (with confirmation); included decks cannot.

- **Make a deck:** *Choose pictures* (the photo picker on phones), *Choose a folder* (on devices with a mouse or trackpad), or drop pictures onto the library. PNG, JPEG and WebP are accepted. As in the Windows edition: 2–30 unique pictures; larger sets need a manual subset; unreadable files and exact duplicates (same decoded pixels, even if saved differently) are rejected with reasons; a folder's nested folders are not scanned.
- **Saved pictures** are fitted at 90% onto a white 1024-pixel square, never stretched or cropped, and stored as PNG on the device. Originals are only read. Very large photos (over 16 megapixels) are compared for duplicates at a reduced size, within iOS Safari's canvas limit.
- **Storage:** decks live in IndexedDB. A deck and its pictures are written in one transaction, so a save completes or leaves nothing behind. After the first save the app asks the browser to keep decks when space runs low; the library shows whether it agreed and how much space is used.
- **Back up decks** downloads one ZIP: `Memory Card Game/backup.json`, a README, and `Memory Card Game/decks/custom_<id>/` folders in the Windows edition's format. **Restore backup** (or dropping the ZIP) adds missing decks and keeps decks already on the device. Backed-up settings are applied only while this device still has the default settings.
- **Windows edition:** copy a backup's `decks` folder into `%APPDATA%\Memory Card Game\` to use the decks there. In the other direction, choose the Windows `decks` folder (or one `custom_…` deck folder, or a ZIP of either) in the library to add those decks here.

## Install and offline play

- **Offline:** on the first visit the service worker caches every file of the build (189 files, about 1 MB: the app, all 180 deck pictures, icons and manifest). After that the game runs with no connection. A short "Ready to play offline." note confirms it.
- **Install:** Chrome, Edge and Android show an **Install app** button on the setup screen. On iPhone and iPad, use Safari's Share menu → *Add to Home Screen*. The installed app opens full screen as **Memory Cards**.
- **Updates** download in the background. "A new version is ready" appears only on setup or results, **never during a round**. *Update now* reloads into the new version; *Later* keeps the current one for this visit.
- **Publishing:** `.github/workflows/web.yml` runs the type check, unit tests, build and browser tests on pull requests, and deploys `web/dist` to GitHub Pages from `main`. One-time setup: *Settings → Pages → Build and deployment → Source: GitHub Actions*. The site will be at `https://adpatza.github.io/memory-card-game/`.

| File | Role |
| --- | --- |
| `public/manifest.webmanifest` | Name, colours, standalone display, icons |
| `public/icons/` | PNG icons rendered from `../assets/icon.svg` by `npm run icons` (a unit test flags stale icons) |
| `build/service-worker.js` | Precache-everything worker: cache-first, offline navigation, waits to activate until asked |
| `build/pwa.ts` | After `vite build`, lists every file in `dist/`, versions the cache by content and writes `dist/sw.js` |
| `src/pwa.ts` | Registration, the offline and update notes, round-safe updates, the Install button |

Caches and saved settings are prefixed `memory-card-game-` because GitHub Pages project sites share one origin.

## Source map

| File | Role | Godot counterpart |
| --- | --- | --- |
| `src/session.ts` | Round rules and clock | `scripts/game_session.gd` |
| `src/layout.ts` | Card placement, fitting and recommended pairs | `scripts/board_layout.gd` |
| `src/manifest.ts`, `src/decks.ts` | Manifest validation and built-in decks | `scripts/deck_library.gd` |
| `src/preferences.ts` | Saved settings (`localStorage`) | `preferences.cfg` in `scripts/main.gd` |
| `src/app.ts` | Navigation, Back button, preferences, services | `scripts/main.gd` |
| `src/audio.ts` | The same synthesised tones, via Web Audio | `main.gd::_tone` |
| `src/screens/*.ts` | Setup, gameplay and results screens | `scripts/*_screen.gd`, `scripts/card.gd` |
| `src/styles.css` | Palette, controls and responsive layouts | `scripts/ui.gd` |
| `src/pwa.ts`, `build/` | Service worker, updates, installation | — |
| `src/storage.ts` | Custom decks in IndexedDB (atomic save, rename, delete), persistence | `user://decks/custom_*` |
| `src/imports.ts` | Decode, duplicate check, 1024-pixel fitting, save | `deck_library.gd::scan_folder/save_import` |
| `src/library.ts` | Built-in plus custom decks, backup and restore | `MemoryDeckLibrary` |
| `src/backup.ts`, `src/zip.ts` | Backup ZIPs and Windows deck folders | `storage.gd` (copy-only upgrade rules) |
| `src/screens/library.ts`, `src/screens/import.ts` | Deck library and import review | `scripts/library_screen.gd` |

## Behaviour on the web

- **Board fit:** the game screen is exactly one viewport. Its header and footer compact on phones and short landscape screens (setup, new round and sound move into the pause menu), and the board takes the rest. All cards are visible at 100% zoom with no scrolling, for every pair count.
- **Recommended pairs:** setup measures the board the game screen would give the chosen number of players, and shows "Recommended up to N pairs on this screen". More pairs are allowed with a note that cards will be small; it updates on rotation or resize.
- **Input:** tap or click; Tab, arrow keys (nearest card in that direction), Space/Enter and Escape (pause), as in Godot. Focus moves automatically only for keyboard (or non-touch) users, so touch players see no stray focus rings. Double-tap zoom and long-press menus are disabled on cards; pinch zoom still works.
- **Pause:** Escape, the Pause button, switching apps, hiding the tab or leaving the window pauses: artwork is concealed and the clock stops. The pause menu also holds Sound, Reduced motion, New round and Return to setup.
- **Leaving:** Setup, New round, the browser or Android Back button, and closing the tab all ask before discarding an unfinished round.
- **Accessibility:** cards are real buttons with neutral labels ("Face-down card 7", "Revealed card 7"), in reading order. Turn and hint changes are announced politely. Reduced motion starts from the device setting and can be changed in setup or pause.
- **Settings** are saved in `localStorage` as they change. If storage is blocked, the game still runs with defaults.
- `?seed=<number>` fixes every round's shuffle and layout (used by the browser tests and handy for bug reports).

## Develop

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173/
npm run check      # typecheck, unit tests, build and browser tests
```

Individual steps: `npm run typecheck`, `npm test` (Vitest), `npm run build`, `npm run e2e` (Playwright, Chromium).

The browser tests run against the production build with the service worker active. They cover importing (duplicates, corrupt files, 31-picture subsets, JPEG/WebP, folders, drag and drop, fitting without cropping), playing a custom deck online and offline, rename/delete, backup and restore across devices, Windows deck folders, offline play after the first visit (including other decks' pictures), the manifest and icons, update prompts that wait until a round ends (using a private copy of the build as a GitHub Pages-like server), every pair count tier (2, 12, 30) for 1 and 4 players in both layouts at seven screen sizes, complete solo and multiplayer rounds (played by revealing cards, with a fake clock), the 1.5-second mismatch, pause concealment, auto-pause, leave confirmations, the Back button, keyboard play, saved settings and the pair recommendation. Any console error fails a test.

Adding or upgrading packages: use npm 11 or newer (ships with Node 24). npm 10's resolver crashes on Vitest's optional peer dependencies; `npm ci` from the lockfile works on either.

## Shared files

Artwork, deck manifests and icons are read from the Godot project's `../assets/` through the `@assets` alias; nothing is copied into `web/`. `web/.gdignore` keeps Godot from importing this folder, and the Windows export and source ZIP exclude it.

## Differences from the Godot layout

The rules are unchanged. Card placement follows `scripts/board_layout.gd` with these changes for screens of any shape:

- Cards are placed in the board's own size at round start instead of a fixed 1212 × 490 area. Resizing or rotating scales the whole board uniformly; cards never move during a round.
- The gap between cards is 10 px on roomy boards and shrinks to 4 px on dense ones.
- A card is never larger than the board's shorter edge, so very wide or tall boards work.
- Scattered dart throwing never shrinks cards below the size the free-space subdivision guarantees. On a portrait phone this keeps 12 pairs at about 70–80 px instead of about 53 px.
- The grid tries every column count and keeps the largest cards.
- `recommendedMaxPairs()` gives the largest pair count whose cards stay at least 56 CSS px on the current board; players may choose more.
- Random sequences use mulberry32 rather than Godot's PCG32, so seeds do not reproduce the Windows edition's shuffles.
