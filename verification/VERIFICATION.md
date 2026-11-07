# Memory Card Game 2.0 verification — 7 November 2026

Built with **Godot 4.7.2.stable.official.ed1daf0bf**, GDScript, Windows x86_64 and Compatibility. The exported executable ran with **Intel UHD Graphics 630 / OpenGL 3.3**. Automated tests used isolated data folders and a copied release executable away from the project.

| Executed check | Result | Evidence |
| --- | --- | --- |
| Resource import, every game script parse and Windows release export | Pass | Local `import.log`, `parse-*.log`, `export.log` |
| Source suite | **2,063,502 checks, 0 failures** | `source-report.json` |
| Exported native Windows suite | **2,063,564 checks, 0 failures** | `exported-report.json` |
| Fresh-process persistence, source | **9 checks, 0 failures** | `source-persistence-report.json` |
| Fresh-process persistence, release executable | **10 checks, 0 failures** | `exported-persistence-report.json` |
| New artwork thumbnail review | Six sheets visually inspected | `artwork/` |
| Rendered screen review | Setup, library, imports, guide, boards, pause and results inspected | `screenshots/` |
| Native Windows check | Exact title, keyboard start/reveal, pause concealment and resume restoration confirmed | Interactive release executable |

The large assertion counts mainly come from checking every rectangle pair for overlap. Meaningful coverage in each full suite is **2,900 generated boards** and **232 complete game rounds**.

## Coverage

- Project name and actual game window title are Memory Card Game; the release process is named `Memory Card Game.exe`.
- All six current decks contain 30 square illustrations. All **180 decoded images have distinct SHA-256 hashes**. The active domains are mixed objects, animals, vehicles and robots. All load from the exported PCK.
- All pair counts 2–30, both layouts and 50 seeds per combination produce contained, separated, upright squares. The smallest scattered cards in these cases are **72.60 logical pixels**. Removing a pair and resizing the native window preserve stored card positions.
- Stable pair IDs, exactly two copies per picture, scores, attempts, elapsed time, 1–4 players, both extra-turn rules, turn wraparound, tied winners, mismatch delay, repeated/rapid clicks, pause and restart races are checked.
- Custom imports cover PNG/JPEG/WebP, Unicode paths, corrupt files, decoded duplicates, selecting a subset from 31 pictures, aspect-preserving normalization onto white squares, atomic save, rename, custom-only deletion and missing original folders.
- Upgrade fixtures copy previous custom decks and preferences into the renamed data folder. Manifest and image hashes are unchanged; original files survive. Repeat migration copies nothing, existing new decks/settings win, and previous style tags remain readable.
- A fresh OS process reloads the copied custom images, renamed deck and sound/reduced-motion preferences, then deletes only the test custom deck.
- Source and release screen integration cover setup, library, guide, import selection, a 60-card board, pause concealment, match removal, restart and result transitions. The release suite also resizes the window to 1600 × 1000 and checks fixed-aspect scaling.

## Evidence and limits

The contact sheets and screenshots in this folder are from the new version. Classic review sheets were moved beside the preserved historical artwork under `artwork/classic-starter-decks/review/`. Runtime scripts and the game resources use the new branding; the old data-directory constant remains intentionally for migration. Historical artwork and the original brief retain their provenance.

The corrupt PNG fixture intentionally emits decoder errors between `EXPECTED_IMPORT_ERROR_BEGIN` and `EXPECTED_IMPORT_ERROR_END`. The packager rejects unexpected errors elsewhere. Raw logs and disposable runtime folders remain local and are excluded from Git and the source ZIP.

These results verify this Windows machine and the separate release executable. They do not establish compatibility with every PC or subjective difficulty for every player. The optional raster artwork collections retain their separate review records and are not part of the active starter-deck play tests.
