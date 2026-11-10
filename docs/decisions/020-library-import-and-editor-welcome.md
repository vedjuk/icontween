# 020 — Library import, plain-word SVG notes and the editor's welcome

Date: 2026-11-10

## Context

M5 asks for library polish: dropping several files at once, thumbnails, and clear messages
for SVG features the pipeline can't use (brief §14). Until now a dropped file went into the
library unchecked and only failed when opened. Unsupported elements were reported by tag name
("Not supported yet and left out: <defs>, <style>"), and anything nested inside a dropped
element (a gradient inside `<defs>`) wasn't mentioned at all. The editor opened the menu
starter when there was nothing to reopen, so the "Make your own" invitation on the landing
page led to a starter, not to your own icon.

## Decision

- **Every file is checked on the way in.** Dropped, picked or pasted, each SVG goes through
  `prepareSvg()` (parse, sanitize, prepare), the same as when it's opened. Files that work
  are added and the first one opens. Files that don't work are not added. A small import
  report in the library lists every file: added, added with things to know (one plain
  sentence each), or not added and why ("Not an SVG file.", "This isn't valid SVG…"). It
  stays until dismissed. Pasted code that fails stays in the box so it can be fixed. The
  source text is stored untouched (rule 3).
- **Unsupported features in plain words (`core/prepare/unsupported.ts`).** Before
  sanitizing, the pipeline counts unsupported elements in the whole tree and groups them
  into features a designer recognises: text, masks and clipping, gradients, patterns,
  filters, reused symbols, embedded images, style blocks, markers, nested SVG, links,
  switch. Each gets one sentence: what happened and what to do ("Text isn't supported, so
  it was left out. Convert text to outlines first."). They go into `report.warnings` and a
  structured `report.unsupported`. When nothing drawable is left, the error says why.
  Dashed strokes and fill/stroke opacity got plain sentences too.
  Attributes that only point at an unsupported feature (`clip-path`, `mask`, `filter`,
  markers, and `fill`/`stroke` when there's a gradient or pattern) no longer show under
  "Removed for safety". They weren't a safety issue.
- **Thumbnails show the prepared clone.** The list already had thumbnails of the sanitized
  source. They now show what you will animate, so a left-out wordmark is already missing in
  the list. An icon with notes gets a small "!" (an icon that can't be opened gets "✕"),
  with the notes in its tooltip. Results are cached by source text.
- **The editor opens on a welcome when there's nothing to reopen.** No link, no saved open
  icon: instead of opening a starter, it shows "Animate your own icon", a "Choose SVG files"
  button (dropping anywhere still works), the landing page's three steps (now shared in
  `src/steps.ts`), and the starters as a grid of tiles. Returning visits still reopen the
  last icon, and links still open what they name.

- **Your icons can be renamed and deleted.** A pencil and a bin show on hover or keyboard
  focus (starters have neither). Rename is inline (Enter or leaving the field saves, Esc
  cancels) and the icon's animation takes the new name, also in undo history, so exports
  and the editor title follow. Delete always asks first, removes the icon's animation too,
  and the editor shows the welcome if that icon was open.
- **Library sections fold.** "Your icons" and "Starter set" headings open and close their
  list and show a count. The starter set starts folded once you have icons of your own, so
  they come first. After you open or close a section yourself, this browser remembers it
  (localStorage, a convenience only: it's not part of the project).
- **Quieter UI details.** The selected row in the list is a slightly deeper fill, with no
  accent bar on one side. Selects draw their own chevron, inset 0.5rem like the text,
  instead of the browser's arrow pushed against the border.

## Consequences

- `PrepareReport` has a new `unsupported` field. It isn't saved in projects, so
  `SCHEMA_VERSION` doesn't change.
- Icons saved before this change are never re-checked on load. If one can't be opened, it
  shows "✕" in the list and the editor shows the error, as before.
- The welcome is the editor's empty state. Error states keep their own message, plus a hint
  to pick or drop another icon.
