# 003 — Prepare pipeline: own geometry, DOMParser, and a few rules

Date: 2026-11-09

## Context

M1 turns any icon SVG into canonical geometry (absolute M/L/C/Z, no shapes, no transforms).
The brief suggested evaluating `svgpath`.

## Decision

- **Own geometry code instead of `svgpath`.** svgpath is ~10 KB gzipped, CommonJS without
  types, last released 2022, and still leaves Q→C, H/V→L and conversion to our segment format
  to us. Our version is a few hundred lines of typed, tested TypeScript in `core/src/geometry`.
- **Order matters: normalize first, transform last.** Arcs become cubics in local
  coordinates, _then_ the element's full transform is applied to the points. Affine maps send
  cubics to cubics exactly, so skewed or non-uniformly scaled arcs need no ellipse math (the
  hardest part of svgpath).
- **Parsing uses the browser's `DOMParser`.** `core` stays free of rendering code; tests run
  with jsdom (dev-only) via `// @vitest-environment jsdom`. `prepareSvg()` accepts an injected
  parser for non-browser use.
- **Sanitizer is an allowlist** (elements, attributes, style properties). Values containing
  `url(`, `javascript:`, `expression(`, `@import` or backslashes are dropped. Entity
  declarations and inputs over 1 MB are rejected before parsing.
- **Shape conversions follow the SVG 2 equivalent paths** (circles start at the right and run
  clockwise, rounded rects start after the top-left corner), so stroke drawing starts where
  browsers start it.
- **Rounded rects always produce the same structure** (`M L C L C L C L C Z`), keeping
  zero-length edges for pills. Two rounded rects can therefore always morph into each other.
- **Stroke width scales with flattened transforms** (√|det|). Non-uniform scale or skew can't
  be represented exactly and adds a warning.
- **Elements are left out, with a reason,** when hidden, empty, invisible (no stroke and no
  fill) or unreadable. One bad element doesn't fail the whole icon.
- **State A origin** is the exact bounding-box centre (cubic extrema solved, not control
  points).

## Alternatives

- `svgpath`: see above.
- A JS XML parser in `core` (no DOM): more code to own and secure; the browser parser is
  already there.
