# 019 — Landing page and the shipped starter set

Date: 2026-11-10

## Context

M5 starts with the landing page: the idea in a few lines, the starter examples live, and
"Open in editor" on each (brief §14). Until now the 12 starters existed only as recipes in
`core/test/starters.ts` (decision 013), so there was nothing to ship or play.

## Decision

- **One project file: `examples/starters.icontween.json`.** All 12 starters with their
  motion tokens, in the format Export project writes. Ids and names are the ones the editor
  uses for a starter icon (`lucide-pause`, `pause`), so links and Import find the built-in
  sources. `library` is empty because every icon ships with the app.
- **The file is the source of truth from now on.** The recipes seeded it once
  (`SEED_STARTERS=1 pnpm --filter @icontween/core test starters-file`). To tune feel, the
  owner opens or imports the starters, edits them in the editor, exports the project and
  saves it over the file. `starters-file.test.ts` checks only that it reads with Import's
  checks, is formatted as Export writes it, and that each animation still has its source
  icon's structure (rules 1 and 4). It doesn't compare timing with the recipes. Prettier
  ignores `*.icontween.json` so the bytes stay as the app wrote them.
- **The landing page plays the file with the shipping runtime** (rule 9): one
  `createPlayer` per card with the project's tokens and the OS reduced-motion setting.
  Hover, click and toggle starters sit in a button tile (labelled with the starter's name),
  like an icon in a real control. Loop and appear starters sit in a plain tile, and appear
  has a Replay link. When the OS asks for reduced motion, a note says the cards play their
  reduced versions.
- **Each starter is a card:** the play area on top (its hint as a small caption), the name
  and a quiet outlined **Edit** button below ("Edit Play ↔ pause in the editor" for screen
  readers). Text links read as clutter next to the titles; filled buttons would compete with
  the icons.
- **Edit is a share link** (`/editor#a=…`, decision 015), made for each card when
  the page loads. Opening one goes through the same checks and questions as any link, such
  as "Replace your … animation?" when you already have one for that icon. Before the links
  are ready, the cards link to `/editor#<icon id>`.
- **Grouped by purpose,** using core's purpose names and hints, state changes first because
  the morphs are what the tool is for. Each card's title names the moment ("Copied",
  "Notification"), not the icon file.
- **The wordmark tweens in.** The hero reads "icontwn" for a beat, then the two e's open
  up between the keyframe letters: the in-betweens arriving. It's CSS (each e's width
  animates as a grid track, 0fr → 1fr, so it opens to exactly its own width), runs once,
  and is skipped for reduced motion. The heading's accessible name is "IconTween".
- **"Bring your own icon" is said twice.** The starters alone made the page read as a
  gallery. The hero line now leads with your own SVG, from presets to every last point, and
  a short "Make your own" section after the starters gives three steps (drop in your icon,
  start from a purpose or go manual, export clean code) and an Open the editor button. It
  comes after the starters because people play first, then ask "can I do this with mine?".
  No feature tour with screenshots: heavy, and stale with every UI change. Those belong in
  the README.
- **Copy:** tagline, the hero line, four principles from brief §2, and a footer
  saying nothing is uploaded, with the MIT and Lucide (ISC) credits.

## Alternatives

- **One file per starter:** closer to "an example you can open", but the owner would export
  and replace 12 files after a tuning pass instead of one.
- **Keep generating the file from the recipes (a file snapshot):** then every tweak made in
  the editor would have to be retyped as code. It would also go against decision 013, which
  calls the recipes first drafts.
- **Load the starter into the editor's project directly from the landing page:** that skips
  the share link's checks and its "replace?" question, so it's more code that does less.
