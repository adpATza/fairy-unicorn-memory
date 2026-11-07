# Extra memory-card artwork

Eight additional collections, comprising **203 unique card illustrations**, plus original images, generation prompts, provenance records, labelled previews, thumbnail reviews and validation records. These are optional collections for the game's folder importer.

[Download the artwork ZIPs](https://github.com/adpATza/memory-card-game/releases/tag/artwork-2026-11-07)

| Collection | Unique cards | Import folder | Download |
| --- | ---: | --- | --- |
| Aircraft colour sketches | 30 | `aircraft-colour-sketches-v1/images/` | [Complete package](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/aircraft-colour-sketches-v1.zip) |
| Cars colour sketches | 30 | `cars-colour-sketches-v1/images/` | [Complete package](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/cars-colour-sketches-v1.zip) |
| Country flags colour sketches | 50 | `country-flags-colour-sketches-50-v1/decks/01-world-flags-a/` and `02-world-flags-b/` (25 each) | [Cards](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/country-flags-colour-sketches-50-v1-cards.zip) · [Complete package](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/country-flags-colour-sketches-50-v1-complete.zip) |
| Illustrated landmarks | 15 | `landmarks-illustrated-15-v1/cards/` | [Cards](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/landmarks-illustrated-15-v1-cards.zip) |
| Cartoon octopuses | 12 | `octopus-cartoon-12-v1/images/` | [Cards](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/octopus-cartoon-12-v1-cards.zip) |
| Hard cartoon pandas | 24 | `pandas-cartoon-hard-24/cards/` | [Cards](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/pandas-cartoon-hard-24-cards.zip) |
| Ships colour sketches | 30 | `ships-colour-sketches-v1/images/` | [Complete package](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/ships-colour-sketches-v1.zip) |
| Hard cartoon zebras | 12 | `zebras-cartoon-hard-12-v1/cards/` | [Cards](https://github.com/adpATza/memory-card-game/releases/download/artwork-2026-11-07/zebras-cartoon-hard-12-v1-cards.zip) |

The `aeroplanes/style-review-v1/` folder preserves the initial two-image style review. It is not an additional finished deck.

## Use in the game

Download and extract a ZIP, then open **Deck library → Import an image folder**. Select the listed image folder, review the thumbnails, enter the collection name and domain, and save the copied deck. A flat cards ZIP can be imported by selecting its extracted folder.

Each unique picture produces a matching pair. The game accepts 2–30 selected pictures per deck. The 50 flags are also arranged into two disjoint, ready-to-import sets of 25. Choose **Illustrated** for the style and select a complexity appropriate to the collection and intended players. Import only the individual cards, not contact sheets or other review images.

## Files and provenance

The Git repository contains the individual source/card PNGs and their supporting records. ZIPs are separate release assets to avoid duplicating large archives in Git history. `ARTWORK-SHA256SUMS.txt` in the artwork release verifies all nine downloadable ZIPs. The original source and package bytes are preserved; local generation-path references in metadata document their provenance and may refer to files outside a clone. The packaged artwork is self-contained for importing.

All 323 PNG files, including original versions and review sheets, decoded successfully before publication; they represent 270 distinct PNG byte hashes. All nine ZIP archives passed CRC checks. The eight import collections contain 203 final card images. Existing collection-specific review and verification records are retained. This publication check does not constitute in-game play testing of the additional collections or a human validation of difficulty.
