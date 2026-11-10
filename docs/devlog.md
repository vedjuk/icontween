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
