# Implementation notes

## Version 2 presentation

Memory Card Game 2.0 adopts a broad, playful theme: mixed everyday objects, animals, vehicles and robots. The original product brief remains in `original-brief.md` as historical requirements; the current README describes the replacement name, defaults and artwork. Godot 4.7.2 and the Compatibility renderer remain unchanged.

The six current decks contain 180 editable 512-square SVG illustrations with white backgrounds, navy outlines and large features. Easy decks use distinct subjects or colours. Medium robots share cyan but vary shapes and features. Hard robots share a blue character and differ through six arm arrangements combined with five leg/expression variations. Thumbnail review supplements decoded image uniqueness; subjective difficulty depends on the players.

The interface uses navy `#172c49`, electric blue `#245bff`, orange `#ff7637`, yellow `#ffc933`, teal `#00b89c`, white panels and a pale blue background. Bold system sans serif titles, a matching-card icon and identical blue card backs replace the original visual theme. Archived artwork under `artwork/` is ignored by Godot and omitted from the runtime export.

## Responsibilities

| Component | Owns |
| --- | --- |
| `MemorySession` | Pair IDs, selections, scores, turns, attempts, elapsed time and explicit selection/resolution states |
| `MemoryLayout` | Deterministic grid or scattered geometry, square collision-checked placements and a separate RNG seed stream |
| `MemoryDeckLibrary` | Manifests, discovery, validation, decoded-pixel hashing, normalization, copying, rename and custom-only deletion |
| `MemoryStorage` | Copy-only upgrade of previous custom decks and preferences into the renamed user-data folder |
| `MemoryCard` | Identical backs, front textures, keyboard focus and reduced-motion-aware feedback |
| `GameUI` | Shared colours, system fonts, controls and focus styles |
| Screen scenes | Setup, gameplay, results, library and guide presentation |
| Main | Window title, preferences, selected-deck validation, sounds, navigation and confirmation dialogs |

## Rules, pause and layout

The session advances through `_process(delta)` and `tick(delta)` without asynchronous timers. Matches display for 0.65 seconds; mismatches for 1.5 seconds. Pause freezes elapsed and resolution clocks, conceals artwork immediately, and restores the underlying selections on resume. Losing application focus also pauses. Screen/session replacement prevents stale final-pair transitions from replacing a restarted round.

Match removal changes visibility only. Layout runs before cards appear; stored coordinates never change during a round. A fixed 1280 × 720 canvas uniformly scales and letterboxes on resize. Sparse scattered boards use collision-checked random placement. Dense boards use random free-space subdivision and collision-checked random walks, without falling back to a grid.

## Manifests and storage

Manifest version 1 contains `version`, `id`, `title`, `domain`, `style`, `complexity`, and `images`, whose entries have stable `pair_id` and relative `path` values. Traversal is rejected. Runtime discovery uses an explicit built-in index so it works inside the exported PCK. Matching compares pair IDs.

Custom decks live under `user://decks/custom_<24 hex digits>/`. PNG/JPEG/WebP scans hash dimensions and decoded RGBA8 bytes. Save decodes and hashes again, fits each selected image onto a 1024-square white canvas with margins, and writes copied images and a manifest through a staging folder. Original files are read only. Deletion validates the exact app-owned custom folder and removes flat files without following nested directories.

`user://` now resolves to `%APPDATA%\Memory Card Game\`. At startup, `MemoryStorage` checks the legacy data directory, copies preferences only when absent, validates custom manifests and files, and stages each missing custom deck before renaming its new folder. Existing destination decks/settings win. A completion marker makes the upgrade repeat-safe; copy errors are reported and allow a later retry. The legacy directory constant is intentionally retained for compatibility. Legacy style tags remain readable and are presented as Realistic. A missing old starter selection falls back to Mix & Match.

Preferences are stored in `preferences.cfg`. Unfinished rounds are not persisted. Gameplay has no HTTP, WebSocket, analytics or remote assets. The only external opening action is the requested local HTML guide.

## Delivery

The export is `Memory Card Game.exe` with `Memory Card Game.pck`. Packaging builds and tests a copied executable away from the project, runs fresh-process persistence checks, and creates compact source and Windows ZIPs plus SHA-256 sums. Optional PNG collections and classic artwork remain in Git and their existing artwork release rather than being duplicated in the compact game source ZIP.

## Web edition

`web/` is a separate TypeScript implementation of the same game for browsers, installable as a progressive web app. It reads `assets/decks/`, `assets/card_back.svg` and `assets/icon.svg` directly, and `tools/build_guide.py` generates its guide from the shared text. The rules (`web/src/session.ts`) and placement (`web/src/layout.ts`) are ports of `MemorySession` and `MemoryLayout`; placement uses the board's own shape at round start so phones and tablets get a fitted board, and resizing scales without moving cards. Custom decks use manifest version 1 unchanged and are stored in IndexedDB; backups mirror this data folder's `decks/custom_*` layout, so decks move between editions. `web/.gdignore` keeps Godot from importing the folder, and the Windows export and source ZIP exclude `web/` and `verification/web/`. Details are in `web/README.md`, `docs/PWA-PLAN.md` and `verification/web/WEB-VERIFICATION.md`.
