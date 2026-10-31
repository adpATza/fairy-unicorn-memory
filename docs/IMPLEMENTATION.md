# Implementation notes

## Brief review

The supplied brief is preserved verbatim in `original-brief.md`. It supplies implementable rules, storage boundaries and acceptance criteria. No online service or artwork-conversion feature is needed. The official Windows download page and the installed engine both identify version 4.7.2; the project and export use that exact version with Compatibility.

The included artwork is original vector illustration, rather than external generated raster images. The editable 180 SVGs are organized into six 30-image collections and loaded as textures. All images have the same cream background, no text or identifying border, and large object features. Hard decks combine six large limb arrangements with five head/leg/expression variations. An adult's subjective readability review is still useful for the intended players; automated uniqueness alone cannot establish human difficulty.

## Responsibilities

| Component | Owns |
| --- | --- |
| `MemorySession` | Stable pair IDs, selections, score, turns, attempts, elapsed time, explicit FIRST → SECOND → RESOLVING → FIRST / FINISHED states |
| `MemoryLayout` | Deterministic geometry with a separate RNG seed stream; grid or randomized free-space subdivision; square collision-checked placements |
| `MemoryDeckLibrary` | Versioned manifests, discovery, validation, pixel hashing, normalization, safe copying, rename and custom-only deletion |
| `MemoryCard` / reusable card scene | Identical backs, artwork, focus, neutral hidden labels, brief flip feedback respecting reduced motion |
| Setup / Gameplay / Results / Library / Guide scenes | Screen-specific presentation and navigation |
| Main | Preferences, sounds, screen lifecycle and confirmation dialogs |

## Timing, pause and restarts

The session has no SceneTree timers, coroutines or animation callbacks. `_process(delta)` calls `tick(delta)`. A resolving match has a 0.65-second display; a mismatch has 1.5 seconds. A paused session neither accumulates elapsed time nor advances resolution. Presentation immediately conceals artwork and restores the underlying selections on resume. Losing application focus also pauses. Leaving or restarting disposes of the old screen/session; the only tweens belong to its card nodes and are killed on face updates or node disposal.

Match removal changes visibility only. No layout method runs during a round. Godot's fixed 1280 × 720 canvas and keep-aspect stretch uniformly scale and letterbox the canvas on resize. Sparse scattered boards use unstructured random placement with collision checks, bounded retries and progressively smaller cards. Dense boards use random free-space subdivision followed by collision-checked random walks to dissolve alignment while retaining readable squares. All this runs before the first card appears. It does not use a jittered grid or a grid fallback. Stored coordinates never change when a pair is removed.

## Manifest version 1

Each `manifest.json` contains `version`, `id`, `title`, `domain`, `style`, `complexity`, and `images`. Each image has a stable `pair_id` and a relative `path`. Only relative paths without traversal are accepted. The runtime adds resolved image/base paths in memory. Matching always compares pair IDs. Built-in discovery uses an explicit index so it works reliably inside an exported PCK.

Custom decks are stored under `user://decks/custom_<24 hex digits>/`. A scan decodes PNG/JPEG/WebP, converts to RGBA8, and hashes dimensions plus pixel bytes using SHA-256. At save, files are decoded and hashed again to catch source changes. Each selected image is copied to a 1024 × 1024 cream canvas using an aspect-preserving fit with safe margin. A staging directory receives images and an atomically written manifest before being renamed into the library. Save failures clean only app-created staging folders. Originals are read only. Custom deletion verifies the exact app-owned directory, removes flat files only, and never recursively follows directories or source paths.

Preferences use `user://preferences.cfg`; resuming unfinished rounds is intentionally outside the release. There are no network classes, analytics, APIs, account requirements or remote assets in gameplay. The only external opening action is an explicitly requested local HTML guide.

## Presentation choices

The brief's cream / plum / lavender palette is used directly: cream `#f8f3e9`, ink `#503957`, plum `#79558d`, muted ink `#817184`, lavender `#b7a0c8`, and pale lavender `#eee5f2`. Georgia titles and Segoe UI controls use Windows system fonts. The distinctive element is the illustrated deck sample and quiet botanical card back. Most game-screen space belongs to the board; the interface remains upright and still.
