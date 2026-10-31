# Fairy & Unicorn Memory — Godot game

## 1. Product and defaults

Build an offline Windows game in **Godot 4.7.2, using GDScript and the Compatibility renderer**, with the editable project included. This version is listed on the [official Godot download page](https://godotengine.org/download/windows/).

The first release will support:

- Solo play or 2–4 people sharing one screen.
- Any whole number from **2–30 pairs**.
- **Square cards with rounded corners**, identical backs, and no identifying marks while hidden.
- Scattered cards by default, with an optional grid.
- Fairies and unicorns, each with easy, medium, and hard illustrated decks.
- Adult-created decks imported from an image folder.

Defaults: 12 pairs, one player, easy illustrated fairies, scattered layout, and “another turn after a match” enabled. No online play, accounts, advertising, or in-game AI generation.

## 2. Playing the game

**Setup screen:** Choose player count and names, object domain, realism/style, complexity, pair count, layout, and the extra-turn rule. Show a small artwork sample before starting. Only offer combinations supported by installed decks.

**Game screen:** Give most of the window to the cards. Show the active player, each player’s score, and pairs remaining. Use a quiet storybook design: cream background, plum text, lavender card backs, and restrained decorative details.

Rules:

1. Randomly select the requested number of distinct images and create exactly two cards per image.
2. Shuffle card identities independently of their positions.
3. Allow two different unmatched cards to be revealed. Ignore repeated clicks on the same card and block further selections while resolving the pair.
4. A match earns one point. Briefly display both cards, then remove them, leaving their spaces empty.
5. A mismatch remains visible for 1.5 seconds, then both cards turn face down in their original positions.
6. With extra turns enabled, a match retains the player; a mismatch advances to the next player. With it disabled, every completed attempt advances the player.
7. Solo play continues with the same player and records attempts and elapsed time.
8. End after the last match. Show scores and winner or tied winners; for solo play, show completion time and attempts.

Provide replay with a fresh shuffle, return to setup, pause, sound toggle, and reduced-motion settings. Pause freezes timers and conceals revealed artwork. Leaving an unfinished game requires confirmation.

### Scattered layout

Use genuinely irregular, non-grid positions, keeping cards upright, fully visible, separated, and inside the playing area.

Generate positions once per round using randomized placement and collision checks. Use bounded retries and progressively smaller cards for dense boards. Validate all supported pair counts at the minimum supported window size of 1280 × 720.

Never move remaining cards after a match. Resizing uniformly scales and letterboxes the existing board instead of rearranging it. Grid mode follows the same fixed-position rule.

## 3. Artwork and adult imports

### Included artwork

Create **six decks of 30 unique images each: 180 images total**. Each image becomes an identical matching pair.

| Complexity | Fairies | Unicorns |
|---|---|---|
| Easy | Clearly different characters, silhouettes, clothing, and wing shapes | Clearly different coats, manes, silhouettes, and poses |
| Medium | Related characters sharing palettes, distinguished by several visible features | Similar-looking unicorns distinguished by markings, mane shapes, and poses |
| Hard | A consistent fairy character distinguished by expressions and body positions | A consistent unicorn distinguished by head angles, expressions, and leg positions |

Difficulty must come from object differences rather than tiny background clues. Hard cards must remain distinguishable at their actual playing size.

Treat **style and complexity independently**. Built-in decks are illustrated; imported decks can be tagged Illustrated, Realistic fantasy, or Other. Do not imply that the game can convert artwork between styles.

### Generation specification

Provide an adult guide inside the game and as an offline HTML document. Include a reusable prompt template:

> Create one square memory-card illustration of [subject], in [style], for a [complexity] deck. Its distinguishing features are [features]. Keep the subject large, fully visible, and within a 10% safe margin. Maintain the deck’s consistent framing, lighting, and background treatment. Include no text, numbers, card border, watermark, or unrelated objects.

The guide will include:

- Separate fairy and unicorn examples for all three complexity levels.
- A 30-image planning checklist to avoid accidental duplicates.
- Recommended 1024 × 1024 PNG files, one unique object image per file.
- Instructions to generate one image per pair, never two independently generated “matching” pictures.
- Thumbnail review guidance: ensure differences remain visible without relying exclusively on colour.
- An explanation that realistic fantasy means realistic rendering of imaginary subjects.

### Folder import

Adult selects a folder, enters deck name and domain, chooses style and complexity, reviews thumbnails, then saves.

Accept PNG, JPEG, and WebP images from the selected folder. Allow 2–30 selected unique images; larger folders require selecting a subset. Reject unreadable files and exact duplicate decoded images, with clear explanations.

Fit non-square images onto a consistent square background without stretching or silently cropping. Preview the result before saving.

Copy normalized images into the game’s local data directory; leave originals untouched. Imports remain available after restarting or moving the original folder. Provide rename and delete actions for custom decks, with confirmation before deletion.

## 4. Implementation structure

Separate the project into setup, gameplay, results, and deck-library screens, with a reusable card scene.

Keep these responsibilities independent:

- **Game session:** cards, selections, scores, turns, attempts, and completion.
- **Board layout:** grid/scattered positions and resize transformations.
- **Deck library:** built-in discovery, imports, validation, and local storage.
- **Presentation:** card flips, feedback, sound, focus, and menus.

Use an explicit state machine: awaiting first card → awaiting second card → resolving → next attempt or finished. Pause preserves the underlying state. Cancel outstanding animation/timer callbacks when restarting or leaving a round.

Use a versioned local deck manifest containing deck ID, title, domain, style, complexity, and image entries with stable pair IDs and relative image paths. Matching uses pair IDs, never filenames or image similarity.

Store imported decks and preferences under Godot’s writable `user://` location, as described in the [Godot storage documentation](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html). No external API is required.

Support mouse and keyboard selection with visible focus. Hidden-card labels must not expose object identities. Save preferences and custom decks; resuming unfinished rounds is outside this release.

## 5. Verification and delivery

Verify:

- Exactly two cards per selected image and total scores equal matched pairs.
- Correct turn changes under both rules, including solo play and four-player wraparound.
- Rapid clicks, double clicks, pause, restart, and final-pair resolution.
- Every pair count from 2–30 in both layouts across multiple random seeds.
- No overlap, clipping, position changes, or card movement after matches and resizing.
- Imports with corrupt files, duplicates, non-square images, Unicode paths, and missing source folders.
- All six starter decks contain 30 distinct, readable images and display correctly.
- Offline operation and import persistence in the exported Windows game.

Deliver the Windows executable package, editable Godot project, and adult artwork-generation/import guide. Verify the exported game separately from running it in the editor.
