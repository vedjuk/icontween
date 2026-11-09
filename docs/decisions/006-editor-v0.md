# 006 — Editor v0: states and point editing

Date: 2026-11-09

## Context

M2 part 2 needs the first real editor: clone state A into B, shape B by dragging points and
handles, see the previous state as an onion skin, and try the result live.

## Decision

- **Edits are pure functions in `core`** (`createAnimation`, `addStateCopy`, `movePoint`,
  `setElementSegments`, `editablePoints`). They return new data and never touch their input,
  and none can change structure (`setElementSegments` throws if the commands differ). The
  editor stays a thin layer, and undo in M3 can be a stack of animations.
- **Zustand** holds the editor state (under 1 KB gzipped, planned in the brief). In
  development every edit runs `validateAnimation()` and logs any issue.
- **Moving an anchor carries its handles,** as in Figma or Illustrator. Handles move alone.
  No mirrored/smooth handle linking yet.
- **Closed shapes show their start point once.** Circles and rounded rects end exactly on
  their `M`; that pair is one node on screen and moves together, so shapes never tear open.
- **Snapping to a 0.5 grid is on by default,** Alt turns it off while dragging. Arrow keys
  nudge 0.1, Shift + arrow 1, and X/Y fields allow exact values. All coordinates are rounded to
  3 decimals, like prepared geometry.
- **The onion skin is the previous state** in the strip (A when editing B), in grey at 35%.
- **Any state can be edited,** including A: point moves only change numbers, so rule 1 holds.
  Structure is still only decided in Prepare (rule 4).
- **Each new state is a copy of the last one,** with a step into it (`base`, `standard`). So
  the sequence grows A→B→C; patterns and purposes arrive in M3.
- **The preview is the runtime itself** (rule 9), re-created on every edit, at 48/24/16 px in a
  button that receives the trigger.
- **The icon picker is shared** (`library/`) between the prepare screen and the editor.
- **Not saved yet.** Opening another icon asks first when states exist. Persistence is M4.

## Alternatives

- Editing through the DOM (mutating paths, reading them back): fast to start, but splits the
  truth between the DOM and the data model.
- Keeping the closing point as its own node: matches the data, but dragging one of two
  stacked nodes tears closed shapes open.
