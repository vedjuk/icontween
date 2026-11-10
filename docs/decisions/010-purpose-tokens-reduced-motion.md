# 010 — Purpose defaults, motion tokens and the reduced-motion setting

Date: 2026-11-10

## Context

M3 part 4 adds the last pieces of the animation model the brief asks for: the purpose
picker with defaults (brief §9 table), motion tokens that can be tuned, and a
reduced-motion setting per animation. The runtime already resolved tokens and applied
reduced motion (decisions 005, 007). What was missing were the defaults, the editing UI and
a way to see reduced motion in the preview.

## Decision

- **A purpose sets four things:** trigger, step timing (duration and easing), sequence
  pattern and reduced-motion mode (`PURPOSE_DEFAULTS` in core). Repeat, stagger and delays
  are not part of it: they belong to the specific icon.
- **Defaults** (to tune by hand):

  | Purpose         | Trigger | Timing                  | Pattern          | Reduced motion |
  | --------------- | ------- | ----------------------- | ---------------- | -------------- |
  | Feedback        | click   | `base`, `snappy`        | Return (A→B→A)   | instant        |
  | State change    | toggle  | `base`, `standard`      | Hold             | instant        |
  | Attention       | appear  | `slow`, `spring-gentle` | Return ×2        | none           |
  | Discoverability | hover   | `fast`, `standard`      | Hold             | none           |
  | Delight         | click   | `spring-bouncy`         | Return (A→B→C→A) | fade           |

  Where the brief offered a choice we took the one the editor can preview: click rather
  than manual for feedback, appear rather than manual for attention. Discoverability uses
  Hold, not A→B→A, because hover already plays back on leave (decision 009). Feedback uses
  `snappy`, the curve meant for small, immediate feedback. Attention plays twice and stops;
  it never loops by default.

- **What differs from the defaults is an override, and overrides survive.** Changing the
  purpose moves each part that still had the old purpose's default to the new default, and
  leaves changed parts alone (step timing per step and per value). The inspector lists the
  changed parts and offers "Use … defaults" to reset them. Option lists mark the default
  (`Toggle · default`), so overrides stay visible without a separate panel.
- **The purpose shapes new work:** `createAnimation` takes the purpose's trigger and
  reduced-motion mode, the first state added builds the purpose's pattern (Feedback: cloning
  A gives A→B→A), and new steps take the purpose's timing. A newly opened icon keeps the
  purpose of the last one. The default purpose is still State change, so the editor's
  default trigger moved from hover to toggle.
- **Motion tokens are project-level, with a fixed set of names.** The editor keeps them in
  its store (they'll be saved with the project in M4) and passes them to the preview's
  runtime, so steps that use a token follow its value. Values are edited in place: whole
  milliseconds, curves with x kept in 0..1 and y in -1..2, springs with positive values.
  A token keeps its kind (a curve stays a curve). Pure edits in core (`setDurationToken`,
  `setEasingToken`); defaults stay in the runtime.
- **Reduced motion is a per-animation choice** (jump to each state, short fade, or no
  motion), and the preview has a System / Reduced / Full switch so the designer can see it
  without changing their OS setting. It uses the runtime's existing `reducedMotion` option,
  so the preview still equals the export.

## Alternatives

- Applying all defaults on every purpose change: simple, but throws away tuning without
  undo (undo comes later in M3).
- Asking before overwriting: an extra dialog for something the override rule handles.
- Custom token names: useful for design systems, but exports and share links get harder;
  revisit with M4 persistence if needed.
