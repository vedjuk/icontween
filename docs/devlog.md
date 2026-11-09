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
