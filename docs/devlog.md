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
