# 015 — Share links in the URL hash

Date: 2026-11-10

## Context

M4 asks for share links (brief §4, §7): one animation, carried in the URL, never sent to a
server (rule 5). Opening a link must go through the same checks as Import.

## Decision

- **Format: `/editor#a=<code>`.** The code is compact JSON → deflate-raw with the browser's
  own `CompressionStream` → base64url without padding. No dependency. A different packing
  later would use a different key (`#b=…`), so old links keep working.
- **What a link carries** (`SharedAnimation` in `core/project.ts`): `schemaVersion`, the
  animation, the values of the motion tokens it uses (not all of them), and the source
  icon's SVG only when it isn't a built-in starter. Starters are looked up by id, which keeps
  links short. This is a new payload, not a change to the `Project` or `Animation` schema.
- **Same checks as Import.** `readSharedAnimation` uses the project readers: known fields
  only, plain ids, no remote paint, newer schemas refused, `validateAnimation()`. A link's
  SVG is kept raw and sanitized whenever it is shown or prepared, like a dropped file.
  Errors now say what was read: "The link is damaged at animation.states[1]…", and
  `readAnimation` says "animation" instead of "project".
- **No zip bombs.** Unpacking stops past 2 MB of JSON; codes over 3 M characters are
  refused unread. A cut-off or mistyped link says "damaged or incomplete".
- **Size.** The 12 starters make links of 600–1,250 characters (a test keeps each under
  8,000). Over 8,000 the share dialog warns that some apps cut long links and suggests
  Export. No hard limit: a long link still works if it's copied whole.
- **Opening a link adds the animation to your project** and opens it, like an edit would.
  - Same animation already there (you opened your own link): just opens.
  - A different one for the same icon: asks "Replace your … animation?" (one animation per
    icon, so there's no "keep both"). Cancel keeps yours.
  - Icon not here: the link's SVG joins Your icons. A starter id this version doesn't have
    is refused with a message.
  - Tokens: the link's values are laid over yours (unknown names skipped, clamped like the
    inspector). If they differ and you have other animations, it asks "Use the link's
    timing?" (Keep mine / Use the link's), because tokens retime the whole project.
    With no other animations they're used as they are.
- **The long hash doesn't stay.** It's swapped for `#<icon id>` as soon as it's read, so a
  reload or bookmark doesn't reopen it. A link pasted into an open editor tab (only the
  hash changes) is picked up through `hashchange`.
- **Share dialog**: the link in a read-only field (selected, start in view), its length,
  Copy link with "Copied", and "Press ⌘C" when the clipboard is blocked. `askConfirm` got
  an optional `cancelLabel`.

## Alternatives

- `lz-string` (~5 KB): works everywhere, but deflate in the browser does the same for free
  and packs JSON better. `CompressionStream('deflate-raw')` is in Chrome 103+, Safari 16.4+
  and Firefox 113+.
- Rounding coordinates to shorten links: lossy, so the shared animation wouldn't be the
  one that was designed. Links are short enough without it.
- Including the whole project's tokens, or resolving tokens into plain numbers: the first
  bloats the link, the second loses the link between the animation and its tokens.

## Known limits

- The person who opens a link needs a browser with `CompressionStream` (above).
- A link to your own icon carries its SVG, so it is as private as the icon: anyone with the
  link has the icon.
