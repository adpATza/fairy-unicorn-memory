# Memory Card Game — web edition (in development)

The progressive web app edition of Memory Card Game. The plan, decisions and phases are in [`../docs/PWA-PLAN.md`](../docs/PWA-PLAN.md).

**Status: Phase 1.** The game rules (`src/session.ts`) and card placement (`src/layout.ts`) are ported from the Godot edition and tested. `index.html` is a development page showing a fitted board of face-down cards; the playable screens arrive in Phase 2.

## Develop

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173/?pairs=30&layout=scattered
npm run check      # typecheck, unit tests, build and browser tests
```

Individual steps: `npm run typecheck`, `npm test` (Vitest), `npm run build`, `npm run e2e` (Playwright, Chromium).

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
