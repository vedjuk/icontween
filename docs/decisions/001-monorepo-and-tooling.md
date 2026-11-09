# 001 — Monorepo and tooling

Date: 2026-11-09

## Context

M0 needs a home for the editor, a pure `core` package, a tiny `runtime` and a React wrapper,
with tests in CI and a static deploy.

## Decision

- **pnpm workspaces**, no task runner (Turborepo/Nx). Root scripts fan out with `pnpm -r`.
  Four packages don't need build caching yet.
- **Packages are consumed from source.** Each package's `exports` points at `src/index.ts`;
  Vite and Vitest compile TypeScript directly. No per-package build step until something is
  published (runtime → `icontween` on npm, M4/M5). Then add a build for that package only.
- **TypeScript 6.0**, not 7.0: typescript-eslint supports `<6.1` only. Revisit when it catches up.
- **Strict TS** with `noUncheckedIndexedAccess`, since geometry code indexes arrays constantly.
- **Vitest** per package (only `core` has tests in M0). **ESLint flat config + Prettier**
  (single quotes, 100 columns).
- **Zustand not installed yet.** It arrives with the first editor state (M1/M2).
- **Hosting: Cloudflare**, static output from `apps/web/dist`, build command `pnpm build`.
  `apps/web/public/_headers` sets a strict CSP (`default-src 'self'`), which also enforces
  "no backend, nothing uploaded" at the browser level.
- **`validateAnimation()` returns all issues** with a path to each one, rather than throwing on
  the first. The editor will want to show them; `assertValidAnimation()` throws for tests/loaders.
- **`dToSegments()` parses only canonical paths** (absolute M/L/C/Z). Arbitrary path data is
  the prepare pipeline's job (M1), where `svgpath` will be evaluated.

## Alternatives

- Turborepo: worth it once builds get slow; easy to add later.
- Building packages with tsup/tsc from day one: extra watch processes and stale-build bugs for
  no benefit while nothing is published.
