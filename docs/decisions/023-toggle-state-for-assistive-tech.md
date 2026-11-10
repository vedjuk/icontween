# 023 — Toggle state for assistive tech in exports (proposed)

Date: 2026-11-10

Status: **proposed, not built.** It changes what exports do, so it waits for the owner's yes
and a `pnpm export-check` run.

## Context

Decision 021 made the app's own toggle tiles say whether they're on (`aria-pressed`). Exported
toggles don't. The HTML export puts the icon in `<button aria-label="…">`, and the React
export's usage comment says to do the same, but the runtime only animates. A screen reader
hears "pause, button" before and after the click, with nothing to say it changed. The
animation is the only signal, and it's skipped or reduced for people who ask for less
motion.

`aria-pressed` isn't right for every toggle, though. Of the starters, play ↔ pause, lock ↔
unlock, show ↔ hide and sound ↔ mute are on/off buttons, where `aria-pressed` fits. Menu ↔
close opens something, which needs `aria-expanded` (and `aria-controls`). The runtime can't
tell these apart, and an `aria-pressed` added to a menu button would be wrong.

## Recommendation

**The runtime mirrors the state into an attribute the author already put there, and never
adds one.**

- With the `toggle` trigger, on every change of direction (click, `toggle()`, `play()`,
  `reverse()`, `setState()`), the runtime sets `aria-pressed` and/or `aria-expanded` on the
  `listenOn` element, but only if that attribute is already present. The value is `"true"`
  when heading to (or at) the far state, `"false"` back at A. It's set at once on click, not
  when the motion ends, so a screen reader hears the new state straight away. That includes
  reduced motion.
- **HTML export:** toggle buttons get `aria-pressed="false"` in the markup, so they're right
  before the script runs. A comment says to change it to `aria-expanded="false"` for a menu
  or disclosure.
- **React export:** the usage comment shows `aria-pressed={false}` on the button. React sets
  it once, and the runtime keeps it current. Nothing re-renders it, because the prop doesn't
  change.
- **SVG (no JS):** nothing to do. SMIL can't set attributes on a surrounding button, and the
  SVG export is for images and simple embeds.
- **Landing and editor previews** already set `aria-pressed` themselves. They'd switch to the
  runtime's mirroring, so preview and export do the same thing (rule 9).

Cost: a few dozen bytes in the runtime, about 10 lines. It needs runtime tests for each way
of changing state, updated export snapshot tests and a `pnpm export-check` run in Safari,
Chrome and Firefox. No schema change.

## Alternatives

- **Always add `aria-pressed`:** the simplest, but wrong for menu ↔ close and any other
  disclosure, and it would surprise authors who manage ARIA themselves.
- **A per-animation setting in the editor** ("announces as pressed / expanded / nothing"):
  the most precise, but it's a schema change (`SCHEMA_VERSION` bump and a migration), and
  it's UI for something the markup already says.
- **An `onChange` callback only:** flexible, but every author has to write the same three
  lines, and most won't.
- **Do nothing:** exports stay silent about state, which is the gap 021 named.
