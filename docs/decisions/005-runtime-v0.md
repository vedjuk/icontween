# 005 — Runtime v0: playback model

Date: 2026-11-09

## Context

M2 needs a runtime that morphs between states with cubic-bezier easing, plays forward and
in reverse, and can be interrupted smoothly (hover in/out). The editor preview and every
export will use this same code (rule 9), so its behaviour is the product's behaviour.

## Decision

- **No runtime dependencies, not even `core`.** The runtime imports only _types_ from
  `@icontween/core` (erased at build). It has its own tiny `d`/`transform` writer; a test
  checks it produces exactly the same strings as `core`'s `segmentsToD()` and
  `transformAttribute()`.
- **Interpolation is plain number blending** of every value in an element state (segments,
  transform, opacity, draw). It relies on rule 1; `createPlayer()` does a cheap structure
  check and throws a clear error instead of animating garbage.
- **A playback is a list of legs.** Each leg runs from a _snapshot of the current values_ to
  one state, so any call (`play`, `reverse`, `toggle`) starts from wherever the icon is.
  Interrupting a leg part-way gives the return leg the same share of time already spent:
  leave after 30% of a hover-in and the way back takes 30% of the duration.
- **Reverse plays the steps backwards with the same easing,** not time-reversed. An ease-out
  stays an ease-out on the way back, so hover-leave feels as responsive as hover-enter.
  Per-element delays are mirrored (the last element to leave is the first to return). This
  answers the brief's open question for now; a separately defined return transition can come
  later.
- **`play()` at the end restarts** from the first step's `from` state. For cyclic sequences
  (A→B→A) that's invisible; for A→B it jumps back to A first.
- **Reduced motion changes how legs are evaluated,** not the timing: `instant` swaps all
  elements at the start of each leg (A→B→A still shows B for the first leg's duration, so
  feedback isn't lost); `fade` dips the opacity out and back in (at most 200 ms per leg) and
  swaps at the midpoint; `none` ignores triggers and stays on state A. `'auto'` reads
  `prefers-reduced-motion` at each play; the editor can force either value.
- **Triggers in v0:** hover (also keyboard focus, so it works without a mouse), click
  (`play()`), toggle (`toggle()`), manual. Loop and appear arrive with M3, as does spring
  physics. Until then a spring easing falls back to the `standard` curve.
- **Default motion tokens live in the runtime** (`fast 150`, `base 250`, `slow 400`;
  `standard`, `snappy`, `spring-gentle`), overridable per player. Unknown tokens fall back
  to `base`/`standard`; catching them is the validator's job, not the runtime's.
- **Elements are found by `data-icontween-element="<id>"`** inside the target `<svg>`; missing
  ones are created. Inline-SVG exports can ship state A as plain markup, and the editor can
  hand the runtime an empty `<svg>`.
- **The clock is injectable** (`now`, `frame`, `cancel`), so tests step time exactly.
- **Size is measured** with `pnpm --filter @icontween/runtime size` (Vite lib build, minified,
  gzipped). Vite is already in the workspace, so this adds no new package.

## Alternatives

- Web Animations API / CSS for morphs: can't animate `d` reliably in Safari (rule 10).
- Re-using `core`'s serializer: would make `core` a runtime dependency of every export.
- Time-reversed easing on reverse: technically "exact", but ease-outs turn into sluggish
  ease-ins on hover-leave.
