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
