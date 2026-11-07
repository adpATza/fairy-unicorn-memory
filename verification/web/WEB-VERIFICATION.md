# Memory Card Game web edition verification — 7 November 2026

The progressive web app in [`web/`](../../web/README.md), built with **Vite 8.3.4** and **TypeScript 6.0.3** on **Node.js 22.23.4**, tested with **Vitest 5.0.5** and **Playwright 1.63.0** driving **Chromium 153.0.8010.12** (headless, Linux). The browser tests run against the production build served by `vite preview`, with the service worker active.

| Executed check | Result | Evidence |
| --- | --- | --- |
| Type check (`tsc`, strict) | Pass | `npm run typecheck` |
| Unit tests | **106 tests in 8 files, 0 failures** | `npm test` (`web/test/`) |
| Production build | Pass: 190 files precached (app, 180 deck pictures, guide, icons, manifest) | `npm run build` |
| Browser tests | **131 tests, 0 failures** | `npm run e2e` (`web/e2e/`) |
| Accessibility (axe-core 4.14.0) | **0 violations** of WCAG 2.2 A/AA and best-practice rules on every screen and dialog, at phone and desktop sizes | `web/e2e/a11y.spec.ts` |
| Guide generation | Windows guide outputs unchanged byte for byte; web guide up to date | `python tools/build_guide.py --check` |
| Rendered screen review | 18 screenshots inspected | `screenshots/` (`npm run screenshots`) |

## Coverage

- **Rules:** the Godot suite's **232 complete rounds** are ported (1–4 players, both extra-turn rules, every pair count 2–30, four mismatches each), with the 0.65-second match and 1.5-second mismatch timings, rapid and repeated clicks, pause freezing both clocks, the final-pair clock stop, restart and tied winners.
- **Layout:** **6,548 generated boards**: the Godot reference board (2–30 pairs, both layouts, 50 seeds), seven board shapes from phones to desktops (8 seeds each) and 400 random board shapes, including extreme aspect ratios. Every board is contained, square, separated by its gap and irregular when scattered. Uniform resize scaling never changes stored positions. The pair recommendation keeps cards at least 56 CSS pixels and is the largest count that does.
- **No scrolling:** at seven viewports (320 × 568 to 1920 × 1080), for 1 and 4 players, both layouts and 2, 12 and 30 pairs, with two cards revealed, every card and control is inside the viewport with no document scrolling and no overlaps (**84 board checks**). Rotating a 60-card board scales it uniformly and moves no card.
- **Play:** complete solo and multiplayer rounds are played the way a person would, by revealing cards and remembering them, with Playwright's fake clock. Covered: results and Play again, turn order under both extra-turn rules, the visible 1.5-second mismatch, pause concealment and clock freeze, auto-pause when hidden, leave and restart confirmations, the Back button, keyboard play (Enter, arrows, Space), neutral card labels and sound.
- **Decks:** the six built-in decks load in library order with 180 distinct pictures. Manifest validation rejects wrong versions, blank fields, unknown tags, 1 or 31 images, duplicate IDs or paths, traversal, absolute paths, drive letters and backslashes.
- **Custom decks:** imports accept PNG, JPEG and WebP from the picker, a folder or drag and drop; reject corrupt files and decoded duplicates (including re-encoded copies) with reasons; require a manual subset from 31 pictures; and fit a 220 × 80 picture onto a white 1024-pixel square at 90% without cropping. Saved decks play online and offline, survive reloads, and can be renamed and deleted; included decks cannot. Storage saves atomically and never overwrites an existing deck.
- **Backups and Windows decks:** backups round-trip, restore on a second device (adding decks and default-only settings), and keep existing decks on a repeat restore. ZIPs written by other tools (deflate) are read; damaged archives are rejected. A Windows-format `decks` folder is added and played.
- **PWA:** the manifest and icons are served with the stated sizes, and a unit test flags icons older than `assets/icon.svg`. The maskable icon was reviewed by eye to keep the artwork inside the safe zone. After one visit, the app, other decks' pictures, custom decks and the guide work offline, including on a GitHub Pages-like server. A new release is never offered during a round; *Update now* switches to it and *Later* keeps the current version. The Install button appears only when the browser offers installation.
- **Accessibility:** besides the axe scans, each screen has its own window title, focus moves to the new screen's heading after a tap, the phone game screen keeps a heading for screen readers, and setup, guide, library, import and results reflow at 320 pixels with no sideways scrolling.

## Screenshots

`screenshots/` holds setup, deck library, import review and guide at laptop (1280 × 720) and phone (390 × 844) sizes; boards at laptop, 1080p desktop, tablet portrait, phone portrait, phone landscape and small phone (320 × 568, 30 pairs in a grid); revealed cards, pause and solo results on a phone; and multiplayer results on desktop. They are regenerated with `npm run screenshots` and excluded from the Godot source ZIP.

## Limits

These results come from Chromium on Linux. **Safari (iOS, iPadOS and macOS) and Firefox were not run**; WebKit browsers are not installed in this environment. Real-device behaviour still to confirm by hand: installing to the home screen, the iOS and Android photo pickers (including HEIC conversion), storage quotas and eviction, audio after the first tap, and safe-area insets. The GitHub Actions workflow has not yet run on GitHub, and the site has not yet been deployed to GitHub Pages. Automated checks do not establish subjective difficulty or how comfortable small cards are for every player.
