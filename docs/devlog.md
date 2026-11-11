# Devlog

- **2026-11-09** — M0 foundations: pnpm monorepo (`apps/web`, `packages/core|runtime|react`),
  strict TS, ESLint + Prettier, Vitest, GitHub Actions CI. `core` has the v1 data model,
  `SCHEMA_VERSION`, `validateAnimation()` and segment ↔ `d` serialization with 30 tests.
  Placeholder page with the two-tone wordmark and a draw-on check. Cloudflare hosting and domain deferred until the app is functional (owner decision).
- **2026-11-09** — Brand: name rule (IconTween in text, lowercase icontween in the logo) and
  vermilion accent replacing the violet placeholder. See decision 002.
- **2026-11-09** — M1 part 1: prepare pipeline in `core` (parse, sanitize, styles, shapes →
  paths, transforms flattened, arcs/quadratics/shorthands → M/L/C/Z, rounding, state A,
  cleanup report with `describeReport()`). Own geometry instead of svgpath (decision 003).
  14 SVG fixtures, 88 tests total. Next: paste/upload UI with overlay comparison and the 12
  Lucide starter icons.
- **2026-11-09** — M1 part 2: `/prepare` screen. Pick a starter, add SVG files, drop or paste
  code; see original vs prepared (overlay, difference, side by side) on a viewBox grid, at
  16/24/48px, with the cleanup report, element list and prepared SVG code. Core gained
  `sanitizeSvg()` and `iconToSvg()`. 18 exact Lucide 1.70.0 sources in `examples/source`, all
  preparing cleanly (tested) and matching within half a pixel at 20× (measured in the
  browser). 115 tests. M1 done pending the owner's visual check. Decision 004.
- **2026-11-09** — M2 part 1: runtime v0 in `packages/runtime`. `createPlayer(svg, animation)`
  blends every number between states (segments, transform, opacity, draw) with cubic-bezier
  easing and tokens; `play`/`reverse`/`toggle`/`stop`/`setState`; interruptible from the
  current values, with the return leg taking the time already spent. Per-element delays and
  stagger (mirrored on reverse), reduced motion (instant/fade/none, OS setting or forced),
  triggers hover (+ focus), click, toggle, manual. Own `d` writer, tested identical to core's.
  3.1 KB min+gzip (`pnpm --filter @icontween/runtime size`). 45 runtime tests. `/runtime`
  playground with hand-built filter-sliders and menu → close demos. Decision 005. Next: M2
  part 2, the editor (clone A → B, drag nodes and handles, onion skin) on this runtime.
- **2026-11-09** — M2 part 2: `/editor`. Pick an icon (starters, files, paste, drop), clone A
  → B, select an element and drag its anchors and handles (handles follow anchors, closed
  shapes stay closed, 0.5 snap with Alt to skip, arrow nudges, exact X/Y). Onion skin of the
  previous state, transition duration/easing, trigger, and a live preview on the shipping
  runtime. Pure edit functions in core (125 core tests), Zustand store, shared icon library
  component. Decision 006. M2 done pending the owner's filter-morph test by hand.
- **2026-11-09** — M3 part 1: runtime playback completed. Closed-form springs (under-,
  critically and over-damped) that set their own duration and keep it when interrupted;
  `spring-gentle|snappy|bouncy` tokens. Sequences repeat (`loop` rests on the last state then
  jumps, `ping-pong` rests at both ends), `reverse()` always stops at the start, missed cycles
  are skipped, reduced motion never loops. Triggers `loop` (plays while on screen, pauses off
  screen) and `appear` (once, first time on screen) via `IntersectionObserver`. Opacity/draw
  clamped against overshoot. Editor inspector and `/runtime` playground expose springs,
  loop/appear and repeat + rest. 67 runtime tests, 3.89 KB min+gzip. Decision 007. Next: M3
  part 2, element transforms with pivot, opacity and draw in the editor.
- **2026-11-10** — M3 part 2: element transforms, pivot, opacity and draw in the editor.
  Core edits `setElementValues`, `setPivot` (one pivot per element, all states),
  `resetElementValues`, `pivotPresets` (3 × 3 box grid) and `paintAttributes` (draw/opacity
  attributes, tested identical to the runtime's and used by `iconToSvg`). Canvas: drag an
  element to move it, drag the pivot cross (grabbed by its ring, so a point under it stays
  reachable), arrow keys nudge the element, dashed outline for faded or undrawn elements,
  opacity and draw painted live. Inspector: move, rotate, scale, pivot, opacity and draw
  sliders, reset. 133 core + 68 runtime tests, runtime unchanged at 3.89 KB. Decision 008.
  Next: M3 part 3 (sequences and pattern templates, per-element delay/stagger).
- **2026-11-10** — M3 part 3: sequences and pattern templates, per-element delay/stagger.
  Core `sequence.ts`: `setSequencePath()` (rebuilds steps from a path of state ids, keeping
  timing that still applies), `patternTemplates()` (Hold, Return, Return ×2, Back and forth),
  `matchPattern`, `applyPattern`, `setStepTiming`, `setElementDelay`, `elementOffsets`; new
  states follow the pattern (A→B→A + C → A→B→C→A); validation now requires one chain from A.
  Editor: sequence strip with selectable steps, + / − step and pattern buttons; steps selected
  by index (fixes editing B→A); onion skin from the step's source; step panel with "Goes
  to", stagger and per-element delay rows with timing bars. 147 core + 68 runtime tests,
  runtime unchanged. Decision 009. Next: M3 part 4 (purpose picker with defaults, motion
  tokens, reduced-motion setting).
- **2026-11-10** — M3 part 4: purpose picker with defaults, motion tokens, reduced-motion
  setting. Core `defaults.ts` (`PURPOSE_DEFAULTS`: trigger, timing, pattern, reduced motion
  per purpose), `purpose.ts` (`setPurpose` keeps overrides and moves defaults,
  `purposeOverrides`, `applyPurposeDefaults`) and `tokens.ts` (`setDurationToken`,
  `setEasingToken`, clamped). New animations, first states and new steps follow the purpose
  (Feedback: cloning A gives A→B→A). Editor: Purpose section with its defaults and what's
  changed, "· default" marks in option lists, reduced-motion select, preview switch System /
  Reduced / Full, editable Motion tokens panel (durations, curves with a glyph, springs with
  settle time). 162 core + 68 runtime tests, runtime unchanged at 3.89 KB. Decision 010.
  Next: M3 part 5 (preview panel options: sizes, stroke widths, light/dark), then undo/redo.
- **2026-11-10** — M3 part 5: preview panel options. Stroke width (Icon as designed, 1, 1.5,
  2, 2.5 on a 24 grid, applied with CSS like a host page would, disabled for fill-only
  icons) and Light / Dark tile background (fixed colours, starts on the app theme), size
  labels under 48 / 24 / 16, options stacked label-above-control to fit the inspector. Both
  are editor-only settings; runtime and schema unchanged. 162 core + 68 runtime tests.
  Decision 011. Next: undo/redo, then check the 12 starters can be built (M3 done).
- **2026-11-10** — M3 part 6: undo/redo. Core `history.ts` (`recordEdit`, `undo`, `redo`,
  generic snapshot stack; same-key edits within 1 s merge, 200 steps kept). Editor: every
  animation or token change goes through `commit`; snapshots keep animation, tokens and the
  selection (state, step, element), restored on undo. Drags, sliders, nudges and typed
  numbers are one step each. ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y), Undo and Redo in the header; text
  fields keep native undo. History clears when another icon opens. 169 core + 68 runtime
  tests, runtime unchanged. Decision 012. Next: check the 12 starters can be built (M3 done).
- **2026-11-10** — M3 part 7: starter check, **M3 done.** `core/test/starter-builds.test.ts`
  builds all 12 starters (brief §12) with only the operations the editor's controls call
  (point moves one at a time, transforms, pivot, opacity, draw, states, path, timing,
  delays, trigger, repeat). Each pair's states are checked against the Lucide icons
  (within 0.5 units; the wrong state is 2.5–12 off). No Prepare-step structure tools needed:
  prepare the icon with more parts (pause, eye-off) and reshape state A too. menu → x also
  built by hand in the running editor. 197 core + 68 runtime tests. Decision 013.
  Next: M4 (persistence, export, sharing).
- **2026-11-10** — M4 part 1: auto-save and project files. Core `project.ts`:
  `serializeProject` (readable JSON), `parseProject` / `readProject` / `readAnimation`,
  which rebuild saved data from known fields, keep ids plain, reject remote paint, refuse
  newer schemas and run `validateAnimation()`. Editor keeps every edited animation
  (`saved`, by icon id); opening an icon reopens its work, "Start over" drops it, edited
  icons get a dot. IndexedDB auto-save (no dependency) of the project, your icons and the
  open icon; save status in the header. Import (replaces, after asking) and Export
  `.icontween.json`. Checked in the browser: reload keeps work, damaged file refused,
  export → import round trip. 210 core + 68 runtime tests. Decision 014.
  Next: share links in the URL hash.
- **2026-11-10** — M4 part 2: share links. Core `share.ts`: `encodeShare` / `decodeShare`
  (JSON → deflate-raw via `CompressionStream` → base64url in `#a=…`, no dependency; unpacking
  capped at 2 MB) and `readSharedAnimation` with the same checks as Import. A link carries
  the animation, the token values it uses, and the SVG for non-starter icons. Editor:
  "Share link" next to the title (dialog with Copy link and the link's length, warning over
  8,000 characters); opening a link adds the animation, asks before replacing a different
  one or retiming other animations, and swaps the hash for `#<icon id>`. Starter links are
  600–1,250 characters. Checked in the browser: copy, own link opens without asking,
  replace asks (Cancel keeps yours), cut-off link refused, fresh load and pasted link.
  234 core + 68 runtime tests. Decision 015.
  Next: exports (SVG + SMIL, SVG + runtime, React, JSON).
- **2026-11-10** — M4 part 3: exports. Core `export/`: `exportHtml` (inline SVG in state A +
  the runtime inline + start call; opens from disk), `exportReact` (typed `forwardRef`
  component importing `./icontween`, ref handle, `listenOn`), `exportJson`, tokens resolved
  to values, readable `printData`, `measureExport`. Runtime `scripts/bundle.js` builds the
  shipped runtime (unminified, licence banner; `iife` for HTML, `es` as icontween.js) from
  the preview's source, served to the editor as `virtual:icontween-runtime`; hand-written
  `icontween.d.ts` guarded by a type test. "Export code" dialog: format switch, code,
  size + gzipped, Copy, Download, Download runtime, and the HTML export running in an
  iframe. Checked: exported page plays in the dialog; React exports pass the strict Vite
  template typecheck, build, and play (copy, menu toggle, bell from its ref); jsdom test
  plays an exported page incl. reduced motion. 297 core + 73 runtime tests. Decision 016.
  Next: SVG + SMIL export, then the cross-browser check.
- **2026-11-10** — M4 part 4: SVG + SMIL export, no JavaScript. Core `export/svg.ts`:
  `exportSvg` rebuilds the runtime's timeline as keyframes (one `<animate>` per value per
  pass; keySplines for curves, adaptive samples for springs and overshoot; loop/ping-pong
  as one repeating cycle; a timer per direction), plus a reduced-motion copy behind a
  `prefers-reduced-motion` media query. All six triggers inline; loop and appear also as
  `<img>`. Core keeps a copy of the easing math (`export/easing.ts`), tested equal to the
  runtime's. Starter builds moved to `core/test/starters.ts` so the runtime can test
  against them: `runtime/test/smil.test.ts` evaluates the exported SMIL and compares it
  with the player at sample times (12 starters, full and reduced motion, both directions,
  plus spring/overshoot/ping-pong/draw variants). Export dialog: "SVG (no JS)" with a
  which-triggers table and the file playing inline and as `<img>`, plus Replay. Found in
  the browser: Chrome reads `-` in `begin="id.event"` as an offset, so ids are camelCase.
  Checked in the preview (Chrome): click, toggle, hover inline; loop and appear as
  `<img>`; reduced copy. 310 core + 112 runtime tests. Decision 017.
  Next: cross-browser check of every export (Safari, Chrome, Firefox).
- **2026-11-10** — M4 part 5: cross-browser export check. `pnpm export-check` writes every
  starter as SVG + SMIL, HTML + runtime, JSON and React into a gitignored folder, builds
  the React components in a fresh Vite `react-ts` app (strict tsc + vite build, installed
  from the pnpm store outside the workspace), and serves a self-checking page on :5180.
  The page compares each export with the runtime on a fake clock as the browser renders
  them: SMIL seeked to 61 times per run (full/reduced, forwards/back, triggers fired as
  events, media query), HTML and React played for real in a visible frame (moves, then
  rests where the runtime rests; loops keep moving; React's reduce prop). Gallery shows
  inline and `<img>` copies by eye. Checked in Chrome: all 84 checks pass; a changed curve
  or moved point fails. Owner ran it in Safari 26.5 and Firefox 159: all 84 pass in both.
  Decision 018. M4 done.
  Next: M5 (showcase and launch).
- **2026-11-10** — M5 part 1: landing page. The 12 starters now ship as
  `examples/starters.icontween.json` (seeded once from the recipes; from now on the file is
  the source of truth, tuned in the editor and exported over it). The landing page has the
  tagline, four principles and the starters grouped by purpose, playing live with the
  shipping runtime. Each card has "Open in editor", a share link that goes through the
  usual checks. Reduced motion gets a note. Checked in the preview: toggle morphs, links
  open the editor (with the replace question when you already have one), mobile and dark
  mode. The hero wordmark tweens in: "icontwn", then the two e's open up as the
  in-betweens. Each starter is a card with an Edit button. The hero line and a
  "Make your own" section say it's for your own icons. Decision 019.
  Next: library polish (multi-file drop, thumbnails, unsupported-SVG messages).
- **2026-11-10** — M5 part 2: library import and the editor's welcome. Dropping, picking or
  pasting any number of SVGs checks each one the way the editor opens it, adds the ones that
  work and lists every file in an import report: added, added with things to know, or not
  added and why. Unsupported features are found anywhere in the tree (also inside `<defs>`)
  and explained in plain words with what to do: text, masks, gradients, symbols, images,
  style blocks and so on. Library thumbnails show the prepared clone with a "!" when there
  are notes. With nothing to reopen, the editor now opens on a welcome ("Animate your own
  icon", Choose SVG files, the three steps, starter tiles) instead of a starter. Your icons
  can be renamed and deleted from the list, and the library sections fold (starters fold
  away once you have your own). File buttons got the pointer cursor. The selected row lost its side bar, and selects
  got an inset chevron. Checked in
  the preview: a five-file drop (2 added, 3 refused with reasons), a failed paste, the
  prepare report, the welcome and opening a starter from it, rename and delete, light and
  dark.
  330 core + 112 runtime tests. Decision 020.
  Next: README with GIFs, then the accessibility pass.
- **2026-11-10** — M5 part 3: README. Rewritten for launch: what IconTween is (the landing
  page's words), the three steps, the four export formats with React and runtime examples
  checked against real exports, contributor quick start, an architecture overview (the
  same-structure rule, the prepare pipeline, preview = export, no backend) linking the
  decision notes, and the licences. GIFs and the live link are commented-out placeholders;
  `docs/media/README.md` is the shot list for the four GIFs.
  Next: record the GIFs and add the live link, then the accessibility pass.
- **2026-11-10** — M5 part 3, follow-up: the README gets a moving hero and badges. The hero is
  `docs/media/hero.svg`, the twelve starters in a row of tiles made with IconTween's own SVG +
  SMIL export, switched to looping so they play as an `<img>` on GitHub (`pnpm readme-hero`).
  Badges: CI, MIT, runtime 4 KB gzipped, no backend. A live-site badge waits for the URL.
  The hero GIF left the shot list; three GIFs remain.
- **2026-11-10** — M5 part 4: accessibility pass on the app UI (WCAG 2.1 AA, light and dark).
  The canvas has a keyboard path: Tab to it, then `[` / `]` for points, Shift for elements,
  arrows to nudge, Esc to step back, with the same ‹ › stepper in the Inspector. Arrow keys
  no longer move the selected element while a button elsewhere has focus. Focus stays put
  after rename, delete, a welcome pick and Start over. The editor has a skip link. Imports,
  save problems and toggle tiles are announced. Contrast fixes: filled buttons, grey text on
  grey fills, and field borders. There's one vermilion focus ring, and pointer cursors are
  consistent (disabled controls no longer look clickable). `apps/web` has tests now (19).
  Decision 021.
  Next: record the GIFs, add the live link, and a VoiceOver pass by the owner.
- **2026-11-10** — M5 part 5: ready to deploy. Hosting was never set up at M0, so there was
  nothing to check. Added `wrangler.jsonc`: an assets-only Cloudflare Worker serving
  `apps/web/dist`, with SPA fallback for `/editor` and the other paths. The custom domain
  is set in the dashboard, so deploys never touch DNS. `_headers` gained long caching for
  `/assets/*`. Testing the build with the real headers found that Export code's HTML +
  runtime preview didn't play: its `srcdoc` frame inherited the CSP, which blocks inline
  scripts. It now plays in `/export-preview.html`, a sandboxed page with its own
  inline-only, no-network policy. That was checked in Chrome and Firefox, and the app keeps
  its strict CSP. Social preview tags and `og-image.png` (built by
  `docs/media/og-image.swift`). README: live link and live badge. Decision 022. Decision 023
  proposes how exported toggles could tell screen readers their state (not built).
  Next: the owner connects Cloudflare and the domain, then checks the live site. Then the
  GIFs and the VoiceOver pass.
- **2026-11-10** — The site's address is `icontween.vedjuk.com`, a subdomain of the owner's
  portfolio, not icontween.com (owner decision: it's a portfolio piece, so it should sit on
  the portfolio domain, at no cost). `SITE_URL` in core is the one place exports get it
  from. A test checks that `index.html`, the runtime banner and types, and the README use
  the same address. Export snapshots and the README hero were rebuilt with it. Decision 022
  updated.
- **2026-11-11** — Live on Cloudflare: Workers Builds deploys `main` (Node 24 set as a build
  variable). The live headers were checked: SPA fallback, the strict CSP on the app, none on
  the export preview, immutable `/assets`. The dashboard's Add Domain dialog wouldn't find
  the vedjuk.com zone, so `icontween.vedjuk.com` is now declared in `wrangler.jsonc` as a
  custom domain, attached on deploy (decision 022 updated).
- **2026-11-11** — Automatic deploys: the Cloudflare Workers and Pages GitHub app had access
  only to the portfolio repo, so pushes to `icontween` didn't start a build (the first
  build only worked because the repo is public). The app now has access to `icontween` too,
  so every push to `main` builds and deploys.
- **2026-11-11** — **icontween.vedjuk.com is live.** The push built and deployed on its own,
  and the custom domain is attached. Checked on the live domain: SPA fallback for
  `/editor`, `/editor/` and unknown paths, the strict CSP on the app, none on the export
  preview (`X-Frame-Options` kept), immutable `/assets`, and `og:image` on the new address.
  In headless Chrome, Export code's HTML + runtime preview plays (menu → close on click).
  `workers.dev` is off now that the custom domain is set.
  Next: the owner checks Safari and Firefox by hand, then the GIFs and the VoiceOver pass.
- **2026-11-11** — Landing: "See the starters" now scrolls smoothly to the section instead of
  jumping (`scroll-behavior: smooth` on `html:has(.landing)`). It's off for reduced motion, and the
  editor's skip link still jumps.
- **2026-11-11** — **Phone viewer** (decision 024, branch `phones-view`). Below 48rem,
  `/editor` and `/prepare` show one animation large and at 48/24/16, played by the shipped
  runtime, with a Motion switch, its purpose, trigger, sequence, timing and reduced motion
  (read only), "Editing needs a bigger screen" with Copy link / Share, and a picker (yours,
  then starters). It never writes to the saved project. On touch, hover animations play as a
  toggle. The landing's card links say "View" on phones. Shared label tables moved to
  `editor/labels.ts`, the starter set to `starterSet.ts`. Checked at 375px in the browser
  pane: no sideways scroll, share link, tap toggle, appear replay, picker and Back, desktop
  editor unchanged. Next: the owner checks on a real phone.
- **2026-11-11** — The `phones-view` pull request's Cloudflare check failed: branch builds run
  `npx wrangler preview`, which needs a `previews` block. Production was untouched. The owner
  chose to turn Preview Builds off and build only `main` (noted in decision 022).
- **2026-11-11** — README GIFs recorded: `prepare.gif` (adding Lucide's smile, cleanup report,
  compare modes), `edit.gif` (menu starter: state B, drag a point, play the morph) and
  `export.gif` (copy starter: play the export, switch formats, Copy). Scripted with Playwright
  plus gifski (installed with Homebrew, not a repo dependency); 160–260 KB each. Linked from the
  README. Next: the owner checks them by hand.
