# 017 — SVG + SMIL export (no JavaScript)

Date: 2026-11-10

## Context

The brief's first export format: a standalone SVG that animates with SMIL, works as
`<img src>`, and is readable (rule 7). It's the one format that can't use the runtime, so
preview = export (rule 9) has to be proven another way. Reduced motion (rule 8) can't be
read from SMIL. Scope agreed with the owner before building. Extends decision 016.

## Decision

- **One `<animate>` per value per pass.** A pass is the whole sequence in one direction.
  Each path gets one animation for `d`, opacity, the dash (draw) and each transform part
  that changes, over the whole pass: holds for delays and stagger, a move per step. Delays,
  stagger, mirrored delays on the way back and the leg lengths follow the runtime's
  `buildLeg` exactly. No chains of `begin` offsets that can drift.
- **Curves and springs.** A cubic-bezier with control points in 0..1 becomes `keySplines`
  (exact). Springs and curves that overshoot (y outside 0..1, which SMIL doesn't accept)
  are sampled: more keyframes where the curve bends, until straight lines between them are
  within 0.05 viewBox units (0.05 px at 24 px), and never coarser than 0.5% of the move.
  About 15–35 keyframes per spring step. Where a draw shrinks to nothing (the runtime hides
  the path), the opacity jumps at the exact moment.
- **Core has its own copy of the easing math** (`export/easing.ts`): the runtime has no
  dependencies and core doesn't depend on the runtime. A runtime test checks both give
  identical numbers.
- **Transform around a pivot** is written as `translate(t) rotate(r ox oy)
translate(ox·(1−s) oy·(1−s)) scale(s)`: the first part replaces, the others add. Equal to
  the runtime's matrix; exact because the editor keeps one pivot for all states (decision
  008). Constant parts stay in the chain as single values.
- **Draw** uses `pathLength="1"` with animated `stroke-dasharray` / `stroke-dashoffset`, and
  opacity as the runtime clamps it.
- **Repeat.** Loop: forwards, then the rest, repeated (`repeatCount="indefinite"`); the jump
  back to the first state happens at the cycle boundary, like the runtime. Ping-pong:
  forwards, rest, back (mirrored delays, same easing), rest, as one cycle.
- **Timers.** One zero-size `<animate>` per direction (`…Play`, `…Reverse`) starts on the
  trigger; every other animation begins with it (`begin="copyPlay.begin"`). Ids are
  camelCase: Chrome reads the first `-` in `begin="id.event"` as a time offset, so
  `copy-play.begin` never fires (found in the browser; a test now guards it).
- **Triggers.** All six work inline. Loop and appear also as `<img>`; the others show
  state A there.
  - loop/appear start when the file loads (not when scrolled into view).
  - click: an invisible hit area over the viewBox; clicks while it plays are ignored
    (`restart="whenNotActive"`), like the runtime.
  - hover: `mouseover` / `mouseout` on the hit area. SMIL can't start from current values,
    so leaving halfway jumps to the end before playing back. No keyboard focus.
  - toggle: two hit areas take turns (`<set display>`), swapping when a run ends, so clicks
    mid-run are ignored instead of jumping.
  - manual: `begin="indefinite"`; code calls `beginElement()` on the timers.
- **Reduced motion.** A second copy of the paths behind
  `@media (prefers-reduced-motion: reduce)`. instant: discrete jumps at the start of each
  step, held for the step's duration (A→B→A still shows B). fade: a dip of at most 200 ms
  with the swap halfway. none: still on state A. Never repeats. Same timers and triggers.
  Roughly doubles the path markup; the starters are 4–15 KB, 1.7–2.5 KB gzipped.
- **Preview = export, tested.** `runtime/test/smil.test.ts` evaluates the exported SMIL the
  way a browser does (keyTimes, keySplines, repeat, freeze, additive transforms) and
  compares what each path shows with the runtime player on a fake clock, at 61 sample times:
  every starter, full and reduced motion, forwards and back, plus spring, overshoot,
  ping-pong with rest, and draw variants. A deliberately wrong curve fails 17 cases.
- **Export dialog.** "SVG (no JS)": which-triggers table with this icon's trigger marked,
  the file playing inline and as `<img>` side by side (sandboxed iframe, no scripts), and
  Replay to see loop and appear start again.

## Alternatives

- `begin` offsets per element and step: many small animations whose timings must line up;
  harder to read and to test.
- Fixed-rate sampling for springs: more keyframes for the same accuracy.
- A still image as the reduced-motion version: smaller, but click and appear icons give no
  feedback at all.
- CSS animations: can't animate `d` reliably (rule 10), and need the same reduced-motion work.

## Known limits

- Two copies of the same exported icon inline on one page share ids and clash. As `<img>`
  it doesn't matter.
- As `<img>`, `currentColor` can't follow the page, so strokes are black.
- A closed path that animates its draw gets a full-length dash at rest; with butt caps and
  miter joins its start corner shows a notch. Round caps (Lucide) look the same.
- Chrome attaches event listeners a moment after the SVG is inserted, so a click in the
  same instant is missed (not noticeable by hand).
- Checked only in Chrome so far; Safari and Firefox (incl. media queries inside `<img>`)
  come with the cross-browser session.
