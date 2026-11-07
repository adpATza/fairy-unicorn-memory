# Memory Card Game — web edition (in development)

The progressive web app edition of Memory Card Game. The plan, decisions and phases are in [`../docs/PWA-PLAN.md`](../docs/PWA-PLAN.md).

**Status: Phase 2.** The game is playable in the browser with the six built-in decks: setup, gameplay and results screens for 1–4 players on phones, tablets and desktops. Installing and offline play (Phase 3), custom decks (Phase 4) and the web guide (Phase 5) are still to come, so the setup screen has no Deck library or Adult guide buttons yet.

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

The browser tests cover every pair count tier (2, 12, 30) for 1 and 4 players in both layouts at seven screen sizes, complete solo and multiplayer rounds (played by revealing cards, with a fake clock), the 1.5-second mismatch, pause concealment, auto-pause, leave confirmations, the Back button, keyboard play, saved settings and the pair recommendation. Any console error fails a test.

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
