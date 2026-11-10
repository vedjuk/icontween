# 016 — Exports: HTML + runtime, React, JSON

Date: 2026-11-10

## Context

M4's done-when: an exported React component and an SVG + runtime file work in a fresh Vite
app and a plain HTML page (brief §11, §14). Exports must be readable (rule 7), handle
reduced motion (rule 8) and play with the same runtime as the preview (rule 9). The
runtime isn't on npm yet, so every export has to bring it along. SVG + SMIL is left for
its own session.

## Decision

- **Generators live in core** (`core/src/export/`): `exportHtml`, `exportReact`,
  `exportJson`, each returning `{ fileName, type, text }`. Core stays pure: the HTML
  exporter is handed the runtime's code as a string.
- **Tokens are resolved** into plain numbers and curves (`resolveTokens`, with the
  runtime's fallbacks: unknown duration → `base`, unknown easing → `standard`). An exported
  icon then doesn't depend on the project's tokens, and `duration: 250` reads better than
  `{ token: 'base' }` for the developer who receives it.
- **Data is printed by hand-rolled `printData`**: small objects stay on one line
  (`{ cmd: 'C', x1: 9, … }`), wider ones break one entry per line, like Prettier would.
  JSON for `.json`, JavaScript (bare keys, single quotes, trailing commas) in code.
  `JSON.stringify(…, 2)` put every coordinate on its own line, a few hundred lines per icon.
- **The runtime ships as built code, from the same source the preview imports.**
  `packages/runtime/scripts/bundle.js` builds it with Vite (already in the workspace),
  unminified so the doc comments survive, with a licence banner. A Vite plugin in the web
  app serves it as `virtual:icontween-runtime`, loaded only when the Export dialog opens
  (~11 KB gzipped chunk). The size script uses the same builder.
  - `iife` (a global `IconTween`) is inlined into the HTML export: one file that also
    works when opened straight from disk, where module scripts are blocked.
  - `es` is `icontween.js`, downloaded once and imported by every React component
    (owner's choice over embedding the runtime in each component).
- **`icontween.d.ts` is hand-written** (`packages/runtime/types/`), so TypeScript apps get
  types without a d.ts bundler dependency. A type test (`runtime/test/public-types.ts`,
  run by `pnpm typecheck`) checks it matches the runtime's API and core's data model, both
  ways.
- **HTML export**: a complete page. The icon is inline SVG in state A (visible before
  scripts run), paths tagged `data-icontween-element`. Hover/click/toggle icons sit in a
  `<button>` that listens (keyboard and a bigger target); manual gets a Play button; loop
  and appear stand alone. The name is escaped everywhere it appears, including a
  `</script>` guard in the data and comments.
- **React export**: one `.tsx` file with a `forwardRef` component (React 18 and 19): state A
  as plain JSX (so it shows during server rendering), the runtime started in an effect,
  props `size`, `trigger`, `listenOn` (a ref to the surrounding button), `reducedMotion`,
  and a ref handle (`play`, `reverse`, `toggle`, `stop`, `setState` typed to the state ids).
  The wrapper is in the component itself for now; `packages/react` is still a placeholder
  and gets this as a reusable hook when the packages are published.
- **JSON export**: `{ schemaVersion, animation }`, ready for `createPlayer(svg, data.animation)`
  and readable back with `readAnimation`.
- **Reduced motion** is the runtime's (`'auto'` follows `prefers-reduced-motion`); every
  export says in a comment what happens ("it jumps to each state without moving").
- **Export dialog** ("Export code" by the title): format switch, what the format is for,
  trigger and reduced-motion lines, the code, file name with size and gzipped size
  (`measureExport`, the browser's CompressionStream), Copy and Download. HTML shows the
  exported page running in a sandboxed iframe, so preview = export is visible. React adds
  "Download runtime" (icontween.js + icontween.d.ts) and says what the runtime costs once
  minified (~4 KB gzipped).

## Alternatives

- Embedding the runtime in each React component: one file, but every icon repeats ~8 KB.
- A `<script src="icontween.js">` option for HTML: right for sites with many icons, but
  the classic-script and module files would need different names. Later, with npm.
- Generating `icontween.d.ts` with the TypeScript API or a d.ts bundler: either merges
  core's schema in awkwardly or adds a dependency; the type test keeps the hand-written one honest.
- CSS animation of `d`: ruled out (rule 10).

## Known limits

- The React component imports from `./icontween`; when the runtime is published as
  `icontween`, the import changes to the package.
- Downloading the runtime starts two downloads; some browsers ask once to allow that.
- Not yet checked in Safari and Firefox (M4 asks for a cross-browser pass).
