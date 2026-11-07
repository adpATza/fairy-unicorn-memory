# Memory Card Game — PWA edition plan

Status: Phases 1–4 complete (installable, offline-capable game with built-in and custom decks; see `web/README.md`). Branch: `claude/kind-ride-7m3mnx`.

## Decisions

| Question | Decision |
| --- | --- |
| Approach | A native web rebuild in `web/` (TypeScript + Vite, no UI framework), not a Godot Web export. |
| Devices | Phones, tablets/iPads, and desktop/Chromebook are all first-class. |
| Board size | Every card is visible at 100% zoom on every screen, with no scrolling. Setup shows a *recommended* maximum number of pairs for the current screen; players may exceed it and accept smaller cards. |
| First release scope | Full parity: built-in decks, custom import, rename/delete, backup/restore, web guide, GitHub Pages deployment. |

### Why not a Godot Web export

The Windows build's design choices work against a mobile PWA:

- A fixed 1280 × 720 canvas, letterboxed. Text scales to roughly 0.5× on a landscape phone and 0.3× in portrait.
- The download is the engine's WebAssembly runtime (tens of MB uncompressed, several MB compressed), while all 180 SVGs total about 720 KB.
- `SystemFont` (Segoe UI) is unavailable on the web, so a font would need to be bundled.
- The native folder dialog and `OS.shell_open` guide do not work in a browser.
- Everything renders to one canvas, which screen readers cannot read.

The game's logic is small and already pure (`MemorySession`, `MemoryLayout`), so a port is low-risk. The cost is two implementations of the rules. We reduce it by sharing artwork and manifests, and by porting the rule tests.

## Single source of truth

- `assets/decks/**` (SVGs, `manifest.json`, `library.json`), `assets/card_back.svg` and `assets/icon.svg` are read by the web build directly. They are not copied into `web/`.
- The version comes from `project.godot` (`config/version`) at build time.
- `docs/PWA-PLAN.md` (this file) and `docs/IMPLEMENTATION.md` describe the rules that both editions follow.

## Module map

| Godot | Web | Notes |
| --- | --- | --- |
| `game_session.gd` | `src/session.ts` | Same states (FIRST/SECOND/RESOLVING/FINISHED). Match shows for 0.65 s, mismatch for 1.5 s. The extra-turn rule and the pause-freezes-clock rule are unchanged. Clock is driven by `requestAnimationFrame` deltas through `tick()`. |
| `board_layout.gd` | `src/layout.ts` | Same dart-throwing, then free-space subdivision and random-walk mixing. The logical area takes the **board's aspect ratio at round start** instead of the fixed 1212 × 490. |
| `deck_library.gd` | `src/library.ts` | Manifest validation identical (version 1, traversal rejection, 2–30 images, unique pair IDs/paths). Built-ins are fetched; custom decks live in IndexedDB. |
| `storage.gd` | `src/storage.ts` | IndexedDB (decks and image blobs), plus preferences. Calls `navigator.storage.persist()`. Adds backup export/restore. |
| `main.gd` | `src/main.ts` | Navigation, preferences, confirmation dialogs (`<dialog>`), and Web Audio tones synthesised with the same formula. |
| screen scripts | `src/screens/*.ts` | Setup, gameplay, results, library/import, guide. Responsive HTML/CSS. |
| `card.gd` | `<button class="card">` | Identical backs. Neutral labels ("Face-down card 7" / "Revealed card 7"). Artwork `src` is set only while revealed. |
| `ui.gd` | `src/styles.css` | Same palette tokens (`#172c49`, `#245bff`, `#ff7637`, `#ffc933`, `#00b89c`, `#f2f7fe`). System font stack; no redistributed fonts. |

## Board sizing (no scrolling)

- The gameplay screen is exactly one viewport (`100dvh`, respecting safe-area insets). The header, scores and footer are compact on narrow screens, and the board takes the remaining rectangle.
- At round start, positions are generated in a logical space with the board's aspect ratio. Card size is derived from the space available. There is **no fixed minimum** that could force overflow; the layout always fits.
- **Positions never change during a round** (spatial memory is the game). On resize or rotation the whole board scales uniformly to fit its region, letterboxed inside the board area only, as in the Windows version.
- **Recommended maximum pairs:** for the current board rectangle and chosen layout, setup computes the largest pair count whose expected card side is ≥ 56 CSS px. Setup shows "Recommended up to N pairs on this screen". Choosing more shows a gentle note ("Cards will be small — rotate or use a larger screen for bigger cards") but is allowed. Deck size still caps the count, and the range stays 2–30.
- Other screens (setup, library, guide) may scroll on small phones. Only the gameplay board must fit.
- Measured in Phase 1 (board area after header/footer; 56 px threshold): small phone portrait ≈ 10 scattered / 12 grid pairs; phone portrait ≈ 19 / 27; phone landscape ≈ 16 / 24; tablets and larger: 30 / 30. The default 12 pairs on a phone in portrait gives ~70–80 px scattered cards.

## Input and platform behaviour

- Tap, mouse, and the existing keyboard model: Tab/Shift+Tab, arrow-key spatial focus, Space/Enter, and Escape to pause.
- `touch-action: manipulation` on the board (no double-tap zoom on cards). Cards have no long-press context menu and no image dragging. Pinch zoom stays available.
- Pause automatically on `visibilitychange`/`pagehide` (equivalent of `NOTIFICATION_APPLICATION_FOCUS_OUT`). Pause conceals artwork and freezes the clock.
- The audio context unlocks on the first user gesture. The sound preference persists.
- Reduced motion defaults to `prefers-reduced-motion`, then follows the saved preference.
- Leaving or restarting an unfinished round asks for confirmation. `beforeunload` warns during a round.
- Turn, score and hint changes are announced through an `aria-live` region.

## Custom decks

- Import via `<input type="file" multiple accept="image/png,image/jpeg,image/webp">` (works with the iOS/Android photo pickers), drag-and-drop, and an optional folder picker where supported (`webkitdirectory`).
- Same rules as Windows: 2–30 unique pictures, and a subset must be chosen if more are offered. Unreadable files are rejected with reasons. Exact duplicates are rejected using a SHA-256 hash of `"w,h:"` plus the decoded RGBA bytes (`createImageBitmap` → canvas → `crypto.subtle`).
- Pictures are normalised onto a white square, scaled to 90% fit without stretching or cropping, and stored as PNG blobs. Originals are never modified. *Decided in Phase 4:* 1024-pixel PNGs, matching the Windows edition so decks move between editions unchanged; Blobs (not byte arrays) so browsers keep pictures on disk instead of loading whole libraries into memory. Pictures over 16 megapixels are hashed at a fixed reduced size to stay within iOS Safari's canvas limit.
- Rename and delete (with confirmation) apply to custom decks only.
- **Backup / restore:** export all custom decks and preferences as one ZIP laid out like the Windows data folder, and restore it with "existing data wins" semantics like the v2 upgrade: existing decks are kept, and backed-up settings apply only while this device's settings are still the defaults. This replaces "copy `%APPDATA%\Memory Card Game\`".
- **Windows interoperability:** importing a Windows `custom_<24 hex>` folder (manifest plus PNGs) is accepted as-is after validation. Exported decks use the same manifest v1 layout, so they can be copied into the Windows data folder.

## PWA mechanics

- Web app manifest: name, short name, `start_url`/`scope` relative to the GitHub Pages subpath, `display: standalone`, theme/background colours from the palette, and icons generated from `assets/icon.svg` (192, 512, maskable 512, apple-touch 180).
- Service worker precaches the app shell and all built-in deck assets (189 files, about 1 MB), so the game is fully offline after the first visit. *Changed in Phase 3:* instead of `vite-plugin-pwa`/Workbox, a short hand-written worker (`web/build/service-worker.js`) and build plugin (`web/build/pwa.ts`) list every built file and version the cache by content. The app needs no runtime caching strategies, the "never during a round" update rule is custom either way, and this keeps Workbox's large build toolchain out of the project.
- Update flow: a new version installs in the background and waits. "A new version is ready — Update now / Later" appears only on setup or results; **never during a round**. "Later" keeps the current version for this visit; the new one starts the next time the app is opened.
- Hosting: GitHub Pages, deployed by a GitHub Actions workflow (build → unit tests → e2e → deploy). The repository owner must set *Settings → Pages → Source* to "GitHub Actions" once.

## Keeping the Windows build clean

- `web/.gdignore` so Godot does not import web sources or `node_modules`.
- Add `web/*` to `exclude_filter` in `export_presets.cfg`, and `web` to the excluded set in `tools/package.py`, so the compact Godot source ZIP stays unchanged.

## Guides

- `tools/build_guide.py` gains a web-edition variant. It replaces `%APPDATA%`, EXE/PCK, folder-dialog and OpenGL wording with browser storage, backup/restore, install-to-home-screen and photo-picker instructions. The artwork advice and reusable prompt stay shared.
- The guide is served as a precached page inside the PWA.

## Testing and verification

- **Unit (Vitest):** port `tests/test_runner.gd` rule checks. These cover session rules (matches, mismatches, extra-turn on/off, pause freezing clocks, final-pair timing, ties) and manifest validation (including traversal). Layouts are checked for every pair count 4–60 cards, both layouts, at several aspect ratios (320×568, 390×844 portrait/landscape, 768×1024, 1280×720, 1920×1080): no overlaps, gap respected, inside bounds, deterministic per seed. Also covered: duplicate hashing and normalisation geometry.
- **E2E (Playwright, Chromium):** full solo and multiplayer rounds with a `?seed=` test hook; pause conceals artwork; rotation/resize keeps positions; no scrollbars on the board at every test viewport for 2–30 pairs; offline reload works after first visit; import, rename, delete, backup and restore; update prompt is deferred during a round.
- **Verification record:** screenshots at phone, tablet and desktop sizes plus a report, in `verification/web/`, mirroring `verification/VERIFICATION.md`.

## Phases

1. ✅ Set up `web/` (Vite + TS, Vitest, Playwright, `.gdignore`, export/package exclusions). Port `session.ts` and `layout.ts` with tests.
2. ✅ Setup, gameplay and results screens with built-in decks; responsive layout; board fit and recommended-pairs logic; keyboard, touch, audio, pause.
3. ✅ PWA manifest, icons, service worker, offline, update prompt; GitHub Pages workflow. The installable game is playable at this point.
4. ✅ Deck library: import, IndexedDB storage, rename/delete, persistence request, backup/restore, Windows deck interoperability.
5. Web guide, accessibility pass, e2e suite, verification record, README and IMPLEMENTATION updates.

## Known limits

- Browsers may evict storage. Installed PWAs and granted persistence are much safer, but backup/restore remains the recommended safeguard.
- Seeded shuffles will not reproduce Godot's PCG32 sequences. Both editions are random per round, so this does not matter.
- Pictures carry no names, so revealed artwork is not described to screen-reader users (same as the Windows edition).
