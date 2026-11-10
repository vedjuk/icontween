# 012 — Undo/redo

Date: 2026-11-10

## Context

The last M3 editor feature (brief §14). Core's edit functions are pure and return a new
animation, so the old one can be kept as is.

## Decision

- **A stack of snapshots, not commands.** Each undo step keeps the animation and the motion
  tokens from before the edit (references, not copies), plus the selection: the edited
  state, step and element. Undo restores all of it, so the designer sees what came back.
  The selected point is cleared.
- **The stack logic is pure and lives in core** (`history.ts`, tested): `recordEdit`,
  `undo`, `redo`, generic over the snapshot. The editor store routes every change to the
  animation or the tokens through one `commit` helper.
- **Rapid edits of the same thing merge into one step.** Each edit can carry a key (the
  point dragged, the element and fields a slider changes, the step timing field, the token
  name). Same-key edits less than 1 s apart extend the last step, so a drag, a slider
  sweep, a run of arrow-key nudges or typing "250" is one undo. Unkeyed edits (clone a
  state, apply a pattern, change the purpose) are always their own step.
- **Scope:** the open animation and the tokens. Selection, preview options, snap and onion
  skin are not undoable. History is cleared when another icon opens; 200 steps are kept.
- **Shortcuts:** ⌘Z / ⇧⌘Z on Mac, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y elsewhere, plus Undo and
  Redo buttons in the header. Text and number fields keep the browser's own undo while
  focused; sliders and buttons don't.

## Alternatives

- Command objects with inverse operations: more code for each edit and easy to get wrong;
  snapshots are free with immutable data.
- Grouping drags by pointer down/up: exact, but sliders, number fields and arrow keys need
  their own grouping anyway. The key + time window covers all of them; a drag paused for
  more than a second becomes two steps, which is acceptable.
- zundo or another middleware: a dependency for ~60 lines of logic, and it would also
  record selection-only changes.
