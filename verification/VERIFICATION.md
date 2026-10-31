# Verification — 31 October 2026

The release was built with **Godot 4.7.2.stable.official.ed1daf0bf**, GDScript, Windows x86_64, and the Compatibility renderer. The exported EXE ran on **Intel UHD Graphics 630 / OpenGL 3.3**. It was copied to a separate portable test folder and tested independently of the editor project.

| Executed check | Result | Evidence |
| --- | --- | --- |
| Parse every game GDScript; import all resources; Windows release export | Pass, no script/export errors | `parse-*.log`, `import.log`, `export.log` |
| Source suite | **2,063,483 checks, 0 failures** | `source-report.json`, `source-tests.log` |
| Exported native Windows suite | **2,063,544 checks, 0 failures** | `exported-report.json`, `exported-tests.log` |
| Fresh-process persistence, source | **8 checks, 0 failures** | `source-persistence-report.json` |
| Fresh-process persistence, exported EXE | **8 checks, 0 failures** | `exported-persistence-report.json` |

The high assertion counts mostly come from checking every pair of rectangles for collision. The meaningful coverage is **2,900 generated boards** and **232 complete game rounds** in each full suite.

## Coverage

- Every pair count **2–30**, both layouts, **50 random seeds per combination**, at the 1280 × 720 base canvas. Every board has the requested number of square, upright, fully contained, separated cards. The smallest scattered cards in these cases were **72.60 pixels**. Dense boards preserve readability rather than shrinking without limit.
- Exactly two cards per selected stable pair ID, distinct-image selection, score totals, 1–4 players, both extra-turn rules, mismatch advancement and four-player wraparound, solo attempts, elapsed time, and all tied winners.
- Repeated selection, rapid third clicks, invalid indices, 1.5-second mismatch exposure, brief match exposure, final resolution, paused clocks and hidden artwork, fresh starts, and stopped completion clocks.
- Screen integration for setup, library, guide, imports, gameplay and results. A 60-card board loses only matched cards without changing any stored positions. An actual native resize to 1600 × 1000 keeps the same logical positions and fixed-aspect canvas.
- A restart in the **same frame as the final match**, before the queued result transition, retains the new round. The old screen cannot deliver stale results.
- All **six included decks have 30 images**, and all **180 decoded illustrations have distinct SHA-256 hashes**. All are square and load in the exported PCK. Six 100-pixel contact sheets were inspected visually, alongside setup, dense board, default scattered board, pause, guide, import, solo results, and tied results screenshots.
- Import acceptance for PNG, JPEG and WebP; Unicode paths; rejection of corrupt PNG and exact decoded duplicates across PNG/WebP; validation again at save; 1024-square normalization with preserved aspect ratio; original pixels left untouched; empty names and invalid selection counts rejected; 31-image folders require selecting a subset.
- Saved decks rediscover after their source folder is moved and then removed. A second OS process loads the copied images and renamed manifest, checks saved sound/reduced-motion preferences, and deletes only the test custom deck. Built-in deletion and an external-destination deletion attempt are refused by the library.
- Native mouse/keyboard checks on the exported EXE: launch, library navigation, native directory picker display, Enter to start, Space to reveal, arrow navigation with visible focus, double click on the same card, Escape pause, concealment, confirmation before leaving, cancellation preserving the round, and restoration of the original revealed card on resume.
- The running native process had no TCP connections in the inspected snapshot. Runtime scripts contain no HTTP/WebSocket/network services or remote-asset loading. All artwork and guide resources are packaged locally.

## Evidence and limits

`screenshots/` contains images captured from the exported game's rendered viewport. The desktop native window and its confirmation dialog were also inspected with Windows computer use. Viewport screenshots show the game canvas; the surrounding OS window and letterbox bars can be outside that capture.

The intentionally corrupt image fixture produces image-decoder warnings/errors between `EXPECTED_IMPORT_ERROR_BEGIN` and `EXPECTED_IMPORT_ERROR_END`. These are expected rejection diagnostics. The packager fails on unexpected errors or script errors elsewhere.

This is verification on this Windows machine, including a separate release executable and fresh data directories. It is not a second-PC hardware test or a human difficulty/playability study. An adult should review the hard cards with the intended players; unique pixels alone do not prove subjective difficulty. The native directory picker was displayed during manual inspection; successful import/save/reload and thumbnail selection were tested through the exported game's actual library and screen code in the automated suite.

The four report files, artwork contact sheets and screenshots are versioned. Raw machine-specific logs remain local and are excluded from the public repository and source archive; the packager recreates them when run. Current local release logs are `*-tests.log`, `*-persistence.log` and `export.log`. Earlier logs with names such as `source-tests2.log`, `source-final.log`, and `import-final.log` document development passes and are not release results. Temporary test installations and data are also excluded.
