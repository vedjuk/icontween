# 021 — Accessibility pass on the app UI

Date: 2026-11-10

## Context

M5 asks for an accessibility pass on the app UI: keyboard, focus and contrast (brief §14),
aiming for WCAG 2.1 AA on the landing page and the editor, in light and dark. The audit
measured contrast from computed colours on every visible text node and control, and walked
the main flows with the keyboard in the preview. Things that already passed: the language
and landmarks, heading order, the native modal dialogs (focus trapped, Esc closes them,
focus goes back to the button that opened them), labels on icon-only buttons, the "!" and
"✕" marks (hidden text, different shapes), landing text contrast, and reduced motion for
the wordmark and every preview.

## Decision

**Keyboard path for the canvas.** Points and handles could only be picked with a mouse. Now
the canvas is a tab stop (`role="application"`, with its keys described for screen readers).
While the canvas has focus:

- `]` / `[` select the next / previous point of the selected element (the first element when
  none is selected).
- Shift + `]` / `[` select the next / previous element.
- Arrow keys nudge 0.1, or 1 with Shift.
- Esc steps back one level (point → element → nothing).

Brackets are matched by key and by physical key (`BracketRight`), so they work on layouts
that put them elsewhere. The Inspector shows the same path as "Point 3 of 14" with ‹ ›
buttons, so it can be found without knowing the keys, and its X / Y fields place a point
exactly. A polite live region says what's selected ("el-1: point 2 of 33 (handle out), at
2.3, 7.22."). Not included: keyboard pivot dragging (the pivot X/Y fields already do it),
multi-select.

**Canvas keys only on the canvas.** The nudge keys used to listen on the whole page. With an
element selected, ↓ on any focused button (a library row, a pattern) moved the element, and
Esc in a dialog also deselected it. They now apply only when the canvas (or nothing in
particular) has focus. The logic lives in `editor/canvasKeys.ts`, with tests.

**Focus never falls back to the page.** Focus used to land on the page after a rename
(Enter or Esc), a delete, picking a starter on the welcome, and Start over. Now it moves to:

- the renamed row
- the next icon in the list after a delete (or the one before, the section heading, or Add
  SVG files)
- the editor's title (`tabindex="-1"`) after a welcome pick or Start over

`ui/focus.ts` only moves focus when it was lost, so it never pulls focus from where someone
put it. The editor has a "Skip to the editor" link that appears on focus and jumps over the
~30 library controls. It moves focus without changing the URL hash, because the hash names
the open icon.

**Announcements.**

- The import report's live region used to appear together with its text, so screen readers
  often missed it. An always-present status now says the summary, which files weren't added,
  and whether any have notes (`library/importSummary.ts`, with tests).
- The save status no longer announces "Saving…" after every edit. Only "Can't save in this
  browser" is spoken.
- Toggle tiles say whether they're on (`aria-pressed`) on the landing page and in the editor
  preview. The app follows the runtime's flip on each click. The runtime itself is
  unchanged, so exports don't change here. Whether exported toggles should set
  `aria-pressed` is a separate question.
- Tile hints ("Click to toggle") are linked with `aria-describedby`.

**Contrast (both themes).**

| What                         | Before                         | After                                           |
| ---------------------------- | ------------------------------ | ----------------------------------------------- |
| Filled buttons (Copy, OK…)   | 4.39:1 light, 2.81:1 dark      | `--primary` `#c23a22`, 5.35:1 in both           |
| Grey text on grey fills      | 4.40:1, 3.99:1 on selected row | light `--muted` `#67676f`, ≥ 4.6:1              |
| Text field and select border | 1.23:1 light, 1.40:1 dark      | `--control-border` `#8e8e96` / `#71717a`, ≥ 3:1 |

Buttons keep the quiet `--border`: their text identifies them. The focus ring was already
≥ 4.4:1 everywhere. It's now one global `:focus-visible` rule, so inputs, selects, links and
summaries use the same vermilion ring instead of the browser's own. A selected sequence step
gets a 2px border, so the selection doesn't rely on colour alone.

**Cursors.** Every enabled button, select, checkbox, range and summary shows the pointer.
Disabled controls show the default cursor and every disabled `.button` is faded. Before,
only Undo/Redo and the sequence buttons were, and others such as Reset tokens looked
clickable. The runtime dev page's `.field select` rule, which leaks into the editor, uses
the new border too.

## Alternatives

- **An a11y linter or axe in tests:** a new dependency, and the computed-colour audit plus
  keyboard walk found what matters here. Worth revisiting if the UI grows.
- **DOM tests for focus (jsdom or happy-dom):** also a new dependency. The decisions are in
  plain functions with tests instead. The DOM wiring was checked by hand in the preview.
- **Inspector-only point picker, no canvas keys:** less work, but nudging on the canvas is
  the natural way to work, and the brief asks for arrow-key nudges.
- **`aria-pressed` in the runtime:** would help every exported toggle, but it changes what
  exports do and needs its own decision and an export-check run.
