# CLAUDE.md — IconTween

IconTween is a client-side web app for designers to craft purposeful, state-based animations for individual SVG icons and export them as clean code. Full context, data model and milestones: **`PROJECT_BRIEF.md`** (read it before starting any milestone).

## Non-negotiable rules

1. **Identical structure across states.** All states of a prepared icon have the same elements, in the same order, with the same path command sequence and point count. States only change numbers. Enforce with `validateAnimation()` in `packages/core`.
2. **Canonical paths:** absolute coordinates, only `M`, `L`, `C`, `Z`. Shapes become paths, arcs become cubics, transforms are flattened.
3. **Never modify source icons.** Preparation creates a clone.
4. **Structure changes only in the Prepare step,** before state B exists.
5. **No backend.** Nothing is uploaded; everything runs in the browser.
6. **Sanitize every imported SVG** (allowlist elements/attributes; strip scripts, `foreignObject`, `on*` handlers, remote references).
7. **Exports are readable,** formatted code. No minified blobs.
8. **Reduced motion handled** in every export.
9. **Preview = export:** the editor plays animations with the same runtime that ships.
10. Don't rely on CSS animation of the `d` property for morphs (Safari gaps). Use the JS runtime or SMIL.

## Repo layout

- `apps/web` — editor + landing page (Vite, React, TypeScript, Zustand)
- `packages/core` — schema, validation, geometry, prepare pipeline (pure TS, tested with Vitest)
- `packages/runtime` — tiny dependency-free playback library (keep it a few KB gzipped)
- `packages/react` — React wrapper around the runtime
- `examples/` — starter set (`.icontween.json` + source SVGs from Lucide, ISC)
- `docs/decisions/` — short decision notes; `docs/devlog.md` — dated progress log

## How we work

- Small steps: one feature per session. Leave the app working and deployable.
- Write tests for `core` and `runtime` changes. Use the SVG fixtures folder for tricky inputs.
- Ask before: adding a dependency bigger than a few KB, changing the schema (bump `SCHEMA_VERSION` + migration), or changing these rules.
- After meaningful decisions, add `docs/decisions/NNN-title.md`. End each session with a dated line in `docs/devlog.md`.
- For visual work, say what the owner should check by hand. The owner judges feel and polish.

## Commands

Node 24 (`.nvmrc`), pnpm 10. Run from the repo root:

- `pnpm install` — install all workspaces
- `pnpm dev` — editor/landing dev server (http://localhost:5173)
- `pnpm test` — Vitest in every package that has tests (`pnpm --filter @icontween/core test` for one)
- `pnpm typecheck` — `tsc` in every package
- `pnpm lint` — ESLint + Prettier check; `pnpm format` to fix formatting
- `pnpm build` — production build; static output in `apps/web/dist`
- `pnpm export-check` — builds every starter in every export format and serves a self-checking page on http://localhost:5180 to open in Safari, Chrome and Firefox (decision 018)

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on every push.
Workspace packages are consumed from source (`exports` → `src/index.ts`); see `docs/decisions/001-monorepo-and-tooling.md`.
