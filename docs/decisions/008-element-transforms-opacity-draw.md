# 008 — Element transforms, pivot, opacity and draw in the editor

Date: 2026-11-10

## Context

M3 part 2 makes the rest of an element's animatable values editable: translate, rotate and
scale around a pivot, opacity, and draw (start/end). The runtime already plays all of them
(decision 005); the editor only edited points. Extends decision 006.

## Decision

- **Pure edits in `core`:** `setElementValues()` (transform, opacity, draw for one element in
  one state), `setPivot()`, `resetElementValues()` and `pivotPresets()`. Values are rounded to
  3 decimals like geometry; opacity and draw are clamped to 0..1, and a draw start or end
  dragged past the other stops at it, so `validateAnimation()` always passes.
- **One pivot per element, shared by all states.** The schema stores the origin per state,
  but blending two different pivots makes a rotation drift and wobble. The editor sets it in
  every state at once. Moving the pivot does not compensate the translate: states that
  already rotate or scale turn around the new pivot, which is what "move the hinge" means.
- **Pivot presets are the 3 × 3 grid of the element's box in state A** (like Figma or After
  Effects), plus exact X/Y fields and a draggable cross on the canvas. Snaps to the half
  grid like points.
- **The pivot is grabbed by a ring, not its centre.** Presets often land on an anchor (the
  top of a bell), and the anchor is drawn on top. The ring around the cross moves the pivot
  and the centre still grabs the point.
- **Dragging an element moves it (translate).** The drag only starts after 3 px, so a click
  just selects. Snapping applies to the distance moved, so an element nudged off the grid
  keeps its offset. Arrow keys nudge the element when no point is selected.
- **The canvas paints opacity and draw exactly like the runtime.** `paintAttributes()` in
  core produces the same attributes as the runtime's renderer (tested against it), and
  `iconToSvg()` now uses it too. The selected element also gets a dashed full outline, so a
  faded or undrawn element can still be found and grabbed.
- **UI units:** scale and opacity/draw are shown in percent, rotation in degrees. Opacity and
  draw get sliders for feel, with number fields for exact values.

## Alternatives

- Per-state pivots (as stored): more freedom, but almost always produces wobbly rotations.
- Compensating translate when the pivot moves (After Effects' "pan behind"): keeps each state
  looking the same, but surprises designers who move the pivot to change the hinge.
- Rotate/scale handles on the canvas: useful later; fields first, then judge by hand whether
  handles are worth it.
