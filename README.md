# Fairy & Unicorn Memory

An offline storybook memory game for Windows, built with **Godot 4.7.2 / GDScript / Compatibility**.

[Download the Windows game](https://github.com/adpATza/fairy-unicorn-memory/releases/latest/download/Fairy-Unicorn-Memory-Windows-x64.zip) · [All releases and editable source](https://github.com/adpATza/fairy-unicorn-memory/releases)

![The game's storybook setup screen](verification/screenshots/setup.png)

## Play

Download the Windows ZIP from Releases, extract it into a folder, and launch `Fairy and Unicorn Memory.exe`. Keep the EXE and PCK together. A locally built package is also available under `dist/Fairy and Unicorn Memory/`. No editor, Python, installer, administrator rights, account, or internet connection is required to play.

Minimum: Windows 64-bit, 1280 × 720 desktop, graphics supporting OpenGL 3.3. Tested on Intel UHD Graphics 630. System typefaces use Windows' Georgia and Segoe UI; no font files are redistributed.

Choose 1–4 players, 2–30 pairs, fairies or unicorns, Easy / Medium / Hard, and scattered or grid layout. Defaults are one player, 12 easy fairy pairs, scattered, and another turn after a match. Every hidden card has the same back.

- Click two cards; a match earns one point and removes the pair.
- A mismatch stays visible for 1.5 seconds. Cards retain their exact positions.
- Tab / Shift+Tab focuses controls; Space or Enter selects; arrow keys navigate cards.
- Escape pauses. Pause conceals artwork and freezes both elapsed and resolution clocks.
- Sound and reduced motion can be changed in game. Leaving or restarting asks for confirmation.
- Resize uniformly scales and letterboxes the original board.

## Your own decks

Use **Deck library → Import an image folder**. Review normalized square previews, select 2–30 unique PNG / JPEG / WebP images, enter a name and subject domain, and tag the existing style and complexity. Exact decoded duplicates and unreadable files are rejected. Larger folders require choosing a subset.

Pictures are fitted onto cream squares without stretching or cropping, then copied locally. Originals remain untouched. Saved decks continue to work if the source folder moves. Rename and confirmed deletion are available for custom decks.

Data and preferences: `%APPDATA%\Fairy and Unicorn Memory\`. Back up this folder with the game closed. Unfinished rounds are not saved.

Read **docs/Artwork and Import Guide.html**, also available from the game's Adult guide screen. It contains a reusable generation prompt, six difficulty examples, a 30-image planning checklist and import instructions.

Additional artwork is available in [artwork/](artwork/README.md): 203 card illustrations covering aircraft, cars, country flags, landmarks, octopuses, pandas, ships and zebras. [Download the artwork packages](https://github.com/adpATza/fairy-unicorn-memory/releases/tag/artwork-2026-11-07), then import the individual card folders through the deck library.

## Edit

Open `project.godot` in Godot **4.7.2 standard**. The project uses the Compatibility renderer and has no external runtime dependencies or add-ons.

The six included collections contain **180 original editable SVG illustrations**. Regenerate them with `python tools/generate_art.py`. The individual feature plan is in `docs/artwork-plan.csv`. Rebuild the in-game and HTML guide with `python tools/build_guide.py`.

## Test and package

Install Godot 4.7.2 and its matching Windows export templates. Then:

```powershell
python tools/package.py --godot "C:\path\Godot_v4.7.2-stable_win64_console.exe"
```

The packager imports the project, checks every GDScript, runs the source suite in an isolated user-data folder, exports Windows, runs the same suite against the exported EXE in a separate data folder, checks persistence in a fresh process, and writes Windows and editable-source ZIPs with SHA-256 hashes. Development requires Python 3; playing does not.

Manual commands, with APPDATA redirected to a disposable test location to avoid altering your decks/settings:

```powershell
$env:APPDATA = "$PWD\verification\runtime\manual"
& "C:\path\Godot_v4.7.2-stable_win64_console.exe" --headless --path . -- --self-test
& "C:\path\Godot_v4.7.2-stable_win64_console.exe" --headless --path . -- --persistence-check
```

See `docs/IMPLEMENTATION.md` and `verification/VERIFICATION.md` for architecture and executed validation. Code and original artwork are MIT licensed. Godot and bundled third-party notices are in `docs/` and the Windows package.
