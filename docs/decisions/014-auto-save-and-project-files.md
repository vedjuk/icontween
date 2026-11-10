# 014 — Auto-save and project files

Date: 2026-11-10

## Context

M4 starts with persistence (brief §6): auto-save to IndexedDB and `.icontween.json`
import/export. Until now the editor held one animation, and opening another icon threw it
away. Saved data is untrusted: a project file can come from anyone or be edited by hand.

## Decision

- **One reader for everything saved.** `core/project.ts` has `parseProject` (file text),
  `readProject` (already-parsed data, used for IndexedDB) and `readAnimation` (for share
  links and the animation JSON export later). Each rebuilds objects from the fields the
  schema knows (unknown fields are dropped), checks types, keeps ids to letters, digits,
  `-` and `_` (they end up in attributes, URLs and exported code), rejects paint with
  `url(` and friends (rule 6, the same pattern the sanitizer uses), then runs
  `validateAnimation()` on every animation. Errors name the path:
  "The project is damaged at animations[0].states[1]…: expected a number."
- **Schema versions.** A file from a newer schema is refused with "reload the app";
  older ones go through `migrate()`, which is empty while `SCHEMA_VERSION` is 1. The file
  format is the existing `Project` type, so the schema didn't change.
- **Files are readable JSON** (2-space indent, trailing newline; rule 7).
- **The project = your icons + every animation you edited + the motion tokens.** The editor
  keeps `saved` (animations by icon id). An animation joins on its first edit, so browsing
  icons adds nothing. Opening an icon opens its saved animation; "Start over" removes it and
  reopens the icon as it was first opened, default purpose included (a newly opened icon
  otherwise keeps the last icon's purpose). It isn't undoable; it asks first.
  Library icons with an animation get a dot.
- **IndexedDB, no dependency.** ~40 lines of plain IndexedDB in
  `apps/web/src/project/persistence.ts`. One record (`current`): the `Project` plus the
  open icon's id. The editor and prepare pages wait for it to load before they render.
  Writes happen 400 ms after the last change, and at once when the tab is hidden.
  If the saved copy can't be read, it's kept as `backup-<time>` instead of being
  overwritten. If IndexedDB isn't available (some private windows), the header says so and
  suggests Export.
- **Tokens are laid over the defaults** on load: the names are fixed, so unknown names are
  dropped and missing ones filled in.
- **Import replaces, after asking.** Merging would raise questions (whose tokens win, what
  if both have the same icon) for little gain. The confirm says what will be lost and
  suggests exporting first.
- Your own icons now get a `#id` link too; it works in the browser that has them saved.

- **The app's own dialogs, not `window.confirm`/`alert`.** The Claude app's browser pane
  answers `confirm()` with "cancel" without showing anything, so Start over silently did
  nothing there. `ui/Dialog.tsx` uses `<dialog>` (`askConfirm`, `showMessage`); Cancel has
  focus first, Esc cancels.

## Alternatives

- `idb-keyval` (~600 B): fine, but the few lines we need are just as short.
- localStorage: synchronous and limited to ~5 MB, which a library of SVGs can reach.
- Validating with a schema library (zod etc.): far bigger than the runtime itself.

## Known limits

- Two tabs open on the editor: the last one to save wins.
- An animation whose icon isn't in the library (a hand-made file) is kept and exported
  but can't be opened; there's no "Animations in this project" list yet.
