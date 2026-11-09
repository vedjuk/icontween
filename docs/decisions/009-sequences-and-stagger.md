# 009 — Sequences, pattern templates and per-element delay/stagger

Date: 2026-11-10

## Context

M3 part 3 makes the sequence editable: more than one step, steps back to earlier states
(A→B→A), pattern templates (brief §9), and per-element delays and stagger. The runtime
already played any chain of steps with delays and stagger (decision 005); the editor only
grew the sequence A→B→C and found a step by its target state, which breaks as soon as a
state appears twice. Extends decision 006.

## Decision

- **A sequence is edited as its path of state ids** (`A B A`) and rebuilt into steps with
  `setSequencePath()` in core. A step that stays (same from and to) keeps its timing and
  delays; a new step takes the duration, easing and stagger of the step that was at its
  place (not its delays), else the default. So changing the pattern never throws away
  tuning that still applies.
- **Steps must form one chain from state A.** `validateAnimation()` now checks it, because
  the runtime plays the steps as one path forwards and back. A step to the same state is
  allowed: it is a hold.
- **Four templates,** built from the states that exist: Hold (A→B→C), Return (A→B→C→A),
  Return ×2 (for attention, brief §9) and Back and forth (A→B→C→B→A, three states or more).
  The strip shows which one matches, or "Custom". Brief patterns like A↔B are Hold with the
  hover or toggle trigger, which play back by themselves; the strip warns when a returning
  sequence is paired with those triggers, since it would move twice.
- **A new state follows the pattern:** a sequence that matches a template is rebuilt with
  it, one that returns to A gets the new state before the return (A→B→A becomes A→B→C→A),
  anything else gets it at the end.
- **Steps are selected by index.** Selecting a step edits the state it goes to, and the
  onion skin shows where that step comes from (B while editing A in B→A). Selecting a state
  picks the first step into it. Manual editing: "Goes to" per step, + Step / − Step at the
  end only, so the chain can't break in the middle.
- **Delays and stagger per step,** in whole milliseconds. One row per element with its delay
  and a bar showing when it moves within the step, so the rhythm is visible without
  playing. `elementOffsets()` in core computes the bars with the runtime's rule (delay +
  stagger × element order); played backwards the runtime mirrors them.

## Alternatives

- Editing steps as a free list (any from/to): more freedom, but invalid chains and a
  runtime that can't play them backwards.
- Stagger order options (reverse, from centre): not in the schema; per-element delays cover
  it for icons with a handful of elements.
